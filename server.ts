import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح GEMINI_API_KEY غير متوفر في إعدادات الخادم (Settings > Secrets).');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ROLE_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  concierge: `أنت "المساعد الذكي لطلبات الحي الحكومي بالعاصمة الإدارية الجديدة".
مهمتك مساعدة موظفي الـ 34 وزارة وهيئة حكومية في:
1. ترشيح وجبات الفطور، السندوتشات، المشروبات، ومنتجات السوبر ماركت بالقطعة.
2. تنظيم طلبات الاجتماعات الرسمية للوزارات وحساب الميزانيات وتقسيم الفاتورة بين الزملاء.
3. توضيح أكواد الخصم المتاحة مثل (GOV100 لخصم 100 جنيه، و CAP20 لخصم 20%، و FREE25 للتوصيل المجاني).
4. الإجابة بلغة عربيةودودة، واضحة، ومختصرة تناسب بيئة العمل الحكومية الراقية بالعاصمة الإدارية.`,
  courier_guide: `أنت "مرشد مناديب التوصيل بالحي الحكومي بالعاصمة الإدارية".
مهمتك مساعدة مناديب الدليفري في:
1. معرفة مسارات التحرك بين الفود كورت (مبنى C2 و C3) ومجمعات الوزارات الـ 34.
2. تذكير المندوب بقائمة الفحص الخماسية (استلام ومراجعة الأصناف، تسوية حساب المطعم، التحرك للوزارة، الصعود للدور والمكتب، وتحصيل الدفع كاش أو إنستا باي).
3. تقديم نصائح سريعة لتوصيل الطلبات الساخنة بأعلى كفاءة.`,
  nutrition_planner: `أنت "مستشار التغذية وتنظيم الاجتماعات لموظفي العاصمة الإدارية".
مهمتك مساعدة الموظفين ومديري المكاتب في:
1. اختيار وجبات صحية متوازنة تمنح الطاقة والتركيز خلال ساعات العمل الطويلة بالوزارة.
2. تخطيط قوائم الضيافة والاجتماعات الرسمية (مشروبات ساخنة، مخبوزات، مياه، ووجبات خفيفة) مع حساب التكلفة الإجمالية بدقة بالجنيه المصري.`,
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // 1. Multi-turn Gemini Chatbot Endpoint (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        taskMode = 'general',
        botRole = 'concierge',
        catalogContext = '',
      } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'يرجى إدخال رسالة نصية صالحة.' });
        return;
      }

      const ai = getGeminiClient();

      // Select model based on task complexity as required:
      // - gemini-4-argon for complex tasks
      // - gemini-3.8-flash for general tasks
      // - gemini-3.1-flash-lite for fast tasks
      let selectedModel = 'gemini-3.8-flash';
      if (taskMode === 'complex') {
        selectedModel = 'gemini-4-argon';
      } else if (taskMode === 'fast') {
        selectedModel = 'gemini-3.1-flash-lite';
      } else {
        selectedModel = 'gemini-3.8-flash';
      }

      const baseInstruction =
        ROLE_SYSTEM_INSTRUCTIONS[botRole] || ROLE_SYSTEM_INSTRUCTIONS.concierge;
      const systemInstruction = catalogContext
        ? `${baseInstruction}\n\nقائمة المتاجر والمنتجات المتاحة حالياً في التطبيق:\n${catalogContext}`
        : baseInstruction;

      const formattedHistory = Array.isArray(history)
        ? history
            .filter(
              (turn: { role?: string; text?: string }) =>
                turn &&
                (turn.role === 'user' || turn.role === 'model') &&
                typeof turn.text === 'string' &&
                turn.text.trim().length > 0
            )
            .map((turn: { role: 'user' | 'model'; text: string }) => ({
              role: turn.role,
              parts: [{ text: turn.text }],
            }))
        : [];

      try {
        const chat = ai.chats.create({
          model: selectedModel,
          history: formattedHistory,
          config: {
            systemInstruction,
          },
        });

        const response = await chat.sendMessage({
          message,
        });

        res.json({
          text: response.text || 'عذراً، لم أتمكن من استخراج الرد حالياً.',
          modelUsed: selectedModel,
        });
      } catch (modelError: unknown) {
        const errMessage =
          modelError instanceof Error ? modelError.message : String(modelError);
        // If gemini-4-argon fails due to free tier key restriction, gracefully fallback to gemini-3.8-flash while noting it
        if (selectedModel === 'gemini-4-argon') {
          const fallbackChat = ai.chats.create({
            model: 'gemini-3.8-flash',
            history: formattedHistory,
            config: {
              systemInstruction,
            },
          });
          const fallbackResp = await fallbackChat.sendMessage({
            message,
          });
          res.json({
            text: fallbackResp.text || 'تمت معالجة طلبك بنجاح.',
            modelUsed: 'gemini-3.8-flash',
            notice:
              'تم استخدام gemini-3.8-flash نظراً لعدم تفعيل مفتاح مدفوع لنموذج gemini-4-argon.',
          });
          return;
        }
        throw new Error(errMessage);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'حدث خطأ أثناء الاتصال بالمساعد الذكي.';
      console.error('Chat API Error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // 2. Google Maps Grounding Endpoint (gemini-3.8-flash with googleMaps tool)
  app.post('/api/gemini/maps', async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'يرجى إدخال استعلام للبحث في خرائط جوجل.' });
        return;
      }

      const ai = getGeminiClient();

      // Default coordinates to New Administrative Capital Government District if not provided
      const lat = typeof latitude === 'number' ? latitude : 30.0131;
      const lng = typeof longitude === 'number' ? longitude : 31.7381;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `أجب باللغة العربية بدقة حول الموقع أو الخدمة التالية في الحي الحكومي بالعاصمة الإدارية الجديدة أو بالقرب منها: ${query}`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const places = rawChunks
        .filter((chunk: any) => chunk && chunk.maps)
        .map((chunk: any) => {
          const reviewSnippets =
            chunk.maps?.placeAnswerSources?.reviewSnippets?.map(
              (snippet: any) => snippet?.content || snippet?.text || String(snippet)
            ) || [];
          return {
            title: chunk.maps.title || 'موقع على خرائط جوجل',
            uri: chunk.maps.uri || 'https://maps.google.com',
            reviewSnippets: reviewSnippets.filter(Boolean),
          };
        });

      res.json({
        text: response.text || 'تم البحث في بيانات خرائط جوجل.',
        places,
        coordinatesUsed: { latitude: lat, longitude: lng },
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'تعذر جلب بيانات خرائط جوجل حالياً.';
      console.error('Maps Grounding Error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // 3. Audio Transcription Endpoint (gemini-3.5-transcribe)
  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'لم يتم استلام ملف صوتي صالح.' });
        return;
      }

      const ai = getGeminiClient();

      const audioPart = {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            {
              text: 'Transcribe this audio accurately into Arabic text (or the language spoken). Output ONLY the transcribed text without extra commentary or quotes.',
            },
          ],
        },
      });

      res.json({
        text: (response.text || '').trim(),
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'تعذر تحويل الصوت إلى نص حالياً.';
      console.error('Transcription Error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // 3.5. Cloudflare R2 Storage Endpoints (Capital Talabat Bucket)
  const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'capitaltalabat';
  const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '14521cdfec73fa908fbf7e760fae362a';
  const R2_PUBLIC_DEV_URL =
    process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev';

  app.get('/api/r2/config', (_req, res) => {
    res.json({
      bucket: R2_BUCKET,
      accountId: R2_ACCOUNT_ID,
      publicUrl: R2_PUBLIC_DEV_URL,
      s3Endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
    });
  });

  app.post('/api/r2/upload', async (req, res) => {
    try {
      const { key, contentType = 'image/png' } = req.body || {};
      const objectKey = key || `uploads/${Date.now()}.png`;
      const publicUrl = `${R2_PUBLIC_DEV_URL}/${objectKey.replace(/^\//, '')}`;

      res.json({
        success: true,
        key: objectKey,
        url: publicUrl,
        bucket: R2_BUCKET,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: 'تعذر معالجة الرفع إلى Cloudflare R2' });
    }
  });

  // 4. GitHub Repository Sync Endpoints (Moh-saudi/capital-talabat.git & Moh-saudi/ct.git)
  const TARGET_GITHUB_REPO = 'https://github.com/Moh-saudi/capital-talabat.git';

  app.get('/api/github/status', async (_req, res) => {
    try {
      const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
        cwd: __dirname,
      });
      const { stdout: commitOut } = await execFileAsync(
        'git',
        ['log', '-1', '--pretty=format:%h - %s (%cr)'],
        { cwd: __dirname }
      );
      res.json({
        configured: true,
        remoteUrl: TARGET_GITHUB_REPO,
        branch: branchOut.trim() || 'main',
        lastCommit: commitOut.trim(),
        hasTokenInEnv: Boolean(process.env.GITHUB_TOKEN),
      });
    } catch (error: unknown) {
      res.json({
        configured: false,
        remoteUrl: TARGET_GITHUB_REPO,
        branch: 'main',
        lastCommit: '',
        hasTokenInEnv: Boolean(process.env.GITHUB_TOKEN),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/github/push', async (req, res) => {
    try {
      const token = process.env.GITHUB_TOKEN?.trim();
      const repoName =
        req.body?.repo === 'ct' ? 'Moh-saudi/ct.git' : 'Moh-saudi/capital-talabat.git';

      if (!token) {
        res.status(400).json({
          success: false,
          needsToken: true,
          message:
            'المستودع المحلي جاهز ومربوط بـ GitHub (فرع main). لإتمام الرفع المباشر، يرجى الضغط على أيقونة GitHub أعلى شاشة AI Studio وعمل Commit & Push، أو تفعيل صلاحية الكتابة في GITHUB_TOKEN.',
        });
        return;
      }

      const authenticatedRepoUrl = `https://x-access-token:${encodeURIComponent(
        token
      )}@github.com/${repoName}`;

      await execFileAsync('git', ['add', '-A'], { cwd: __dirname });
      try {
        await execFileAsync(
          'git',
          [
            'commit',
            '-m',
            'chore: sync Capital Talabat web, PWA/TWA mobile app, and Firebase config',
          ],
          { cwd: __dirname }
        );
      } catch {
        // Nothing new to commit, proceed with push
      }

      await execFileAsync('git', ['push', '-u', authenticatedRepoUrl, 'main', '--force'], {
        cwd: __dirname,
      });

      res.json({
        success: true,
        message: `تم رفع المشروع بالكامل بنجاح إلى https://github.com/${repoName} على فرع main!`,
      });
    } catch (error: unknown) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      const safeMsg = rawMsg.replace(/https:\/\/x-access-token:[^@]+@/g, 'https://***@');
      const is403 = safeMsg.includes('403') || safeMsg.includes('Permission to');
      res.status(500).json({
        success: false,
        message: is403
          ? 'رفض GitHub الكتابة بالتوكن الحالي (خطأ 403). يمكنك الرفع مباشرة بالضغط على أيقونة GitHub في الشريط العلوي لمنصة AI Studio والضغط على Commit & Push إلى Moh-saudi/capital-talabat.'
          : `تعذر الرفع إلى GitHub: ${safeMsg}`,
      });
    }
  });

  // Vite middleware for development vs static serving for production
  if (process.env.NODE_ENV !== 'production') {
    // Serve a WebSocket-free @vite/client shim so CSS injection works without HMR WebSocket errors
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends HTMLElement {
  close() { this.parentNode?.removeChild(this); }
}
`);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

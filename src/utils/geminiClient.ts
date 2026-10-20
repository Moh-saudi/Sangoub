import { auth } from "../lib/firebase.ts";
import { useState, useRef, useCallback } from "react";

export type GeminiTaskMode = "fast" | "general" | "complex";
export type ChatbotRole = "concierge" | "courier_guide" | "nutrition_planner";

export interface ChatTurn {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  modelUsed?: string;
  notice?: string;
}

export interface MapsPlaceLink {
  title: string;
  uri: string;
  reviewSnippets: string[];
}

export interface MapsGroundingResult {
  text: string;
  places: MapsPlaceLink[];
  coordinatesUsed: {
    latitude: number;
    longitude: number;
  };
}

export async function sendGeminiChatMessage(params: {
  message: string;
  history: { role: "user" | "model"; text: string }[];
  taskMode: GeminiTaskMode;
  botRole: ChatbotRole;
  catalogContext?: string;
}): Promise<{ text: string; modelUsed: string; notice?: string }> {
  const response = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await auth.currentUser?.getIdToken()) || ""}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "تعذر الاتصال بالمساعد الذكي.");
  }
  return data;
}

export async function queryGoogleMapsGrounding(params: {
  query: string;
  latitude?: number;
  longitude?: number;
}): Promise<MapsGroundingResult> {
  const response = await fetch("/api/gemini/maps", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await auth.currentUser?.getIdToken()) || ""}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "تعذر جلب بيانات خرائط جوجل.");
  }
  return data;
}

export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("فشل قراءة الملف الصوتي."));
    reader.readAsDataURL(blob);
  });

  const response = await fetch("/api/gemini/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await auth.currentUser?.getIdToken()) || ""}`,
    },
    body: JSON.stringify({
      audioBase64: base64Audio,
      mimeType: blob.type || "audio/webm",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "تعذر تحويل الصوت إلى نص.");
  }
  return data.text || "";
}

export function useVoiceRecorder(onTranscribed: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = useCallback(async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size < 200) {
          setVoiceError("التسجيل قصير جداً، يرجى التحدث بوضوح.");
          return;
        }

        setIsTranscribing(true);
        try {
          const text = await transcribeAudioBlob(blob);
          if (text.trim()) {
            onTranscribed(text.trim());
          } else {
            setVoiceError("لم يتم التعرف على كلام واضح، حاول مرة أخرى.");
          }
        } catch (err: unknown) {
          setVoiceError(
            err instanceof Error
              ? err.message
              : "حدث خطأ أثناء تحويل الصوت لنص.",
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError(
        "يرجى السماح بصلاحية الميكروفون من المتصفح للتسجيل الصوتي.",
      );
    }
  }, [onTranscribed]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    startRecording,
    stopRecording,
    toggleRecording,
  };
}

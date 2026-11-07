import { operationIdentity } from '../operations.ts';
import { requireAdmin, AdminError, adminError } from '../adminRequest.ts';
import { mobileCors } from '../mobileCors.ts';
import { firebaseMessagingService } from '../firebaseAdmin.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const audiences = ['all', 'clients', 'couriers', 'stores', 'single'] as const;
const types = ['promo', 'operational', 'alert', 'general'] as const;
const appOrigin = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sangoub.el7lm.com');
const roleIds: Record<string, string[]> = {
  clients: ['customer'],
  couriers: ['courier', 'store_courier'],
  stores: ['store_owner', 'store_manager', 'kitchen_staff', 'store_accountant'],
};

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function notificationWebLink(screen: string, targetId?: string) {
  const path = screen === 'offers'
    ? '/offers'
    : screen === 'orders'
      ? '/my-orders'
      : screen === 'store' && targetId
        ? `/stores/${encodeURIComponent(targetId)}`
        : '/';
  return new URL(path, appOrigin).href;
}

async function fetchAllRows(queryForRange: (from: number, to: number) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await queryForRange(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function audienceUserIds(admin: any, audience: string, targetUid?: string): Promise<string[]> {
  if (audience === 'single') {
    if (!targetUid || !UUID.test(targetUid)) throw new AdminError(400, 'معرّف المستخدم المستهدف غير صالح.');
    const { data, error } = await admin.from('profiles').select('id').eq('id', targetUid).maybeSingle();
    if (error) throw error;
    if (!data) throw new AdminError(404, 'حساب المستخدم المستهدف غير موجود.');
    return [data.id];
  }

  const profileRoles = audience === 'clients' ? ['employee'] : audience === 'couriers' ? ['courier'] : ['restaurant'];
  const profiles = await fetchAllRows((from, to) => {
    const query = admin.from('profiles').select('id,role');
    return audience === 'all' ? query.range(from, to) : query.in('role', profileRoles).range(from, to);
  });
  const ids = new Set<string>();
  if (audience === 'all') {
    for (const profile of profiles || []) ids.add(profile.id);
    return [...ids];
  }

  for (const profile of profiles || []) if (profileRoles.includes(profile.role)) ids.add(profile.id);

  const assignments = await fetchAllRows((from, to) => admin
    .from('user_roles')
    .select('user_id')
    .in('role_id', roleIds[audience] || [])
    .range(from, to));
  for (const assignment of assignments || []) ids.add(assignment.user_id);
  return [...ids];
}

async function registerDevice(req: any, res: any) {
  const { actor, verified } = await operationIdentity(req);
  if (!verified) throw new AdminError(403, 'أكد بريدك أو هاتفك قبل تفعيل إشعارات الجهاز.');
  const { token, platform } = req.body || {};
  if (typeof token !== 'string' || token.length < 20 || token.length > 2048 || !['android', 'ios', 'web'].includes(platform))
    throw new AdminError(400, 'بيانات جهاز الإشعارات غير صالحة.');

  const admin = supabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('id', actor.uid).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new AdminError(409, 'أكمل ملف الحساب أولًا.');

  const now = new Date().toISOString();
  const { error } = await admin.from('notification_devices').upsert({
    user_id: actor.uid,
    token,
    platform,
    enabled: true,
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: 'token' });
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function unregisterDevice(req: any, res: any) {
  const { actor, verified } = await operationIdentity(req);
  if (!verified) throw new AdminError(403, 'أكد بريدك أو هاتفك قبل تعديل أجهزة الإشعارات.');
  const { token } = req.body || {};
  if (typeof token !== 'string' || token.length < 20 || token.length > 2048)
    throw new AdminError(400, 'رمز جهاز الإشعارات غير صالح.');
  const { error } = await supabaseAdminClient()
    .from('notification_devices')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', actor.uid)
    .eq('token', token);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function userInbox(req: any, res: any) {
  const { actor, verified } = await operationIdentity(req);
  if (!verified) throw new AdminError(403, 'أكد بريدك أو هاتفك لعرض إشعارات الحساب.');
  const action = req.body?.action;
  const admin = supabaseAdminClient();

  if (action === 'inbox') {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      admin.from('notifications')
        .select('id,title,body,type,data,is_read,created_at,target_screen,image_url')
        .eq('user_id', actor.uid)
        .order('created_at', { ascending: false })
        .limit(100),
      admin.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', actor.uid)
        .eq('is_read', false),
    ]);
    if (error || countError) throw error || countError;
    return res.status(200).json({
      ok: true,
      unreadCount: count || 0,
      notifications: (data || []).map((row: any) => ({
        ...row,
        targetScreen: row.target_screen,
        imageUrl: row.image_url,
        createdAt: row.created_at,
      })),
    });
  }

  if (action === 'mark-read') {
    const id = req.body?.id;
    if (typeof id !== 'string' || !UUID.test(id)) throw new AdminError(400, 'معرّف الإشعار غير صالح.');
    const { error } = await admin.from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', actor.uid);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (action === 'mark-all-read') {
    const { error } = await admin.from('notifications')
      .update({ is_read: true })
      .eq('user_id', actor.uid)
      .eq('is_read', false);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  throw new AdminError(400, 'عملية الإشعارات غير معروفة.');
}

async function listCampaigns(res: any) {
  const { data, error } = await supabaseAdminClient()
    .from('notification_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const notifications = (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    type: row.type,
    targetScreen: row.target_screen,
    targetId: row.target_id,
    targetUid: row.target_uid,
    imageUrl: row.image_url,
    senderEmail: row.sender_email,
    recipientCount: row.recipient_count,
    fcmDeliveryStatus: row.fcm_delivery_status,
    status: row.status,
    createdAt: row.created_at,
    successCount: row.success_count,
    failureCount: row.failure_count,
    fcmError: row.fcm_error,
  }));
  return res.status(200).json({ ok: true, notifications });
}

export interface PushOptions {
  title: string;
  body: string;
  type?: string;
  targetScreen?: string;
  targetId?: string;
  imageUrl?: string | null;
  campaignId?: string;
  data?: Record<string, string>;
}

export async function sendPushToUsers(userIds: string[], options: PushOptions) {
  if (!userIds.length) return { successCount: 0, failureCount: 0, recipientCount: 0, fcmDeliveryStatus: 'recorded_only' };
  const admin = supabaseAdminClient();
  const cleanTitle = options.title.trim().slice(0, 120);
  const cleanBody = options.body.trim().slice(0, 500);
  const type = options.type || 'operational';
  const targetScreen = options.targetScreen || 'home';
  const targetId = options.targetId;
  const cleanImageUrl = options.imageUrl || null;

  const dataPayload: Record<string, string> = {
    type,
    screen: targetScreen,
    ...(targetId ? { targetId } : {}),
    ...(options.campaignId ? { campaignId: options.campaignId } : {}),
    ...(options.data || {}),
  };

  // 1. Store one in-app inbox row per recipient in Supabase
  try {
    for (const userChunk of chunk(userIds, 500)) {
      const rows = userChunk.map((userId) => ({
        user_id: userId,
        ...(options.campaignId ? { campaign_id: options.campaignId } : {}),
        title: cleanTitle,
        body: cleanBody,
        type,
        data: dataPayload,
        target_screen: targetScreen,
        image_url: cleanImageUrl,
        is_read: false,
      }));
      await admin.from('notifications').insert(rows);
    }
  } catch (err) {
    console.warn('Could not insert in-app notifications:', err);
  }

  // 2. Fetch device FCM tokens
  let devices: Array<{ id: string; user_id: string; token: string; platform: string }> = [];
  try {
    for (const userChunk of chunk(userIds, 500)) {
      devices.push(...await fetchAllRows((from, to) => admin
        .from('notification_devices')
        .select('id,user_id,token,platform')
        .eq('enabled', true)
        .in('user_id', userChunk)
        .range(from, to)));
    }
  } catch (err) {
    console.warn('Could not fetch notification devices:', err);
  }

  if (!devices.length) {
    return { successCount: 0, failureCount: 0, recipientCount: userIds.length, fcmDeliveryStatus: 'recorded_only' };
  }

  // 3. Send via FCM Multicast
  let successCount = 0;
  let failureCount = 0;
  let fcmError: string | null = null;
  const invalidDeviceIds: string[] = [];

  try {
    const messaging = firebaseMessagingService();
    for (const batch of chunk(devices, 500)) {
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((device) => device.token),
        notification: {
          title: cleanTitle,
          body: cleanBody,
          ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
        },
        data: dataPayload,
        android: {
          priority: 'high',
          notification: {
            channelId: 'capital_orders_channel',
            sound: 'default',
            color: '#FF5900',
          },
        },
        apns: { payload: { aps: { sound: 'default' } } },
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            icon: `${appOrigin}/brand/sangoub-mark-white-256.png`,
            badge: `${appOrigin}/brand/sangoub-mark-white-64.png`,
            tag: options.campaignId ? `sangoub-${options.campaignId}` : `sangoub-${Date.now()}`,
            ...(cleanImageUrl ? { image: cleanImageUrl } : {}),
          },
          fcmOptions: { link: notificationWebLink(targetScreen, targetId) },
        },
      });
      successCount += response.successCount;
      failureCount += response.failureCount;
      response.responses.forEach((result, index) => {
        const code = result.error?.code || '';
        if (!result.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code))
          invalidDeviceIds.push(batch[index].id);
      });
    }
  } catch (error: any) {
    fcmError = error?.message || 'تعذر الاتصال بخدمة FCM.';
    failureCount = devices.length - successCount;
  }

  // 4. Disable invalid tokens
  if (invalidDeviceIds.length) {
    try {
      await admin.from('notification_devices')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in('id', invalidDeviceIds);
    } catch {}
  }

  const fcmDeliveryStatus = devices.length === 0
    ? 'recorded_only'
    : successCount === devices.length
      ? 'delivered'
      : successCount > 0
        ? 'partial'
        : 'failed';

  return { successCount, failureCount, recipientCount: userIds.length, fcmDeliveryStatus, fcmError };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (mobileCors(req, res)) return;

  try {
    if (req.method === 'POST' && req.body?.action === 'register-token') return await registerDevice(req, res);
    if (req.method === 'POST' && req.body?.action === 'unregister-token') return await unregisterDevice(req, res);
    if (req.method === 'POST' && ['inbox', 'mark-read', 'mark-all-read'].includes(req.body?.action)) return await userInbox(req, res);

    const { actor } = await requireAdmin(req);
    if (req.method === 'GET' || (req.method === 'POST' && req.body?.action === 'list'))
      return await listCampaigns(res);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const input = req.body || {};
    const { title, body, audience = 'all', type = 'general', targetScreen = 'home', targetId, targetUid, imageUrl } = input;
    if (typeof title !== 'string' || !title.trim()) throw new AdminError(400, 'عنوان الإشعار مطلوب.');
    if (typeof body !== 'string' || !body.trim()) throw new AdminError(400, 'نص الإشعار مطلوب.');
    if (!audiences.includes(audience)) throw new AdminError(400, 'الفئة المستهدفة غير صالحة.');
    if (!types.includes(type)) throw new AdminError(400, 'نوع الإشعار غير صالح.');
    if (typeof targetScreen !== 'string' || targetScreen.length > 60) throw new AdminError(400, 'وجهة الإشعار غير صالحة.');
    if (targetId !== undefined && (typeof targetId !== 'string' || targetId.length > 128)) throw new AdminError(400, 'معرّف الوجهة غير صالح.');
    let cleanImageUrl: string | null = null;
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string' || imageUrl.length > 500) throw new AdminError(400, 'رابط صورة الإشعار غير صالح.');
      try {
        const parsed = new URL(imageUrl, appOrigin);
        if (parsed.protocol !== 'https:') throw new Error('insecure-url');
        cleanImageUrl = parsed.href;
      } catch {
        throw new AdminError(400, 'رابط صورة الإشعار يجب أن يكون HTTPS.');
      }
    }

    const cleanTitle = title.trim().slice(0, 120);
    const cleanBody = body.trim().slice(0, 500);
    const targetUidValue = audience === 'single' ? targetUid : undefined;
    if (audience === 'single' && (typeof targetUidValue !== 'string' || !UUID.test(targetUidValue)))
      throw new AdminError(400, 'اختر مستخدمًا مستهدفًا صالحًا.');

    const admin = supabaseAdminClient();
    const userIds = await audienceUserIds(admin, audience, targetUidValue);
    const now = new Date().toISOString();
    const { data: campaign, error: campaignError } = await admin.from('notification_campaigns').insert({
      title: cleanTitle,
      body: cleanBody,
      audience,
      type,
      target_screen: targetScreen || 'home',
      target_id: targetId || null,
      target_uid: targetUidValue || null,
      image_url: cleanImageUrl,
      sender_user_id: actor.uid,
      sender_email: actor.email || '',
      status: 'sending',
      fcm_delivery_status: 'pending',
      recipient_count: userIds.length,
    }).select('id').single();
    if (campaignError || !campaign) throw campaignError || new Error('Campaign insert was not confirmed.');

    const pushResult = await sendPushToUsers(userIds, {
      title: cleanTitle,
      body: cleanBody,
      type,
      targetScreen,
      targetId,
      imageUrl: cleanImageUrl,
      campaignId: campaign.id,
    });

    const status = pushResult.fcmDeliveryStatus === 'delivered' || pushResult.fcmDeliveryStatus === 'recorded_only'
      ? pushResult.fcmDeliveryStatus === 'delivered' ? 'sent' : 'recorded_only'
      : pushResult.successCount > 0 ? 'partial' : 'failed';
    const { error: updateError } = await admin.from('notification_campaigns').update({
      status,
      fcm_delivery_status: pushResult.fcmDeliveryStatus,
      recipient_count: userIds.length,
      success_count: pushResult.successCount,
      failure_count: pushResult.failureCount,
      fcm_error: pushResult.fcmError,
      sent_at: new Date().toISOString(),
    }).eq('id', campaign.id);
    if (updateError) throw updateError;

    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: actor.uid,
      actor_email: actor.email || '',
      action: 'admin.notification.broadcast',
      entity_type: 'notification_campaigns',
      entity_id: campaign.id,
      after_state: { title: cleanTitle, audience, type, recipientCount: userIds.length, successCount, failureCount },
      source: 'notifications-api',
      status: successCount ? 'success' : 'partial',
    });
    if (auditError) console.warn('Notification campaign audit write failed:', auditError.code || 'database-error');

    return res.status(200).json({
      ok: true,
      id: campaign.id,
      title: cleanTitle,
      audience,
      fcmSuccess: successCount > 0,
      recipientCount: userIds.length,
      deviceCount: devices.length,
      successCount,
      failureCount,
      message: devices.length === 0
        ? 'تم حفظ الإشعار في سجل المستخدمين، ولا توجد أجهزة مسجلة لاستلام Push.'
        : successCount > 0
          ? `وصل الإشعار إلى ${successCount} جهاز من أصل ${devices.length}.`
          : 'حُفظ الإشعار في Supabase، لكن تعذر إرساله إلى أجهزة FCM.',
    });
  } catch (error: any) {
    return adminError(res, error);
  }
}

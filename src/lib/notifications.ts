import { prisma } from "@/lib/prisma";

/**
 * 通知发送服务 - 统一入口
 *
 * 支持渠道：WhatsApp（待 API 配置）, SMS（占位）, Email
 * 所有发送行为都会在 Notification 表中留下记录。
 */

export type NotificationChannel = 'SMS' | 'EMAIL' | 'WHATSAPP';

interface WhatsAppConfig {
  apiUrl: string;
  accessToken: string;
  phoneNumberId: string;
}

function getWhatsAppConfig(): WhatsAppConfig | null {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!apiUrl || !accessToken || !phoneNumberId) return null;
  return { apiUrl, accessToken, phoneNumberId };
}

/**
 * 格式化马来西亚电话号码
 * 0123456789 -> 60123456789
 * +60123456789 -> 60123456789
 * 60123456789 -> 60123456789
 */
export function normalizeMalaysiaPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.slice(1);
  } else if (!cleaned.startsWith('60')) {
    cleaned = '60' + cleaned;
  }
  return cleaned;
}

/**
 * 发送 WhatsApp 文档（PDF 链接须公网 HTTPS 可访问）
 */
export async function sendWhatsAppDocument(
  phone: string,
  documentUrl: string,
  filename: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getWhatsAppConfig();
  if (!config) {
    return { success: false, error: "WhatsApp API 未配置" };
  }

  try {
    const formattedPhone = normalizeMalaysiaPhone(phone);
    const response = await fetch(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "document",
          document: {
            link: documentUrl,
            filename,
          },
        }),
      }
    );

    const result = await response.json();
    if (response.ok && result.messages?.[0]?.id) {
      return { success: true, messageId: result.messages[0].id };
    }
    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 发送 WhatsApp 消息
 * 如果未配置 API，返回 { success: false, error: 'not-configured' }
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getWhatsAppConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp API 未配置' };
  }

  try {
    const formattedPhone = normalizeMalaysiaPhone(phone);

    const response = await fetch(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const result = await response.json();

    if (response.ok && result.messages?.[0]?.id) {
      return { success: true, messageId: result.messages[0].id };
    }
    return {
      success: false,
      error: result.error?.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 发送通知并记录到数据库
 * 统一的发送入口，会自动写入 Notification 表
 */
export async function sendNotification(opts: {
  channel: NotificationChannel;
  target: string;
  subject?: string;
  body: string;
}): Promise<{
  success: boolean;
  notificationId: string;
  messageId?: string;
  error?: string;
}> {
  // 1. 先创建 PENDING 记录
  const notification = await prisma.notification.create({
    data: {
      channel: opts.channel,
      target: opts.target,
      subject: opts.subject,
      body: opts.body,
      status: 'PENDING',
    },
  });

  // 2. 根据 channel 发送
  let result: { success: boolean; messageId?: string; error?: string };

  if (opts.channel === 'WHATSAPP') {
    result = await sendWhatsAppMessage(opts.target, opts.body);
  } else if (opts.channel === 'EMAIL') {
    // 复用现有 mailer
    try {
      const { sendMail } = await import('@/lib/mailer');
      const mailRes = await sendMail(opts.target, opts.subject || '通知', opts.body);
      result = (mailRes as any).ok
        ? { success: true }
        : { success: false, error: (mailRes as any).error || 'Email failed' };
    } catch (e) {
      result = { success: false, error: e instanceof Error ? e.message : 'Email error' };
    }
  } else {
    // SMS - 暂未对接服务商
    result = { success: false, error: 'SMS 通道未配置' };
  }

  // 3. 更新状态
  const updateData: any = result.success
    ? { status: 'SENT', sentAt: new Date() }
    : { status: 'FAILED', error: result.error || '发送失败' };

  await prisma.notification.update({
    where: { id: notification.id },
    data: updateData,
  });

  return {
    success: result.success,
    notificationId: notification.id,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * 检查通知系统的可用性
 */
export function getNotificationStatus(): {
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
} {
  return {
    whatsapp: getWhatsAppConfig() !== null,
    email: !!process.env.SMTP_HOST || !!process.env.MAIL_HOST,
    sms: false,
  };
}

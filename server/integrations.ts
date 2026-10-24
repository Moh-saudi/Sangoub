/**
 * ==============================================================================
 * نظام طلبات العاصمة (Talabat Al-Asima) - وحدة التكامل الموحدة
 * ==============================================================================
 * الوظائف:
 * 1. بوابة جيديا (Geidea): إنشاء روابط الدفع الإلكتروني وتأكيد العمليات
 * 2. شات أمان (ChatAman): إرسال نماذج تأكيد الطلبات، إشعارات التوصيل، ورموز OTP
 */

import crypto from "node:crypto";

export const ASIMA_CONFIG = {
  geidea: {
    live: {
      merchantPublicKey:
        process.env.GEIDEA_MERCHANT_PUBLIC_KEY ||
        "3448c010-87b1-41e7-9771-cac444268cfb",
      apiPassword:
        process.env.GEIDEA_API_PASSWORD ||
        "",
      baseUrl:
        process.env.GEIDEA_BASE_URL || "https://api.merchant.geidea.net",
    },
    test: {
      merchantPublicKey:
        process.env.GEIDEA_TEST_MERCHANT_PUBLIC_KEY ||
        "e510dca3-d113-47bf-b4b0-9b92bac661f6",
      apiPassword:
        process.env.GEIDEA_TEST_API_PASSWORD ||
        "",
      baseUrl: "https://api.merchant.geidea.net",
    },
    callbackUrl:
      process.env.GEIDEA_CALLBACK_URL ||
      "https://capital-talabat.vercel.app/api/geidea/callback",
    returnUrl:
      process.env.GEIDEA_RETURN_URL ||
      "https://capital-talabat.vercel.app/checkout/success",
    environment: (process.env.GEIDEA_ENVIRONMENT || "production") as
      | "production"
      | "test",
  },
  chataman: {
    apiKey:
      process.env.CHATAMAN_API_KEY ||
      "",
    baseUrl: process.env.CHATAMAN_BASE_URL || "https://chataman.com",
    senderName: process.env.CHATAMAN_SENDER_NAME || "طلبات العاصمة",
    defaultCountryCode: process.env.CHATAMAN_DEFAULT_COUNTRY_CODE || "20",
    templates: {
      otp: "otp_el7lmplatform",
      orderConfirm: "order_confirmation",
      statusAlert: "order_status_update",
    },
  },
};

// ==============================================================================
// 1. بوابة جيديا للمدفوعات (Geidea Payment Gateway)
// ==============================================================================

export interface CreateOrderPaymentOptions {
  orderId: string;
  amount: number;
  currency: "EGP" | "SAR" | string;
  customerEmail: string;
  customerName: string;
  returnUrl?: string;
  callbackUrl?: string;
}

export class GeideaGateway {
  /**
   * حساب توقيع HMAC-SHA256 وفقاً لمتطلبات Geidea الرسمية
   */
  public static generateSignature(
    merchantPublicKey: string,
    amount: number,
    currency: string,
    referenceId: string,
    apiPassword: string,
    timestamp: string,
  ): string {
    const formattedAmount = Number(amount).toFixed(2);
    const data = `${merchantPublicKey}${formattedAmount}${currency.toUpperCase()}${referenceId}${timestamp}`;
    return crypto
      .createHmac("sha256", apiPassword)
      .update(data)
      .digest("base64");
  }

  /**
   * تنسيق التوقيت الإلزامي: YYYY/MM/DD HH:mm:ss
   */
  public static formatTimestamp(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
      date.getDate(),
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds(),
    )}`;
  }

  /**
   * إنشاء جلسة دفع للطلب والحصول على رابط التحويل
   */
  public static async createOrderPayment(options: CreateOrderPaymentOptions) {
    try {
      const isTest = ASIMA_CONFIG.geidea.environment === "test";
      const creds = isTest ? ASIMA_CONFIG.geidea.test : ASIMA_CONFIG.geidea.live;
      if (!creds.apiPassword) throw new Error("GEIDEA_NOT_CONFIGURED");
      const currency = options.currency.toUpperCase();
      const referenceId = `ASIMA_${options.orderId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 30);
      const timestamp = this.formatTimestamp();

      const signature = this.generateSignature(
        creds.merchantPublicKey,
        options.amount,
        currency,
        referenceId,
        creds.apiPassword,
        timestamp,
      );

      const nameParts = options.customerName.trim().split(/\s+/);
      const payload = {
        amount: Number(options.amount),
        currency,
        merchantReferenceId: referenceId,
        timestamp,
        signature,
        callbackUrl: options.callbackUrl || ASIMA_CONFIG.geidea.callbackUrl,
        returnUrl: options.returnUrl || ASIMA_CONFIG.geidea.returnUrl,
        language: "ar",
        customer: {
          email: options.customerEmail || "customer@capital-talabat.eg",
          firstName: nameParts[0] || "عميل",
          lastName: nameParts.slice(1).join(" ") || "العاصمة",
        },
        metadata: {
          system: "Talabat_Al_Asima",
          orderId: options.orderId,
        },
      };

      const auth = Buffer.from(
        `${creds.merchantPublicKey}:${creds.apiPassword}`,
      ).toString("base64");

      const response = await fetch(
        `${creds.baseUrl}/payment-intent/api/v2/direct/session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      const responseCode = data.responseCode || data.code;

      if (!response.ok || (responseCode && responseCode !== "000")) {
        return {
          success: false,
          error:
            data.detailedResponseMessage ||
            data.responseMessage ||
            "فشل في إنشاء جلسة الدفع بجيديا",
          details: data,
        };
      }

      return {
        success: true,
        sessionId: data.session?.id || data.sessionId,
        orderId: data.order?.orderId || data.orderId,
        redirectUrl: data.session?.redirectUrl || data.redirectUrl,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "خطأ غير متوقع أثناء الاتصال بجيديا",
      };
    }
  }

  /**
   * فحص بيانات الـ Callback من جيديا للتأكد من دفع العميل بنجاح
   */
  public static verifyCallback(payload: Record<string, any>) {
    const status = String(
      payload.status || payload.responseMessage || "",
    ).toUpperCase();
    const code = String(payload.responseCode || payload.code || "");
    const isPaid = code === "000" || status === "SUCCESS" || status === "PAID";

    return {
      isPaid,
      orderId: payload.orderId || payload.order?.orderId,
      referenceId: payload.merchantReferenceId,
      amount: Number(payload.amount || payload.order?.amount || 0),
      currency: payload.currency || "EGP",
      raw: payload,
    };
  }
}

// ==============================================================================
// 2. بوابة شات أمان للواتساب (ChatAman WhatsApp Gateway)
// ==============================================================================

export class ChatAmanGateway {
  /**
   * تنسيق الرقم بالصيغة الدولية (+20 أو +966)
   */
  public static formatPhone(phone: string, defaultCountry = "20"): string {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("01") && clean.length === 11)
      clean = `20${clean.substring(1)}`;
    else if (clean.startsWith("05") && clean.length === 10)
      clean = `966${clean.substring(1)}`;
    else if (clean.startsWith("0") && clean.length >= 9)
      clean = `${defaultCountry}${clean.substring(1)}`;
    return `+${clean}`;
  }

  /**
   * إرسال نموذج رسمي (Template) عبر واتساب شات أمان
   */
  public static async sendTemplate(params: {
    phone: string;
    templateName: string;
    language?: string;
    bodyVariables?: (string | number)[];
    buttonUrlVariable?: string;
  }) {
    try {
      const formattedPhone = this.formatPhone(params.phone);
      const components: Record<string, unknown>[] = [];

      // متغيرات نص الرسالة (Variables: {{1}}, {{2}}, ...)
      if (params.bodyVariables && params.bodyVariables.length > 0) {
        components.push({
          type: "body",
          parameters: params.bodyVariables.map((val) => ({
            type: "text",
            text: String(val),
          })),
        });
      }

      // متغير الزر التفاعلي (رابط مخصص أو كود)
      if (params.buttonUrlVariable) {
        components.push({
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [{ type: "text", text: params.buttonUrlVariable }],
        });
      }

      const payload = {
        phone: formattedPhone,
        template: {
          name: params.templateName,
          language: { code: params.language || "ar" },
          components,
        },
      };

      const res = await fetch(
        `${ASIMA_CONFIG.chataman.baseUrl}/api/send/template`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ASIMA_CONFIG.chataman.apiKey.trim()}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false || data?.data?.success === false) {
        return {
          success: false,
          error: data?.message || data?.error || `HTTP ${res.status}`,
          data,
        };
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "ChatAman error",
      };
    }
  }

  /**
   * 🛒 رسالة نموذج تأكيد الطلب المخصصة لنظام "طلبات العاصمة"
   */
  public static async sendOrderConfirmation(order: {
    phone: string;
    customerName: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    deliveryAddress: string;
    templateName?: string;
  }) {
    const template =
      order.templateName || ASIMA_CONFIG.chataman.templates.orderConfirm;

    return this.sendTemplate({
      phone: order.phone,
      templateName: template,
      language: "ar",
      bodyVariables: [
        order.customerName,
        order.orderNumber,
        `${order.totalAmount}`,
        order.currency,
        order.deliveryAddress,
      ],
    });
  }

  /**
   * 🔐 إرسال رمز التحقق OTP لتسجيل دخول عميل "طلبات العاصمة"
   */
  public static async sendOTP(phone: string, code: string) {
    return this.sendTemplate({
      phone,
      templateName: ASIMA_CONFIG.chataman.templates.otp,
      language: "ar",
      bodyVariables: [code],
      buttonUrlVariable: code,
    });
  }

  /**
   * 💬 إرسال رسالة نصية مباشرة (تعمل خلال نافذة الـ 24 ساعة)
   */
  public static async sendDirectMessage(phone: string, text: string) {
    try {
      const formattedPhone = this.formatPhone(phone);
      const res = await fetch(`${ASIMA_CONFIG.chataman.baseUrl}/api/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ASIMA_CONFIG.chataman.apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: formattedPhone, message: text }),
      });

      const data = await res.json().catch(() => null);
      return { success: res.ok && data?.success !== false, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error sending text",
      };
    }
  }
}

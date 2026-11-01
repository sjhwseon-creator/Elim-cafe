import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-elim-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const messages: Record<string, { title: string; body: string }> = {
  de: {
    title: "Deine Bestellung ist fertig!",
    body: "Bitte hole deine Getränke am Café ab."
  },
  en: {
    title: "Your order is ready!",
    body: "Please pick it up at the café counter."
  },
  ko: {
    title: "주문하신 음료가 준비되었습니다!",
    body: "카페 카운터에서 픽업해주세요."
  },
  zh: {
    title: "您的订单已准备好！",
    body: "请到咖啡厅柜台取餐。"
  }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function readSecret(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

function readSupabaseAdminKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsedKeys = JSON.parse(secretKeys) as Record<string, string>;
    if (parsedKeys.default) return parsedKeys.default;
  }
  throw new Error("Missing Supabase server key");
}

function getOrderId(payload: Record<string, unknown>) {
  const directOrderId = payload.order_id;
  if ((typeof directOrderId === "string" && directOrderId) || typeof directOrderId === "number") {
    return String(directOrderId);
  }

  const webhookRecord = payload.record as Record<string, unknown> | undefined;
  const webhookOrderId = webhookRecord?.order_id;
  if ((typeof webhookOrderId === "string" && webhookOrderId) || typeof webhookOrderId === "number") {
    return String(webhookOrderId);
  }
  return null;
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function convertVapidKeysToJwk(publicKey: string, privateKey: string) {
  const publicBytes = base64UrlToBytes(publicKey);
  const privateBytes = base64UrlToBytes(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new Error("Invalid VAPID key format");
  }

  const x = bytesToBase64Url(publicBytes.slice(1, 33));
  const y = bytesToBase64Url(publicBytes.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", alg: "ES256", x, y, ext: true, key_ops: ["verify"] },
    privateKey: {
      kty: "EC",
      crv: "P-256",
      alg: "ES256",
      x,
      y,
      d: bytesToBase64Url(privateBytes),
      ext: true,
      key_ops: ["sign"]
    }
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let adminClient: ReturnType<typeof createClient> | null = null;
  let claimedEventId: string | null = null;

  try {
    const supabaseUrl = readSecret("SUPABASE_URL");
    const serviceRoleKey = readSupabaseAdminKey();
    const vapidPublicKey = readSecret("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = readSecret("VAPID_PRIVATE_KEY");
    const vapidSubject = readSecret("VAPID_SUBJECT");
    const webhookSecret = readSecret("ORDER_READY_WEBHOOK_SECRET");
    const payload = await request.json() as Record<string, unknown>;
    const orderId = getOrderId(payload);

    if (!orderId) return jsonResponse({ error: "order_id is required" }, 400);

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const admin = adminClient;

    const suppliedWebhookSecret = request.headers.get("x-elim-webhook-secret");
    const isWebhook = suppliedWebhookSecret === webhookSecret;

    if (!isWebhook) {
      const authorization = request.headers.get("Authorization") || "";
      const accessToken = authorization.replace(/^Bearer\s+/i, "");
      if (!accessToken) return jsonResponse({ error: "Authentication required" }, 401);

      const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
      if (userError || !userData.user) return jsonResponse({ error: "Invalid session" }, 401);

      const { data: staffProfile } = await admin
        .from("staff_profiles")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .eq("role", "staff")
        .maybeSingle();

      if (!staffProfile) return jsonResponse({ error: "Staff access required" }, 403);
    }

    // Atomic claim: a second Staff call or Database Webhook cannot claim an
    // event that another invocation already changed to "sending" or "sent".
    const { data: notificationEvent, error: claimError } = await admin
      .from("order_ready_notifications")
      .update({
        status: "sending",
        updated_at: new Date().toISOString(),
        last_error: null
      })
      .eq("order_id", orderId)
      .in("status", ["pending", "failed"])
      .select("id, order_id, user_id, attempts")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!notificationEvent) {
      return jsonResponse({ ok: true, duplicate: true, message: "Notification already claimed or sent" });
    }
    claimedEventId = notificationEvent.id;

    const attempts = Number(notificationEvent.attempts || 0) + 1;
    await admin
      .from("order_ready_notifications")
      .update({ attempts })
      .eq("id", notificationEvent.id);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, order_number, customer_user_id, status")
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;
    if (order.status !== "completed" || order.customer_user_id !== notificationEvent.user_id) {
      throw new Error("Order is not a completed customer order");
    }

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, language")
      .eq("user_id", order.customer_user_id);

    if (subscriptionsError) throw subscriptionsError;

    if (!subscriptions?.length) {
      await admin
        .from("order_ready_notifications")
        .update({ status: "no_subscription", updated_at: new Date().toISOString() })
        .eq("id", notificationEvent.id);
      return jsonResponse({ ok: true, sent: 0, message: "Customer has no push subscription" });
    }

    const vapidKeys = await webpush.importVapidKeys(
      convertVapidKeysToJwk(vapidPublicKey, vapidPrivateKey),
      { extractable: false }
    );
    const applicationServer = await webpush.ApplicationServer.new({
      contactInformation: vapidSubject,
      vapidKeys
    });

    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      const language = messages[subscription.language] ? subscription.language : "de";
      const message = messages[language];
      const notificationPayload = JSON.stringify({
        ...message,
        orderId: order.id,
        orderNumber: order.order_number,
        url: "./index.html"
      });

      try {
        const subscriber = applicationServer.subscribe({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth }
        });
        await subscriber.pushTextMessage(notificationPayload, {
          ttl: 3600,
          urgency: webpush.Urgency.High,
          topic: `elim-order-${order.id}`
        });
        return { id: subscription.id, sent: true };
      } catch (error) {
        const statusCode = error instanceof webpush.PushMessageError
          ? error.response.status
          : Number((error as { statusCode?: number }).statusCode || 0);
        const subscriptionIsGone = [404, 410].includes(statusCode);
        if (subscriptionIsGone) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
        throw error;
      }
    }));

    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failedMessages = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error
        ? (result.reason.message || result.reason.toString())
        : String(result.reason));

    if (sentCount > 0) {
      const sentAt = new Date().toISOString();
      await Promise.all([
        admin.from("order_ready_notifications").update({
          status: "sent",
          sent_at: sentAt,
          updated_at: sentAt,
          last_error: failedMessages.length ? failedMessages.join(" | ").slice(0, 1000) : null
        }).eq("id", notificationEvent.id),
        admin.from("orders").update({ ready_notified_at: sentAt }).eq("id", orderId)
      ]);

      return jsonResponse({ ok: true, sent: sentCount, failed: failedMessages.length });
    }

    const failureMessage = failedMessages.join(" | ").slice(0, 1000) || "Push delivery failed";
    await admin.from("order_ready_notifications").update({
      status: "failed",
      updated_at: new Date().toISOString(),
      last_error: failureMessage
    }).eq("id", notificationEvent.id);

    return jsonResponse({ error: failureMessage }, 502);
  } catch (error) {
    console.error("send-order-ready failed:", error);
    if (adminClient && claimedEventId) {
      await adminClient.from("order_ready_notifications").update({
        status: "failed",
        updated_at: new Date().toISOString(),
        last_error: (error instanceof Error ? error.message : "Unexpected error").slice(0, 1000)
      }).eq("id", claimedEventId);
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

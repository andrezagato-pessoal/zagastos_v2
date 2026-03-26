import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function createVapidJwt(
  endpoint: string,
  privateKeyJwk: JsonWebKey,
  publicKeyBase64: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:zagastos@app.com",
  };

  const headerB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (already raw from Web Crypto)
  const jwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyBase64}`,
    cryptoKey: `p256ecdsa=${publicKeyBase64}`,
  };
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  privateKeyJwk: JsonWebKey,
  publicKeyBase64: string
): Promise<boolean> {
  try {
    const vapid = await createVapidJwt(subscription.endpoint, privateKeyJwk, publicKeyBase64);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapid.authorization,
        "Crypto-Key": vapid.cryptoKey,
        TTL: "60",
        "Content-Length": "0",
        Urgency: "normal",
      },
    });

    if (!response.ok) {
      console.error(`Push failed for ${subscription.endpoint}: ${response.status} ${await response.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Push error for ${subscription.endpoint}:`, err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get VAPID keys
    const { data: vapidKeys, error: vapidError } = await supabase
      .from("vapid_keys")
      .select("*")
      .limit(1)
      .single();

    if (vapidError || !vapidKeys) {
      return new Response(JSON.stringify({ error: "No VAPID keys configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      subscriptions.map((sub) =>
        sendPushNotification(sub, vapidKeys.private_key_jwk, vapidKeys.public_key_base64)
      )
    );

    // Remove failed subscriptions (likely expired)
    const failedEndpoints = subscriptions
      .filter((_, i) => !results[i])
      .map((sub) => sub.endpoint);

    if (failedEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", failedEndpoints);
    }

    const sent = results.filter(Boolean).length;
    console.log(`Sent ${sent}/${subscriptions.length} push notifications`);

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-daily-reminder error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

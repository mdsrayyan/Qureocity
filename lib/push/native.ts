import { createSign } from "node:crypto";
import type { PushMessage } from "./events";

// Push to the Android app (mobile/) through Firebase Cloud Messaging.
//
// App devices are stored in push_subscriptions like browsers, with an
// endpoint of NATIVE_ENDPOINT_PREFIX + <FCM token>, so recipient lookup,
// pruning and the delivery log need no changes.
//
// Needs one server env var: FIREBASE_SERVICE_ACCOUNT — the full JSON of a
// Firebase service-account key (Firebase console → Project settings →
// Service accounts → Generate new private key).

import { NATIVE_ENDPOINT_PREFIX, isNativeEndpoint } from "./nativeEndpoint";

export { isNativeEndpoint };

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

export function nativePushIsConfigured(): boolean {
  return serviceAccount() !== null;
}

let cachedToken: { value: string; expires: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

// OAuth access token for the FCM API, from a self-signed service-account JWT.
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expires - 60 > now) return cachedToken.value;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(sa.private_key.replace(/\\n/g, "\n")));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token request failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expires: now + json.expires_in };
  return json.access_token;
}

export type NativeSendResult = "sent" | "gone" | "failed";

export async function sendNativePush(
  endpoint: string,
  message: PushMessage,
  ttlSeconds: number,
): Promise<NativeSendResult> {
  const sa = serviceAccount();
  if (!sa) {
    console.error("[push] app device skipped: FIREBASE_SERVICE_ACCOUNT not set");
    return "failed";
  }
  const token = endpoint.slice(NATIVE_ENDPOINT_PREFIX.length);
  if (!token) return "gone";

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await accessToken(sa)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            // Data-only so the app always builds the notification itself
            // (same tag/grouping behaviour as the browser service worker).
            data: {
              title: message.title,
              body: message.body,
              url: message.url,
              tag: message.tag,
              ...(message.group ? { group: message.group.plural } : {}),
            },
            android: { priority: "HIGH", ttl: `${ttlSeconds}s` },
          },
        }),
      },
    );
    if (res.ok) return "sent";
    const text = await res.text();
    // Uninstalled app / token rotated: FCM answers 404 UNREGISTERED (or
    // 400 for a malformed token).
    if (res.status === 404 || /UNREGISTERED|registration token is not a valid/i.test(text)) {
      return "gone";
    }
    console.error("[push] FCM send failed", res.status, text.slice(0, 300));
    return "failed";
  } catch (err) {
    console.error("[push] FCM send failed", (err as Error).message);
    return "failed";
  }
}

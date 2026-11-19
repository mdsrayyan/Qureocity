// Android-app devices are saved in push_subscriptions with this endpoint
// prefix + their Firebase token (see lib/push/native.ts). Shared by the
// browser and server code, so it must not import anything server-only.
export const NATIVE_ENDPOINT_PREFIX = "https://fcm.googleapis.com/qureocity-native/";

// The subscriptions table requires non-empty Web Push keys; app devices
// don't have any, so they store this placeholder.
export const NATIVE_KEY_PLACEHOLDER = "native-app";

export function isNativeEndpoint(endpoint: string): boolean {
  return endpoint.startsWith(NATIVE_ENDPOINT_PREFIX);
}

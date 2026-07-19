"use client";

import { apiClient } from "./api/client";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Subscribe the current browser to web push. Returns true on success. */
export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "Push isn't supported in this browser." };
  }
  const { data } = await apiClient.get<{ public_key: string | null; enabled: boolean }>(
    "/push/vapid-public-key",
  );
  if (!data.enabled || !data.public_key) {
    return { ok: false, reason: "Push notifications aren't enabled on the server." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notification permission denied." };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.public_key),
  });

  const json = sub.toJSON();
  await apiClient.post("/push/subscribe", {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });
  return { ok: true };
}

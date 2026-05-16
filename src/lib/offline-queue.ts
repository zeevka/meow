import type { OfflineMutation } from "@/lib/types";

const DEVICE_KEY = "pantry-paper-device-id";
const QUEUE_PREFIX = "pantry-paper-queue:";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getDeviceId() {
  const storage = getStorage();
  if (!storage) {
    return "server-device";
  }

  const existing = storage.getItem(DEVICE_KEY);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  storage.setItem(DEVICE_KEY, created);
  return created;
}

function getQueueKey(shareSlug: string) {
  return `${QUEUE_PREFIX}${shareSlug}`;
}

export function readOfflineQueue(shareSlug: string): OfflineMutation[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(getQueueKey(shareSlug));
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as OfflineMutation[];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(
  shareSlug: string,
  queue: OfflineMutation[],
) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(getQueueKey(shareSlug), JSON.stringify(queue));
}

export function enqueueOfflineMutation(mutation: OfflineMutation) {
  const queue = readOfflineQueue(mutation.shareSlug);
  writeOfflineQueue(mutation.shareSlug, [...queue, mutation]);
}

export function removeOfflineMutation(shareSlug: string, mutationId: string) {
  const queue = readOfflineQueue(shareSlug);
  writeOfflineQueue(
    shareSlug,
    queue.filter((entry) => entry.id !== mutationId),
  );
}


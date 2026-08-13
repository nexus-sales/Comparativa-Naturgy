import type { Segment, Tariff, ClientComparison, Notice } from "../types";

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Wraps a call so every call site keeps the { data, error } shape the app
// already uses throughout (mirrors the previous Supabase client's return
// shape, so component code didn't need a second rewrite pass).
async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; error: Error | null }> {
  try {
    return { data: await promise, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export const api = {
  auth: {
    login: (password: string) => safe(request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) })),
    logout: () => safe(request<{ ok: true }>("/auth/logout", { method: "POST" })),
    me: () => request<{ authenticated: boolean }>("/auth/me"),
  },

  segments: {
    list: () => safe(request<Segment[]>("/segments")),
    update: (id: string, patch: Partial<Segment>) =>
      safe(request<Segment>(`/segments/${id}`, { method: "PUT", body: JSON.stringify(patch) })),
  },

  tariffs: {
    list: () => safe(request<Tariff[]>("/tariffs")),
    create: (payload: Partial<Tariff>) => safe(request<Tariff>("/tariffs", { method: "POST", body: JSON.stringify(payload) })),
    update: (id: string, payload: Partial<Tariff>) =>
      safe(request<Tariff>(`/tariffs/${id}`, { method: "PUT", body: JSON.stringify(payload) })),
    remove: (id: string) => safe(request<void>(`/tariffs/${id}`, { method: "DELETE" })),
    deactivate: (ids: string[]) => safe(request<{ updated: number }>("/tariffs/deactivate", { method: "PATCH", body: JSON.stringify({ ids }) })),
  },

  comparisons: {
    list: (limit?: number) => safe(request<ClientComparison[]>(`/comparisons${limit ? `?limit=${limit}` : ""}`)),
    create: (payload: Record<string, unknown>) =>
      safe(request<ClientComparison>("/comparisons", { method: "POST", body: JSON.stringify(payload) })),
    softDelete: (id: string) =>
      safe(request<ClientComparison>(`/comparisons/${id}`, { method: "PATCH", body: JSON.stringify({ deleted_by_user: true }) })),
  },

  notices: {
    list: (onlyActive?: boolean) => safe(request<Notice[]>(`/notices${onlyActive ? "?active=true" : ""}`)),
    create: (payload: Partial<Notice>) => safe(request<Notice>("/notices", { method: "POST", body: JSON.stringify(payload) })),
    update: (id: string, payload: Partial<Notice>) =>
      safe(request<Notice>(`/notices/${id}`, { method: "PUT", body: JSON.stringify(payload) })),
  },
};

export function withTimeout<T>(promise: Promise<T>, ms = 15_000, message = "Tiempo de espera agotado. Comprueba tu conexión e inténtalo de nuevo."): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

"use client";

export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    // An expired session sends the user back to sign in; a failed sign-in attempt must show its own error.
    if (res.status === 401 && !url.endsWith("/api/admin/login")) {
      window.location.href = "/admin/login";
    }
    return { ok: false, message: data?.error?.message ?? "Request failed", fields: data?.error?.fields };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

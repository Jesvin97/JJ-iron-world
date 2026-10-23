"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

type Item = { id: string; slug: string | null; name: string; active: boolean; url: string };

export function CampaignManager({ items, canEdit }: { items: Item[]; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await api("/api/admin/campaigns", "POST", { name, slug });
    if (r.ok) {
      setName("");
      setSlug("");
      router.refresh();
    } else setError(r.fields?.slug ?? r.fields?.name ?? r.message);
  }
  async function toggle(id: string, active: boolean) {
    const r = await api(`/api/admin/campaigns/${id}`, "PATCH", { active });
    if (r.ok) router.refresh();
    else setError(r.message);
  }

  return (
    <>
      {canEdit && (
        <form method="post" action="/admin/qr" onSubmit={create} className="grid gap-3 rounded-2xl border border-champagne/40 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <div><label className="label" htmlFor="c-name">Location name</label><input id="c-name" required maxLength={60} className="field" placeholder="Reception desk" value={name} onChange={(e) => { setName(e.target.value); if (!slug || slug === toSlug(name)) setSlug(toSlug(e.target.value)); }} /></div>
          <div><label className="label" htmlFor="c-slug">Identifier</label><input id="c-slug" required maxLength={40} pattern="[a-z0-9][a-z0-9\-]*" className="field" placeholder="reception" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div className="flex items-end"><button className="btn-primary btn-sm w-full sm:w-auto">Add location</button></div>
          {error && <p role="alert" className="text-sm text-red-800 sm:col-span-3">{error}</p>}
        </form>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => {
          const q = c.slug ? `campaign=${encodeURIComponent(c.slug)}&` : "";
          return (
            <li key={c.id} className={`rounded-2xl border border-champagne/40 bg-white p-4 ${c.active ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{c.name}</h2>{!c.active && <span className="text-xs font-semibold text-cocoa-soft">Inactive</span>}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/qr?${q}format=png`} alt={`QR code for ${c.name}`} width={180} height={180} className="mx-auto my-3 h-44 w-44 rounded-lg border border-champagne/40" />
              <p className="break-all text-xs text-cocoa-soft">{c.url}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="btn-outline btn-sm" href={`/api/admin/qr?${q}format=png&download=1`}>PNG</a>
                <a className="btn-outline btn-sm" href={`/api/admin/qr?${q}format=svg&download=1`}>SVG</a>
                <a className="btn-gold btn-sm" href={`/admin/qr/print${c.slug ? `?c=${encodeURIComponent(c.slug)}` : ""}`} target="_blank" rel="noopener">Print card</a>
                {canEdit && c.slug && <button className="btn-outline btn-sm" onClick={() => toggle(c.id, !c.active)}>{c.active ? "Deactivate" : "Activate"}</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

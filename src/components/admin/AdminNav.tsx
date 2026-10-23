"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/reviews", label: "Google reviews" },
  { href: "/admin/qr", label: "QR codes" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ email, role }: { email: string; role: string }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <header className="no-print border-b border-champagne/50 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="mr-auto font-serif text-xl sm:mr-0">Glam’more <span className="text-sm text-cocoa-soft">Admin</span></span>
        <nav aria-label="Admin" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:overflow-visible sm:px-0">
          {LINKS.map((l) => {
            const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-cocoa text-ivory" : "text-cocoa hover:bg-sand"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-cocoa-soft sm:inline">
            {email} · {role === "ADMIN" ? "Admin" : "View only"}
          </span>
          <button onClick={logout} className="btn-outline btn-sm">Sign out</button>
        </div>
      </div>
    </header>
  );
}

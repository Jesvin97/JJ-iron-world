import { AdminNav } from "@/components/admin/AdminNav";
import { requirePageAdmin } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePageAdmin();
  return (
    <div className="min-h-screen bg-[#f8f4ee]">
      <AdminNav email={admin.email} role={admin.role} />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}

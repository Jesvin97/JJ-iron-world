import { requirePageAdmin } from "@/lib/admin-page";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ReviewTracker } from "@/components/admin/ReviewTracker";

export const metadata = { title: "Google reviews – Admin" };

export default async function ReviewsPage() {
  const admin = await requirePageAdmin();
  const [items, settings] = await Promise.all([db.publicReview.findMany({ orderBy: { postedAt: "desc" }, take: 200 }), getSettings()]);
  const serial = items.map((r) => ({ ...r, postedAt: r.postedAt.toISOString(), reportedAt: r.reportedAt?.toISOString() ?? null, resolvedAt: r.resolvedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
  return <ReviewTracker initial={serial} salon={settings.businessName} canEdit={admin.role === "ADMIN"} />;
}

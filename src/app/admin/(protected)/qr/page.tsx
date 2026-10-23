import { requirePageAdmin } from "@/lib/admin-page";
import { db } from "@/lib/db";
import { reviewUrl } from "@/lib/qr";
import { CampaignManager } from "@/components/admin/CampaignManager";

export const metadata = { title: "QR codes – Admin" };

export default async function QrPage() {
  const admin = await requirePageAdmin();
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "asc" } });
  const items = [{ id: "general", slug: null as string | null, name: "General (no location)", active: true }, ...campaigns].map((c) => ({
    ...c,
    url: reviewUrl(c.slug),
  }));
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">QR codes</h1>
      <p className="text-cocoa-soft">
        Each QR code opens the review page. Use a separate location per placement (reception, mirror, checkout&hellip;) to see which codes get scanned.
        Scans are counted as page opens and store no personal data.
      </p>
      <CampaignManager items={items} canEdit={admin.role === "ADMIN"} />
    </div>
  );
}

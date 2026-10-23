import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { qrPng, qrSvg, reviewUrl } from "@/lib/qr";
import { campaignSlugSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/admin/qr?campaign=reception&format=png|svg[&download=1] */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  const u = new URL(req.url);
  const slug = u.searchParams.get("campaign");
  if (slug && !campaignSlugSchema.safeParse(slug).success) return apiError(400, "validation_error", "Invalid campaign");
  const format = u.searchParams.get("format") === "svg" ? "svg" : "png";
  const target = reviewUrl(slug, u.origin);
  const name = `glamore-qr-${slug || "general"}.${format}`;
  const disposition = u.searchParams.get("download") ? `attachment; filename="${name}"` : "inline";

  if (format === "svg") {
    return new Response(await qrSvg(target), { headers: { "content-type": "image/svg+xml", "content-disposition": disposition } });
  }
  return new Response(new Uint8Array(await qrPng(target)), { headers: { "content-type": "image/png", "content-disposition": disposition } });
}

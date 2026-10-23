import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/http";
import { getOverview, parseRange } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  return json(await getOverview(parseRange(new URL(req.url).searchParams.get("range"))));
}

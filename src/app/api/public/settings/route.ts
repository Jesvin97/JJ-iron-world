import { getSettings, toPublicSettings } from "@/lib/settings";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(toPublicSettings(await getSettings()));
}

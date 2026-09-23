import { handleSheetSync } from "@/http/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleSheetSync(request);
}

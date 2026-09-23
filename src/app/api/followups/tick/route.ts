import { handleFollowupTick } from "@/http/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handleFollowupTick();
}

export async function GET() {
  return handleFollowupTick();
}

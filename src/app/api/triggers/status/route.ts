import { handleTriggerStatus } from "@/http/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handleTriggerStatus();
}

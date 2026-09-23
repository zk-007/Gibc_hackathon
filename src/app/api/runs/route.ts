import { handleListRuns } from "@/http/handlers";

export function GET() {
  return handleListRuns();
}

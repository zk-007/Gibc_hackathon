import { handleHealth } from "@/http/handlers";

export function GET() {
  return handleHealth();
}

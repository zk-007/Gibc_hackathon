import { handleReport } from "@/http/handlers";

export function POST(request: Request) {
  return handleReport(request);
}

export function GET(request: Request) {
  return handleReport(request);
}

import { handleIngest } from "@/http/handlers";

export function POST(request: Request) {
  return handleIngest(request);
}

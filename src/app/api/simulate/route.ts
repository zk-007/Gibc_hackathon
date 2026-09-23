import { handleSimulate } from "@/http/handlers";

export function POST(request: Request) {
  return handleSimulate(request);
}

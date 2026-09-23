import { handleCompile } from "@/http/handlers";

export function POST(request: Request) {
  return handleCompile(request);
}

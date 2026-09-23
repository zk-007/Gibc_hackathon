import { handleExecute } from "@/http/handlers";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleExecute(request, context);
}

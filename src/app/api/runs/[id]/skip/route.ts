import { handleSkip } from "@/http/handlers";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleSkip(request, context);
}

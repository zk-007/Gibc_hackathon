import { handleApprove } from "@/http/handlers";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApprove(request, context);
}

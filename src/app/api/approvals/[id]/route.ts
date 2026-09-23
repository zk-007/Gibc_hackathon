import { handleApproval } from "@/http/handlers";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApproval(request, context);
}

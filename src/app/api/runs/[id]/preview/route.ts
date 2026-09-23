import { handlePreview } from "@/http/handlers";

export function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handlePreview(request, context);
}

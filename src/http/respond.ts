export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  if (/not found/i.test(message)) return jsonError(message, 404);
  if (/cannot resolve|only edit/i.test(message)) return jsonError(message, 409);
  return jsonError(message, 400);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function routeId(
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<string> {
  const params = await Promise.resolve(context.params);
  return decodeURIComponent(params.id);
}

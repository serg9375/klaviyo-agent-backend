import { buildOpenApi } from "@/lib/openapi";

export function GET(request: Request) {
  return Response.json(buildOpenApi(new URL(request.url).origin));
}

import "server-only";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "./rate-limit";
import type { UniswapApiResult } from "./uniswap-client";
import { ValidationError } from "./validation";

/** Devuelve una respuesta 429 si el caller superó el límite, o null si puede continuar. */
export function enforceRateLimit(request: Request, routeKey: string): NextResponse | null {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`${routeKey}:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests, slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }
  return null;
}

/** Propaga el status y el body de la Trading API tal cual, para que el cliente vea el error real. */
export function passthroughResponse<T>(result: UniswapApiResult<T>): NextResponse {
  return NextResponse.json(result.data, { status: result.status });
}

/**
 * Ejecuta el handler y traduce errores de validación a 400 con mensaje claro.
 * Cualquier otro error (red, config) se reporta como 502 sin filtrar detalles internos.
 */
export async function runHandler(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error("Trading API proxy error:", error);
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}

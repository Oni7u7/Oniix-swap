import { isHex } from "viem";
import { NextResponse } from "next/server";
import { enforceRateLimit, passthroughResponse, runHandler } from "@/lib/api-handler";
import { prepareSwapRequestBody, uniswapApiFetch } from "@/lib/uniswap-client";
import { ValidationError } from "@/lib/validation";
import type { SwapResponse } from "@/lib/types/trading-api";

const KNOWN_ROUTING_TYPES = new Set([
  "CLASSIC",
  "WRAP",
  "UNWRAP",
  "BRIDGE",
  "DUTCH_V2",
  "DUTCH_V3",
  "PRIORITY",
  "DUTCH_LIMIT",
  "LIMIT_ORDER",
  "QUICKROUTE",
]);

/**
 * El cliente manda { quoteResponse, signature? } donde quoteResponse es EXACTAMENTE
 * lo que devolvió /api/quote (no un objeto reconstruido a mano). No podemos validar
 * cada campo porque la forma cambia según `routing`, pero sí rechazamos basura obvia
 * antes de gastar cuota de la API key: debe traer un `routing` conocido y un `quote`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "swap");
  if (limited) return limited;

  return runHandler(async () => {
    const body = await request.json();

    const quoteResponse = body.quoteResponse;
    if (!quoteResponse || typeof quoteResponse !== "object") {
      throw new ValidationError("quoteResponse is required");
    }
    if (typeof quoteResponse.routing !== "string" || !KNOWN_ROUTING_TYPES.has(quoteResponse.routing)) {
      throw new ValidationError(`Invalid or missing quoteResponse.routing: ${String(quoteResponse.routing)}`);
    }
    if (!quoteResponse.quote || typeof quoteResponse.quote !== "object") {
      throw new ValidationError("quoteResponse.quote is required");
    }

    let signature: string | undefined;
    if (body.signature !== undefined) {
      if (typeof body.signature !== "string" || !isHex(body.signature)) {
        throw new ValidationError("Invalid signature");
      }
      signature = body.signature;
    }

    const swapRequestBody = prepareSwapRequestBody(quoteResponse, signature);

    const result = await uniswapApiFetch<SwapResponse>("/swap", swapRequestBody);
    return passthroughResponse(result);
  });
}

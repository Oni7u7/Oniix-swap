import { NextResponse } from "next/server";
import { enforceRateLimit, passthroughResponse, runHandler } from "@/lib/api-handler";
import {
  DEFAULT_SLIPPAGE_PERCENT,
  MAX_SLIPPAGE_PERCENT,
  MIN_SLIPPAGE_PERCENT,
} from "@/lib/constants";
import { uniswapApiFetch } from "@/lib/uniswap-client";
import {
  assertBaseUnitsAmount,
  assertSlippage,
  assertSupportedChainId,
  assertTokenAddress,
  ValidationError,
} from "@/lib/validation";
import type { QuoteRequestBody, QuoteResponse } from "@/lib/types/trading-api";

// La Trading API real solo acepta estos dos valores (verificado en vivo) — "CLASSIC",
// que sí aparece en la skill, da 400 RequestValidationError.
const ALLOWED_ROUTING_PREFERENCES = new Set(["BEST_PRICE", "FASTEST"]);
const ALLOWED_PROTOCOLS = new Set(["V2", "V3", "V4"]);
const ALLOWED_TYPES = new Set(["EXACT_INPUT", "EXACT_OUTPUT"]);

/** /quote es solo lectura y gratis en la Trading API, pero igual validamos todo antes de reenviar. */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "quote");
  if (limited) return limited;

  return runHandler(async () => {
    const body = await request.json();

    const swapper = assertTokenAddress(body.swapper, "swapper");
    const tokenIn = assertTokenAddress(body.tokenIn, "tokenIn");
    const tokenOut = assertTokenAddress(body.tokenOut, "tokenOut");
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
      throw new ValidationError("tokenIn and tokenOut must be different");
    }

    const tokenInChainId = assertSupportedChainId(body.tokenInChainId);
    const tokenOutChainId = assertSupportedChainId(body.tokenOutChainId);
    if (tokenInChainId !== tokenOutChainId) {
      // El MVP no soporta BRIDGE cross-chain; ambas cadenas deben coincidir.
      throw new ValidationError("Cross-chain quotes are not supported in this app");
    }

    const amount = assertBaseUnitsAmount(body.amount, "amount");

    const type = typeof body.type === "string" && ALLOWED_TYPES.has(body.type) ? body.type : undefined;
    if (!type) throw new ValidationError(`Invalid type: ${String(body.type)}`);

    const slippageTolerance = assertSlippage(body.slippageTolerance ?? DEFAULT_SLIPPAGE_PERCENT);
    if (slippageTolerance < MIN_SLIPPAGE_PERCENT || slippageTolerance > MAX_SLIPPAGE_PERCENT) {
      throw new ValidationError(`slippageTolerance out of range: ${slippageTolerance}`);
    }

    let routingPreference: QuoteRequestBody["routingPreference"];
    if (body.routingPreference !== undefined) {
      if (typeof body.routingPreference !== "string" || !ALLOWED_ROUTING_PREFERENCES.has(body.routingPreference)) {
        throw new ValidationError(`Invalid routingPreference: ${String(body.routingPreference)}`);
      }
      routingPreference = body.routingPreference;
    }

    let protocols: QuoteRequestBody["protocols"];
    if (body.protocols !== undefined) {
      if (!Array.isArray(body.protocols) || !body.protocols.every((p: unknown) => typeof p === "string" && ALLOWED_PROTOCOLS.has(p))) {
        throw new ValidationError("Invalid protocols");
      }
      protocols = body.protocols;
    }

    const requestBody: QuoteRequestBody = {
      swapper,
      tokenIn,
      tokenOut,
      // La Trading API espera estos como STRING, no number.
      tokenInChainId: String(tokenInChainId),
      tokenOutChainId: String(tokenOutChainId),
      amount,
      type,
      slippageTolerance,
      ...(routingPreference ? { routingPreference } : {}),
      ...(protocols ? { protocols } : {}),
    };

    const result = await uniswapApiFetch<QuoteResponse>("/quote", requestBody);
    return passthroughResponse(result);
  });
}

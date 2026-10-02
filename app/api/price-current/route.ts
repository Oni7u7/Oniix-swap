import { NextResponse } from "next/server";
import { enforceRateLimit, passthroughResponse, runHandler } from "@/lib/api-handler";
import { alchemyPricesFetch } from "@/lib/alchemy-prices-client";
import { assertTokenSymbol, ValidationError } from "@/lib/validation";
import type { CurrentPriceBySymbolResponse } from "@/lib/types/prices-api";

/**
 * Solo por símbolo en este MVP (a diferencia de /price-history, que sí soporta fallback
 * por dirección) — todos los tokens de nuestra tabla (lib/tokens.ts) tienen símbolo
 * global claro (ETH, USDC, DAI, WBTC, POL...), así que no hace falta el fallback acá.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "price-current");
  if (limited) return limited;

  return runHandler(async () => {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol");
    if (!rawSymbol) {
      throw new ValidationError('Missing required query param "symbol"');
    }
    const symbol = assertTokenSymbol(rawSymbol, "symbol");

    const result = await alchemyPricesFetch<CurrentPriceBySymbolResponse>("/tokens/by-symbol", {
      method: "GET",
      query: { symbols: symbol },
    });
    return passthroughResponse(result);
  });
}

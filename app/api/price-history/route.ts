import { NextResponse } from "next/server";
import { enforceRateLimit, passthroughResponse, runHandler } from "@/lib/api-handler";
import { alchemyPricesFetch } from "@/lib/alchemy-prices-client";
import { ALCHEMY_NETWORK_SLUG } from "@/lib/chains";
import { assertAddress, assertSupportedChainId, assertTokenSymbol, ValidationError } from "@/lib/validation";
import type {
  HistoricalPriceResponseByAddress,
  HistoricalPriceResponseBySymbol,
  PricesInterval,
} from "@/lib/types/prices-api";

const TIMEFRAMES = ["1H", "1D", "1S", "1M"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * Mapeo timeframe -> (interval, rango). Respeta los límites documentados de la Alchemy
 * Prices API por interval: 5m hasta 7 días, 1h hasta 30 días, 1d hasta 1 año.
 */
const TIMEFRAME_CONFIG: Record<Timeframe, { interval: PricesInterval; rangeMs: number }> = {
  "1H": { interval: "5m", rangeMs: 60 * 60 * 1000 },
  "1D": { interval: "1h", rangeMs: 24 * 60 * 60 * 1000 },
  "1S": { interval: "1h", rangeMs: 7 * 24 * 60 * 60 * 1000 },
  "1M": { interval: "1d", rangeMs: 30 * 24 * 60 * 60 * 1000 },
};

function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === "string" && (TIMEFRAMES as readonly string[]).includes(value);
}

/**
 * Body: { symbol, timeframe } para tokens con símbolo global claro (ETH, USDC, DAI...),
 * o { chainId, address, timeframe } como fallback por dirección para el resto. El rango
 * de tiempo se calcula server-side a partir del timeframe (no se confía en startTime/
 * endTime arbitrarios del cliente, así siempre respetan los límites por interval).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "price-history");
  if (limited) return limited;

  return runHandler(async () => {
    const body = await request.json();

    const timeframe: unknown = body.timeframe;
    if (!isTimeframe(timeframe)) {
      throw new ValidationError(`Invalid timeframe: ${String(timeframe)}. Debe ser uno de ${TIMEFRAMES.join(", ")}`);
    }
    const { interval, rangeMs } = TIMEFRAME_CONFIG[timeframe];

    const now = Date.now();
    const endTime = new Date(now).toISOString();
    const startTime = new Date(now - rangeMs).toISOString();

    const hasSymbol = body.symbol !== undefined;
    const hasAddress = body.address !== undefined || body.chainId !== undefined;
    if (hasSymbol === hasAddress) {
      throw new ValidationError('Provide exactly one of "symbol" or "chainId"+"address"');
    }

    if (hasSymbol) {
      const symbol = assertTokenSymbol(body.symbol, "symbol");
      const result = await alchemyPricesFetch<HistoricalPriceResponseBySymbol>("/tokens/historical", {
        method: "POST",
        body: { symbol, startTime, endTime, interval },
      });
      return passthroughResponse(result);
    }

    const chainId = assertSupportedChainId(body.chainId);
    const address = assertAddress(body.address, "address");
    const network = ALCHEMY_NETWORK_SLUG[chainId];
    const result = await alchemyPricesFetch<HistoricalPriceResponseByAddress>("/tokens/historical", {
      method: "POST",
      body: { network, address, startTime, endTime, interval },
    });
    return passthroughResponse(result);
  });
}

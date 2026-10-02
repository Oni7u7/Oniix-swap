"use client";

import { useQuery } from "@tanstack/react-query";
import { PriceApiError } from "./usePriceHistory";

async function fetchCurrentPrice(symbol: string): Promise<number> {
  const response = await fetch(`/api/price-current?symbol=${encodeURIComponent(symbol)}`);
  const data = await response.json();
  if (!response.ok) throw new PriceApiError(response.status, data);

  const entry = data.data?.[0];
  const usdPrice = entry?.prices?.find((p: { currency: string }) => p.currency === "usd")?.value;
  if (typeof usdPrice !== "string") {
    throw new Error(`No hay precio actual en USD disponible para ${symbol}`);
  }
  const value = Number(usdPrice);
  if (!Number.isFinite(value)) {
    throw new Error(`Precio actual inválido recibido para ${symbol}: "${usdPrice}"`);
  }
  return value;
}

/** Independiente del hot-path de quote/swap — mismo criterio que usePriceHistory. */
export function usePriceCurrent(symbol: string | null) {
  return useQuery({
    queryKey: ["price-current", symbol],
    queryFn: () => fetchCurrentPrice(symbol!),
    enabled: symbol !== null,
    staleTime: 30_000,
    retry: false,
  });
}

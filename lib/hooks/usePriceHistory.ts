"use client";

import { useQuery } from "@tanstack/react-query";

export const PRICE_TIMEFRAMES = ["1H", "1D", "1S", "1M"] as const;
export type PriceTimeframe = (typeof PRICE_TIMEFRAMES)[number];

export interface PricePoint {
  /** Unix timestamp en segundos, formato que espera lightweight-charts. */
  time: number;
  value: number;
}

interface PriceApiErrorBody {
  error?: string;
  detail?: string;
  [key: string]: unknown;
}

export class PriceApiError extends Error {
  status: number;
  constructor(status: number, body: PriceApiErrorBody) {
    super(body.detail ?? body.error ?? `Price history request failed with status ${status}`);
    this.name = "PriceApiError";
    this.status = status;
  }
}

async function fetchPriceHistory(symbol: string, timeframe: PriceTimeframe): Promise<PricePoint[]> {
  const response = await fetch("/api/price-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, timeframe }),
  });
  const data = await response.json();
  if (!response.ok) throw new PriceApiError(response.status, data);

  const points = (data.data ?? []) as { value: string; timestamp: string }[];
  // "value" viene como STRING de la API — convertir antes de graficar (Number, no parseFloat
  // a secas, para que un valor corrupto dé NaN detectable en vez de un parseo parcial silencioso).
  return points
    .map((p) => ({
      time: Math.floor(new Date(p.timestamp).getTime() / 1000),
      value: Number(p.value),
    }))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
}

/**
 * Independiente del hot-path de quote/swap a propósito: query key y caché propios, sin
 * debounce ni refetchInterval compartido con useDebouncedQuote — un fallo o lentitud acá
 * no le agrega latencia al swap.
 */
export function usePriceHistory(symbol: string | null, timeframe: PriceTimeframe) {
  return useQuery({
    queryKey: ["price-history", symbol, timeframe],
    queryFn: () => fetchPriceHistory(symbol!, timeframe),
    enabled: symbol !== null,
    staleTime: 30_000,
    retry: false,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { QUOTE_DEBOUNCE_MS, QUOTE_REFRESH_INTERVAL_MS } from "@/lib/constants";
import type { QuoteRequestType, QuoteResponse, RoutingPreference } from "@/lib/types/trading-api";
import { useDebouncedValue } from "./useDebouncedValue";

export interface QuoteParams {
  chainId: number;
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  amountBaseUnits: string;
  type: QuoteRequestType;
  slippageTolerance: number;
  routingPreference?: RoutingPreference;
}

interface QuoteApiErrorBody {
  error?: string;
  detail?: string;
  [key: string]: unknown;
}

export class QuoteRequestError extends Error {
  status: number;
  body: QuoteApiErrorBody;

  constructor(status: number, body: QuoteApiErrorBody) {
    super(body.detail ?? body.error ?? `Quote request failed with status ${status}`);
    this.name = "QuoteRequestError";
    this.status = status;
    this.body = body;
  }
}

async function fetchQuote(params: QuoteParams): Promise<QuoteResponse> {
  // El body de /api/quote usa el shape de la Trading API (tokenInChainId/tokenOutChainId,
  // amount), que no es 1:1 con QuoteParams (chainId, amountBaseUnits) — mapear a mano acá,
  // NUNCA hacer JSON.stringify(params) directo o el server recibe chainId/amount undefined.
  const requestBody = {
    swapper: params.swapper,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    tokenInChainId: params.chainId,
    tokenOutChainId: params.chainId,
    amount: params.amountBaseUnits,
    type: params.type,
    slippageTolerance: params.slippageTolerance,
    ...(params.routingPreference ? { routingPreference: params.routingPreference } : {}),
  };

  const response = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new QuoteRequestError(response.status, data);
  }
  return data as QuoteResponse;
}

/**
 * Cotiza con debounce al escribir, refresca sola cada ~12s mientras el componente
 * esté montado y los params sean válidos (refetchInterval de TanStack Query hace
 * esto automáticamente), y expone isRefreshing para que la UI muestre "actualizando"
 * en los refrescos de fondo (a diferencia de la carga inicial).
 */
export function useDebouncedQuote(params: QuoteParams | null) {
  // Serializar a string primero: así el debounce solo resetea su timer cuando el
  // CONTENIDO cambia, no en cada re-render del componente padre (que crea un objeto
  // params nuevo aunque los valores sean iguales).
  const paramsKey = params ? JSON.stringify(params) : null;
  const debouncedKey = useDebouncedValue(paramsKey, QUOTE_DEBOUNCE_MS);
  const debouncedParams = useMemo<QuoteParams | null>(
    () => (debouncedKey ? (JSON.parse(debouncedKey) as QuoteParams) : null),
    [debouncedKey]
  );

  const query = useQuery({
    queryKey: ["quote", debouncedKey],
    queryFn: () => fetchQuote(debouncedParams!),
    enabled: debouncedParams !== null,
    refetchInterval: QUOTE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    retry: false,
  });

  // isFetching sin isLoading = refresco en segundo plano (ya había un quote en pantalla).
  const isRefreshing = query.isFetching && !query.isLoading;

  return {
    quote: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing,
    error: (query.error as QuoteRequestError | null) ?? null,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

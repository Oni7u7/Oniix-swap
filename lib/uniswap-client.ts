import "server-only";
import { TRADING_API_BASE_URL, UNIVERSAL_ROUTER_VERSION } from "./constants";

export interface UniswapApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * POST server-only a la Trading API de Uniswap. NUNCA se llama desde el cliente:
 * el x-api-key vive solo aquí. Devuelve status+body tal cual los responde Uniswap
 * (incluso en error) para que los Route Handlers puedan propagarlos al frontend
 * en vez de aplastarlos en un 500 genérico.
 */
export async function uniswapApiFetch<T = unknown>(path: string, body: unknown): Promise<UniswapApiResult<T>> {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    throw new Error("UNISWAP_API_KEY is not configured on the server");
  }

  const response = await fetch(`${TRADING_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-universal-router-version": UNIVERSAL_ROUTER_VERSION,
    },
    body: JSON.stringify(body),
    // Los quotes expiran rápido; nunca sirve cachear estas llamadas.
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}

const UNISWAPX_ROUTING_TYPES = new Set(["DUTCH_V2", "DUTCH_V3", "PRIORITY"]);

/**
 * Prepara el body de /swap a partir de la respuesta de /quote, siguiendo las reglas
 * de la skill swap-integration:
 * - Nunca envolver el quote en {quote: ...}: se hace spread directo.
 * - permitData/permitTransaction se eliminan del spread y se re-agregan a mano.
 * - CLASSIC/WRAP/UNWRAP/BRIDGE: signature + permitData van juntos, o ninguno.
 * - DUTCH_V2/V3/PRIORITY (UniswapX): solo signature; permitData NUNCA se envía
 *   (el schema de /swap lo rechaza, la orden ya está en quote.encodedOrder).
 */
export function prepareSwapRequestBody(
  quoteResponse: Record<string, unknown>,
  signature?: string
): Record<string, unknown> {
  const permitData = quoteResponse.permitData;
  const request: Record<string, unknown> = { ...quoteResponse };
  delete request.permitData;
  delete request.permitTransaction;

  const isUniswapX = UNISWAPX_ROUTING_TYPES.has(quoteResponse.routing as string);

  if (isUniswapX) {
    if (signature) request.signature = signature;
  } else if (signature && permitData && typeof permitData === "object") {
    request.signature = signature;
    request.permitData = permitData;
  }

  return request;
}

import "server-only";

const PRICES_API_BASE_URL = "https://api.g.alchemy.com/prices/v1";

export interface AlchemyApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

interface AlchemyFetchInit {
  method: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string>;
}

/**
 * Fetch server-only a la Alchemy Prices API. La API key va en la URL (no en un header),
 * así que esto NUNCA se llama desde el cliente.
 *
 * La Prices API exige que el Origin de la petición esté en el allowlist configurado para
 * esta API key en el dashboard de Alchemy — incluso en llamadas servidor-a-servidor sin
 * navegador de por medio. Sin un Origin válido responde
 * `{"error":{"code":-32600,"message":"Unspecified origin not on whitelist."}}`
 * (verificado en vivo). Por eso mandamos el header Origin a mano con
 * ALCHEMY_ALLOWED_ORIGIN — debe ser EXACTAMENTE un origin que esté en el allowlist de
 * esta API key (puede ser una app de Alchemy distinta a la de las RPC_URL_*, revisa su
 * propio allowlist en el dashboard).
 */
export async function alchemyPricesFetch<T = unknown>(path: string, init: AlchemyFetchInit): Promise<AlchemyApiResult<T>> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error("ALCHEMY_API_KEY is not configured on the server");
  }
  const origin = process.env.ALCHEMY_ALLOWED_ORIGIN;
  if (!origin) {
    throw new Error(
      "ALCHEMY_ALLOWED_ORIGIN is not configured on the server — debe ser un origin en el allowlist " +
        "de la API key de Prices en el dashboard de Alchemy (ver README)"
    );
  }

  const url = new URL(`${PRICES_API_BASE_URL}/${apiKey}${path}`);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}

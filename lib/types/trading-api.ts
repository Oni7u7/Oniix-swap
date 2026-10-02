/**
 * Tipos de la Trading API de Uniswap (https://trade-api.gateway.uniswap.org/v1).
 * Reflejan exactamente los esquemas documentados en la skill swap-integration —
 * no inventar campos nuevos aquí sin confirmarlos contra la skill/documentación.
 */

// ---------- /check_approval ----------

export interface CheckApprovalRequestBody {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: number;
}

export interface ApprovalTransaction {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
}

export interface CheckApprovalResponse {
  approval: ApprovalTransaction | null;
}

// ---------- /quote ----------

export type QuoteRequestType = "EXACT_INPUT" | "EXACT_OUTPUT";
// La skill documenta también "CLASSIC", pero la Trading API real (probado en vivo,
// ver README) solo acepta estos dos valores — enviar "CLASSIC" da 400 RequestValidationError.
export type RoutingPreference = "BEST_PRICE" | "FASTEST";

export interface QuoteRequestBody {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  /** OJO: la Trading API espera estos como STRING, no number. */
  tokenInChainId: string;
  tokenOutChainId: string;
  amount: string;
  type: QuoteRequestType;
  slippageTolerance: number;
  routingPreference?: RoutingPreference;
  protocols?: Array<"V2" | "V3" | "V4">;
  autoSlippage?: boolean;
  urgency?: "normal" | "fast";
}

export type ClassicRoutingType = "CLASSIC" | "WRAP" | "UNWRAP" | "BRIDGE";
export type UniswapXRoutingType = "DUTCH_V2" | "DUTCH_V3" | "PRIORITY";
export type RoutingType = ClassicRoutingType | UniswapXRoutingType | "DUTCH_LIMIT" | "LIMIT_ORDER" | "QUICKROUTE";

export interface ClassicQuoteResponse {
  routing: ClassicRoutingType;
  quote: {
    input: { token: string; amount: string };
    output: { token: string; amount: string };
    slippage: number;
    route: unknown[];
    gasFee: string;
    gasFeeUSD: string;
    gasUseEstimate: string;
  };
  permitData: Record<string, unknown> | null;
}

export interface DutchOrderOutput {
  token: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
}

export interface UniswapXQuoteResponse {
  routing: UniswapXRoutingType;
  quote: {
    orderInfo: {
      reactor: string;
      swapper: string;
      nonce: string;
      deadline: number;
      cosigner?: string;
      input: { token: string; startAmount: string; endAmount: string };
      outputs: DutchOrderOutput[];
      chainId: number;
    };
    encodedOrder: string;
    orderHash: string;
  };
  // EIP-712 typed data — firmar localmente, NUNCA enviar a /swap.
  permitData: Record<string, unknown> | null;
}

export type QuoteResponse = ClassicQuoteResponse | UniswapXQuoteResponse;

export function isUniswapXQuote(q: QuoteResponse): q is UniswapXQuoteResponse {
  return q.routing === "DUTCH_V2" || q.routing === "DUTCH_V3" || q.routing === "PRIORITY";
}

/** Monto de salida en el mejor caso: quote.output.amount (CLASSIC) u outputs[0].startAmount (UniswapX). */
export function getQuoteOutputAmount(q: QuoteResponse): string {
  if (isUniswapXQuote(q)) {
    const firstOutput = q.quote.orderInfo.outputs[0];
    if (!firstOutput) throw new Error("UniswapX quote has no outputs");
    return firstOutput.startAmount;
  }
  return q.quote.output.amount;
}

// ---------- /swap ----------

/**
 * Body de /swap: se construye haciendo spread de QuoteResponse y agregando
 * signature/permitData según reglas por routing (ver lib/uniswap-client.ts).
 * No se tipa estrictamente porque su forma depende del routing de origen.
 */
export type SwapRequestBody = Record<string, unknown>;

export interface SwapTransaction {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
}

export interface SwapResponse {
  swap: SwapTransaction;
}

/** Forma de error devuelta por la Trading API (400/404/etc). Se propaga tal cual al cliente. */
export interface TradingApiErrorBody {
  detail?: string;
  errorCode?: string;
  [key: string]: unknown;
}

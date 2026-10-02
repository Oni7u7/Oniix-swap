export const TRADING_API_BASE_URL = "https://trade-api.gateway.uniswap.org/v1";

/** Header requerido por la Trading API en todas las peticiones. */
export const UNIVERSAL_ROUTER_VERSION = "2.0";

/** Contrato Permit2, mismo en todas las redes soportadas. */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

export const DEFAULT_SLIPPAGE_PERCENT = 0.5;
export const MIN_SLIPPAGE_PERCENT = 0.01;
export const MAX_SLIPPAGE_PERCENT = 50;

/** La Trading API suele expirar quotes en ~30s; usamos esto para marcar un quote como stale en UI. */
export const QUOTE_STALE_MS = 30_000;

/** Intervalo de refresco automático del quote mientras el usuario no interactúa. */
export const QUOTE_REFRESH_INTERVAL_MS = 12_000;

/** Debounce al escribir el monto antes de pedir un nuevo quote. */
export const QUOTE_DEBOUNCE_MS = 400;

export const ROUTING_TYPES_GASFUL = ["CLASSIC", "WRAP", "UNWRAP", "BRIDGE"] as const;
export const ROUTING_TYPES_GASLESS = ["DUTCH_V2", "DUTCH_V3", "PRIORITY"] as const;

/**
 * Timeout del wait principal de waitForTransactionReceipt. Con un RPC público lento
 * el default de viem puede agotarse antes de que el receipt esté disponible aunque la
 * tx ya haya confirmado on-chain — de ahí el fallback de polling manual (ver useSwap.ts).
 */
export const RECEIPT_WAIT_TIMEOUT_MS = 120_000;

/** Backoff del polling manual de getTransactionReceipt tras un timeout del wait principal. */
export const RECEIPT_POLL_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000, 30_000];

/**
 * Tipos de la Alchemy Prices API — shape verificado en vivo (ver conversación), NO
 * documentación adivinada. "value" siempre viene como STRING, convertir antes de usar.
 */

export type PricesInterval = "5m" | "1h" | "1d";

export interface HistoricalPricePoint {
  value: string;
  timestamp: string;
  marketCap?: string;
  totalVolume?: string;
}

export interface HistoricalPriceResponseBySymbol {
  symbol: string;
  currency: string;
  data: HistoricalPricePoint[];
}

export interface HistoricalPriceResponseByAddress {
  network: string;
  address: string;
  currency: string;
  data: HistoricalPricePoint[];
}

export interface CurrentPriceEntry {
  currency: string;
  value: string;
  lastUpdatedAt?: string;
}

export interface CurrentPriceBySymbolResult {
  symbol: string;
  prices: CurrentPriceEntry[];
  error?: { message: string } | null;
}

export interface CurrentPriceBySymbolResponse {
  data: CurrentPriceBySymbolResult[];
}

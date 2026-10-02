import { base, mainnet, optimism, polygon, arbitrum } from "viem/chains";
import type { SupportedChainId } from "./chains";

/**
 * Sentinel que usa la Trading API de Uniswap para representar el token nativo
 * de la red (no se puede dar approval a esta "dirección", no es un contrato real).
 * Ver skill swap-integration: ETH_ADDRESS en el ejemplo de backend script.
 */
export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface TokenInfo {
  /** NATIVE_TOKEN_ADDRESS para el token nativo, dirección de contrato ERC-20 en el resto */
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  logoUrl?: string;
}

/**
 * Tabla de tokens POR cadena. Cada dirección fue verificada contra su fuente oficial
 * antes de escribirse aquí — NUNCA copiar direcciones de memoria a otras redes,
 * cada red tiene un contrato distinto aunque el símbolo coincida.
 *
 * Fuentes verificadas:
 * - USDC: developers.circle.com/stablecoins/usdc-contract-addresses (Circle, emisor oficial)
 * - WETH (Ethereum): contrato WETH9 canónico 0xC02a...6Cc2, coincide con la tabla
 *   WETH_ADDRESSES de la skill swap-integration.
 * - WETH (Base/Optimism/Arbitrum): predeploy estándar OP-Stack 0x4200...0006 / dirección
 *   oficial de bridge en Arbitrum — coincide con la tabla WETH_ADDRESSES de la skill
 *   swap-integration (Advanced Patterns: WETH Handling on L2s).
 * - WPOL: docs.polygon.technology/pos/concepts/tokens/pol, verificado en Polygonscan.
 * - DAI: contrato oficial de MakerDAO en Ethereum y en cada L2, verificados en Etherscan /
 *   Basescan / Optimistic Etherscan / Arbiscan / Polygonscan.
 * - WBTC / cbBTC: verificados en Etherscan / Arbiscan / Optimistic Etherscan / Polygonscan / Basescan
 *   (cbBTC es el BTC wrapped nativo de Base, emitido por Coinbase; WBTC en el resto).
 */
export const TOKENS_BY_CHAIN: Record<SupportedChainId, TokenInfo[]> = {
  [mainnet.id]: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      isNative: true,
    },
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      isNative: false,
    },
    {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
      isNative: false,
    },
  ],
  [base.id]: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      isNative: true,
    },
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      isNative: false,
    },
    {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      symbol: "cbBTC",
      name: "Coinbase Wrapped BTC",
      decimals: 8,
      isNative: false,
    },
  ],
  [optimism.id]: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      isNative: true,
    },
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      isNative: false,
    },
    {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
      isNative: false,
    },
  ],
  [polygon.id]: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "POL",
      name: "Polygon Ecosystem Token",
      decimals: 18,
      isNative: true,
    },
    {
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      symbol: "WPOL",
      name: "Wrapped POL",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      isNative: false,
    },
    {
      address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
      isNative: false,
    },
  ],
  [arbitrum.id]: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      isNative: true,
    },
    {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      isNative: false,
    },
    {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      isNative: false,
    },
    {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
      isNative: false,
    },
  ],
};

export function getTokensForChain(chainId: SupportedChainId): TokenInfo[] {
  return TOKENS_BY_CHAIN[chainId];
}

export function findToken(chainId: SupportedChainId, address: string): TokenInfo | undefined {
  const normalized = address.toLowerCase();
  return TOKENS_BY_CHAIN[chainId].find((t) => t.address.toLowerCase() === normalized);
}

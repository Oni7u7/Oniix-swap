import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import type { Chain } from "viem";

/**
 * Las 5 redes EVM soportadas por el MVP. Todo lo demás en la app deriva de esta lista:
 * no hardcodear chainIds sueltos en otros archivos.
 *
 * TODO(fase 2 — Solana): Solana es non-EVM, no pasa por la Trading API ni por
 * wagmi/viem. Se integraría por separado con Jupiter (Ultra API) + un wallet adapter
 * de Solana. No agregar código ni dependencias de Solana hasta esa fase.
 */
export const SUPPORTED_CHAIN_IDS = [mainnet.id, base.id, optimism.id, polygon.id, arbitrum.id] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export const VIEM_CHAINS: Record<SupportedChainId, Chain> = {
  [mainnet.id]: mainnet,
  [base.id]: base,
  [optimism.id]: optimism,
  [polygon.id]: polygon,
  [arbitrum.id]: arbitrum,
};

interface ChainMeta {
  name: string;
  /** Símbolo del token nativo de la red (ETH en Ethereum/Base/Optimism/Arbitrum, POL en Polygon) */
  nativeSymbol: string;
  nativeDecimals: number;
  explorerName: string;
  explorerBaseUrl: string;
  /** Env var que contiene la RPC pública restringida por dominio para esta red */
  rpcEnvVar: string;
}

export const CHAIN_METADATA: Record<SupportedChainId, ChainMeta> = {
  [mainnet.id]: {
    name: "Ethereum",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerName: "Etherscan",
    explorerBaseUrl: "https://etherscan.io",
    rpcEnvVar: "NEXT_PUBLIC_RPC_URL_ETHEREUM",
  },
  [base.id]: {
    name: "Base",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerName: "Basescan",
    explorerBaseUrl: "https://basescan.org",
    rpcEnvVar: "NEXT_PUBLIC_RPC_URL_BASE",
  },
  [optimism.id]: {
    name: "Optimism",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerName: "Optimistic Etherscan",
    explorerBaseUrl: "https://optimistic.etherscan.io",
    rpcEnvVar: "NEXT_PUBLIC_RPC_URL_OPTIMISM",
  },
  [polygon.id]: {
    name: "Polygon",
    nativeSymbol: "POL",
    nativeDecimals: 18,
    explorerName: "Polygonscan",
    explorerBaseUrl: "https://polygonscan.com",
    rpcEnvVar: "NEXT_PUBLIC_RPC_URL_POLYGON",
  },
  [arbitrum.id]: {
    name: "Arbitrum One",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerName: "Arbiscan",
    explorerBaseUrl: "https://arbiscan.io",
    rpcEnvVar: "NEXT_PUBLIC_RPC_URL_ARBITRUM",
  },
};

/**
 * Slugs de red que usa la Alchemy Prices API (endpoint by-address), verificados contra
 * la documentación oficial de Alchemy (data-portfolio-apis) — no son los mismos strings
 * que usan otras APIs de Alchemy para otros productos, no reusar sin verificar.
 */
export const ALCHEMY_NETWORK_SLUG: Record<SupportedChainId, string> = {
  [mainnet.id]: "eth-mainnet",
  [base.id]: "base-mainnet",
  [optimism.id]: "opt-mainnet",
  [polygon.id]: "polygon-mainnet",
  [arbitrum.id]: "arb-mainnet",
};

export function getExplorerTxUrl(chainId: SupportedChainId, txHash: string): string {
  return `${CHAIN_METADATA[chainId].explorerBaseUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: SupportedChainId, address: string): string {
  return `${CHAIN_METADATA[chainId].explorerBaseUrl}/address/${address}`;
}

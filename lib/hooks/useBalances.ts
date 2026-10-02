"use client";

import { useMemo } from "react";
import { erc20Abi, type Address } from "viem";
import { useAccount, useBalance, useChainId, useReadContracts } from "wagmi";
import { isSupportedChainId, type SupportedChainId } from "@/lib/chains";
import { fromBaseUnits } from "@/lib/format";
import { getTokensForChain, type TokenInfo } from "@/lib/tokens";

export interface TokenBalance {
  token: TokenInfo;
  /** null mientras carga o si esa lectura puntual falló (ver `error`) */
  formatted: string | null;
  error: boolean;
}

export interface UseBalancesResult {
  chainId: SupportedChainId | null;
  isConnected: boolean;
  balances: TokenBalance[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Balances de la red ACTIVA del wallet únicamente (no las 4 redes). Independiente del
 * hot-path de quote/swap a propósito — no comparte debounce/intervalo con
 * useDebouncedQuote, así que no le añade latencia al flujo de swap.
 */
export function useBalances(): UseBalancesResult {
  const { address, isConnected } = useAccount();
  const rawChainId = useChainId();
  const chainId: SupportedChainId | null = isSupportedChainId(rawChainId) ? rawChainId : null;

  const tokens = useMemo(() => (chainId ? getTokensForChain(chainId) : []), [chainId]);
  const nativeToken = useMemo(() => tokens.find((t) => t.isNative) ?? null, [tokens]);
  const erc20Tokens = useMemo(() => tokens.filter((t) => !t.isNative), [tokens]);

  const nativeBalanceQuery = useBalance({
    address,
    chainId: chainId ?? undefined,
    query: { enabled: isConnected && chainId !== null },
  });

  // Todos los balanceOf de ERC-20 de la red activa van en UNA sola llamada multicall
  // (useReadContracts agrupa por chainId y usa Multicall3 internamente).
  const erc20Query = useReadContracts({
    contracts:
      chainId && address
        ? erc20Tokens.map((token) => ({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [address] as const,
            chainId,
          }))
        : [],
    query: { enabled: isConnected && chainId !== null && erc20Tokens.length > 0 },
  });

  const balances = useMemo<TokenBalance[]>(() => {
    if (!chainId) return [];
    const list: TokenBalance[] = [];

    if (nativeToken) {
      const value = nativeBalanceQuery.data?.value;
      list.push({
        token: nativeToken,
        formatted: value !== undefined ? fromBaseUnits(value.toString(), nativeToken.decimals) : null,
        error: nativeBalanceQuery.isError,
      });
    }

    erc20Tokens.forEach((token, i) => {
      const result = erc20Query.data?.[i];
      const raw = result?.status === "success" ? (result.result as bigint) : undefined;
      list.push({
        token,
        formatted: raw !== undefined ? fromBaseUnits(raw.toString(), token.decimals) : null,
        error: result?.status === "failure",
      });
    });

    return list;
  }, [chainId, nativeToken, erc20Tokens, nativeBalanceQuery.data, nativeBalanceQuery.isError, erc20Query.data]);

  const isLoading =
    isConnected && chainId !== null && (nativeBalanceQuery.isLoading || (erc20Tokens.length > 0 && erc20Query.isLoading));
  const isError = nativeBalanceQuery.isError || erc20Query.isError;

  function refetch() {
    void nativeBalanceQuery.refetch();
    void erc20Query.refetch();
  }

  return { chainId, isConnected, balances, isLoading, isError, refetch };
}

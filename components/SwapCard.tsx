"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { isSupportedChainId, type SupportedChainId } from "@/lib/chains";
import { DEFAULT_SLIPPAGE_PERCENT } from "@/lib/constants";
import { fromBaseUnits, isValidDecimalAmount, toBaseUnits } from "@/lib/format";
import { useDebouncedQuote } from "@/lib/hooks/useDebouncedQuote";
import { useMounted } from "@/lib/hooks/useMounted";
import type { SwapStep } from "@/lib/hooks/useSwap";
import { useSwap } from "@/lib/hooks/useSwap";
import { getTokensForChain, type TokenInfo } from "@/lib/tokens";
import { getQuoteOutputAmount, isUniswapXQuote } from "@/lib/types/trading-api";
import { SlippageControl } from "./SlippageControl";
import { SwapStatus } from "./SwapStatus";
import { TokenSelector } from "./TokenSelector";

const BUSY_STEPS: SwapStep[] = [
  "switching-network",
  "checking-approval",
  "approving",
  "requoting",
  "signing-permit",
  "submitting",
  "confirming",
];

interface SwapCardProps {
  /** Notifica al padre qué token está "seleccionado" (tokenOut) para cosas como el gráfico de precio. */
  onActiveTokenChange?: (token: TokenInfo, chainId: SupportedChainId) => void;
}

export function SwapCard({ onActiveTokenChange }: SwapCardProps = {}) {
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const rawChainId = useChainId();
  const chainId: SupportedChainId | null = isSupportedChainId(rawChainId) ? rawChainId : null;

  const tokens = useMemo(() => (chainId ? getTokensForChain(chainId) : []), [chainId]);

  const [lastChainId, setLastChainId] = useState<SupportedChainId | null>(null);
  const [tokenInAddr, setTokenInAddr] = useState<string | null>(null);
  const [tokenOutAddr, setTokenOutAddr] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PERCENT);

  // Cada red tiene direcciones distintas: al cambiar de chain, resetear a defaults sanos.
  // Se ajusta durante el render (no en un efecto) siguiendo el patrón de React para
  // "resetear estado cuando cambia una prop", evitando un frame extra de flicker.
  if (chainId !== lastChainId) {
    setLastChainId(chainId);
    const chainTokens = chainId ? getTokensForChain(chainId) : [];
    const native = chainTokens.find((t) => t.isNative);
    const usdc = chainTokens.find((t) => t.symbol === "USDC");
    setTokenInAddr(native?.address ?? chainTokens[0]?.address ?? null);
    setTokenOutAddr(usdc?.address ?? chainTokens[1]?.address ?? null);
    setAmountInput("");
  }

  const tokenIn = tokens.find((t) => t.address === tokenInAddr) ?? tokens[0];
  const tokenOut = tokens.find((t) => t.address === tokenOutAddr) ?? tokens[1];

  // Notifica al padre (ver SwapWorkspace) qué token mostrar en el gráfico de precio.
  // tokenOut/chainId ya están memoizados/estables entre renders con los mismos valores,
  // así que este efecto no dispara en loop.
  useEffect(() => {
    if (chainId && tokenOut) onActiveTokenChange?.(tokenOut, chainId);
  }, [chainId, tokenOut, onActiveTokenChange]);

  function invert() {
    setTokenInAddr(tokenOut?.address ?? null);
    setTokenOutAddr(tokenIn?.address ?? null);
    setAmountInput("");
  }

  const amountBaseUnits = useMemo(() => {
    if (!tokenIn || !isValidDecimalAmount(amountInput)) return null;
    try {
      return toBaseUnits(amountInput, tokenIn.decimals);
    } catch {
      return null;
    }
  }, [amountInput, tokenIn]);

  const quoteParams = useMemo(() => {
    if (!chainId || !address || !tokenIn || !tokenOut || !amountBaseUnits) return null;
    if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) return null;
    return {
      chainId,
      swapper: address,
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountBaseUnits,
      type: "EXACT_INPUT" as const,
      slippageTolerance: slippage,
      // Sin routingPreference: la Trading API real no acepta "CLASSIC" como valor
      // (a pesar de que la skill lo documenta — da 400 RequestValidationError, probado
      // en vivo). El MVP se queda con el default de la API y bloquea el botón de swap
      // si la ruta resultante es UniswapX (ver isSwapBusy/canSwap más abajo) — ver README.
    };
  }, [chainId, address, tokenIn, tokenOut, amountBaseUnits, slippage]);

  const {
    quote,
    isLoading: quoteLoading,
    isRefreshing,
    error: quoteError,
    refetch,
  } = useDebouncedQuote(quoteParams);

  const { state: swapState, executeSwap, reset: resetSwap } = useSwap();

  const outputAmountHuman = useMemo(() => {
    if (!quote || !tokenOut) return null;
    try {
      return fromBaseUnits(getQuoteOutputAmount(quote), tokenOut.decimals);
    } catch {
      return null;
    }
  }, [quote, tokenOut]);

  const minReceivedHuman = useMemo(() => {
    if (outputAmountHuman === null || !tokenOut) return null;
    const factor = 1 - slippage / 100;
    return (Number(outputAmountHuman) * factor).toFixed(Math.min(tokenOut.decimals, 8));
  }, [outputAmountHuman, slippage, tokenOut]);

  const gasFeeUsd = quote && !isUniswapXQuote(quote) ? quote.quote.gasFeeUSD : null;

  // La API puede devolver una ruta gasless (DUTCH_V2/V3/PRIORITY) en vez de CLASSIC
  // (posible en Ethereum/Base/Arbitrum). El MVP no soporta ese flujo de submisión — ver README.
  const isGaslessRoute = quote !== null && isUniswapXQuote(quote);

  const isSwapBusy = BUSY_STEPS.includes(swapState.step);
  const canSwap =
    isConnected &&
    chainId !== null &&
    quote !== null &&
    quoteError === null &&
    !quoteLoading &&
    !isSwapBusy &&
    !isGaslessRoute;

  async function handleSwap() {
    if (!chainId || !address || !tokenIn || !amountBaseUnits) return;
    resetSwap();
    await executeSwap({
      chainId,
      walletAddress: address,
      tokenIn: tokenIn.address,
      amountBaseUnits,
      refetchQuote: async () => {
        const result = await refetch();
        return { data: result.data ?? undefined };
      },
    });
  }

  // !mounted primero: en SSR y en el primer render del cliente esta rama SIEMPRE se
  // toma (independiente de isConnected real), así que el primer paint del cliente
  // coincide con SSR byte a byte — ver lib/hooks/useMounted.ts.
  if (!mounted || !isConnected) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500">Conecta tu wallet para empezar a intercambiar tokens.</p>
        <ConnectButton />
      </div>
    );
  }

  if (!chainId) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Red no soportada. Cambia a Ethereum, Base, Optimism, Polygon o Arbitrum.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Swap</h1>
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amountInput}
            onChange={(e) => {
              if (/^\d*\.?\d*$/.test(e.target.value)) setAmountInput(e.target.value);
            }}
            className="w-full bg-transparent text-2xl font-medium text-neutral-900 outline-none dark:text-neutral-100"
          />
          {tokenIn && (
            <TokenSelector
              label=""
              tokens={tokens}
              selected={tokenIn}
              onSelect={(t) => setTokenInAddr(t.address)}
              disabledAddress={tokenOut?.address}
            />
          )}
        </div>
        <span className="text-xs text-neutral-400">Pagas</span>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={invert}
          aria-label="Invertir dirección"
          className="rounded-full border border-neutral-200 bg-white p-1.5 text-neutral-500 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:text-neutral-100"
        >
          ↓↑
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xl font-medium text-neutral-400">
            {quoteLoading ? "…" : (outputAmountHuman ?? "0.0")}
          </span>
          {tokenOut && (
            <TokenSelector
              label=""
              tokens={tokens}
              selected={tokenOut}
              onSelect={(t) => setTokenOutAddr(t.address)}
              disabledAddress={tokenIn?.address}
            />
          )}
        </div>
        <span className="text-xs text-neutral-400">
          Recibes {isRefreshing && <span className="italic">· actualizando…</span>}
        </span>
      </div>

      <SlippageControl value={slippage} onChange={setSlippage} />

      {quote && !quoteError && (
        <div className="flex flex-col gap-1 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-900">
          {minReceivedHuman && (
            <div className="flex justify-between">
              <span>Mínimo a recibir</span>
              <span>
                {minReceivedHuman} {tokenOut?.symbol}
              </span>
            </div>
          )}
          {gasFeeUsd && (
            <div className="flex justify-between">
              <span>Gas estimado</span>
              <span>${Number(gasFeeUsd).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {quoteError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {quoteError.message}
        </div>
      )}

      {isGaslessRoute && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Uniswap encontró una ruta gasless (UniswapX) para este par, que este MVP todavía
          no ejecuta. Prueba con otro monto/par, o espera unos segundos a que se refresque
          la cotización — a veces vuelve una ruta CLASSIC normal.
        </div>
      )}

      <button
        type="button"
        disabled={!canSwap}
        onClick={handleSwap}
        className="rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {amountInput === ""
          ? "Ingresa un monto"
          : quoteLoading
            ? "Cotizando…"
            : quoteError
              ? "Sin cotización disponible"
              : isGaslessRoute
                ? "Ruta gasless no soportada"
                : "Swap"}
      </button>

      <SwapStatus chainId={chainId} state={swapState} />
    </div>
  );
}

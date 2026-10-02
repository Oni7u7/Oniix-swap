"use client";

import type { SupportedChainId } from "@/lib/chains";
import { getExplorerTxUrl, CHAIN_METADATA } from "@/lib/chains";
import type { SwapState } from "@/lib/hooks/useSwap";

const STEP_LABELS: Record<SwapState["step"], string> = {
  idle: "",
  "switching-network": "Cambiando de red…",
  "checking-approval": "Verificando approval…",
  approving: "Esperando firma de approval…",
  requoting: "Actualizando cotización antes de ejecutar…",
  "signing-permit": "Esperando firma del permit…",
  submitting: "Preparando transacción de swap…",
  confirming: "Esperando confirmación en la blockchain…",
  success: "¡Swap confirmado!",
  error: "Error en el swap",
};

interface SwapStatusProps {
  chainId: SupportedChainId;
  state: SwapState;
}

export function SwapStatus({ chainId, state }: SwapStatusProps) {
  if (state.step === "idle") return null;

  const isBusy = !["idle", "success", "error"].includes(state.step);
  const explorerName = CHAIN_METADATA[chainId].explorerName;

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-sm ${
        state.step === "error"
          ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          : state.step === "success"
            ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
            : "border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      }`}
    >
      <div className="flex items-center gap-2">
        {isBusy && (
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        <span>{state.step === "error" && state.errorMessage ? state.errorMessage : STEP_LABELS[state.step]}</span>
      </div>

      {state.isSlowConfirmation && (
        <span className="text-xs opacity-80">
          El RPC está tardando en confirmar el receipt — la transacción puede estar ya
          confirmada on-chain, seguimos reintentando antes de reportar un error.
        </span>
      )}

      {state.approvalTxHash && (
        <a
          href={getExplorerTxUrl(chainId, state.approvalTxHash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          Ver approval en {explorerName}
        </a>
      )}

      {state.swapTxHash && (
        <a
          href={getExplorerTxUrl(chainId, state.swapTxHash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          Ver swap en {explorerName}
        </a>
      )}
    </div>
  );
}

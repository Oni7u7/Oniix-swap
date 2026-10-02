"use client";

import { getPublicClient, getWalletClient, switchChain } from "@wagmi/core";
import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { TransactionReceiptNotFoundError, WaitForTransactionReceiptTimeoutError } from "viem";
import type { Address, Hash, TransactionReceipt } from "viem";
import { RECEIPT_POLL_BACKOFF_MS, RECEIPT_WAIT_TIMEOUT_MS } from "@/lib/constants";
import type { SupportedChainId } from "@/lib/chains";
import { isUniswapPermitData, toSignTypedDataParams } from "@/lib/permit";
import { NATIVE_TOKEN_ADDRESS } from "@/lib/tokens";
import type { ApprovalTransaction, QuoteResponse, SwapTransaction } from "@/lib/types/trading-api";
import { validateSwapTransaction } from "@/lib/validation";

// wagmi tipa el public client con genéricos propios; derivamos el tipo desde el propio
// getPublicClient en vez de importar PublicClient de viem para no chocar generics entre paquetes.
type ResolvedPublicClient = NonNullable<ReturnType<typeof getPublicClient>>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollReceiptWithBackoff(publicClient: ResolvedPublicClient, hash: Hash): Promise<TransactionReceipt> {
  for (const delay of RECEIPT_POLL_BACKOFF_MS) {
    await sleep(delay);
    try {
      return await publicClient.getTransactionReceipt({ hash });
    } catch (error) {
      if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
      // Todavía no está indexada por este RPC — seguir reintentando.
    }
  }
  throw new Error(
    `El RPC no devolvió el receipt de ${hash} tras esperar varios minutos. Verifica el hash en el explorador: ` +
      "si ya está confirmada, puedes reintentar el swap sin problema (no debería volver a pedir approval)."
  );
}

/**
 * waitForTransactionReceipt puede agotar su timeout contra un RPC lento/público aunque
 * la tx YA esté confirmada on-chain (visible en el explorador) — un timeout del cliente
 * NO es un fallo de la transacción. Si eso pasa, en vez de reportar error de una,
 * reintentamos getTransactionReceipt directo con backoff antes de rendirnos. Solo se
 * lanza un error real si la tx efectivamente revirtió on-chain o si el polling
 * extendido se agota sin encontrar nada.
 */
async function waitForReceiptResilient(
  publicClient: ResolvedPublicClient,
  hash: Hash,
  onSlowConfirmation?: () => void
): Promise<TransactionReceipt> {
  let receipt: TransactionReceipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: RECEIPT_WAIT_TIMEOUT_MS,
    });
  } catch (error) {
    if (!(error instanceof WaitForTransactionReceiptTimeoutError)) throw error;
    onSlowConfirmation?.();
    receipt = await pollReceiptWithBackoff(publicClient, hash);
  }

  if (receipt.status === "reverted") {
    throw new Error(`La transacción ${hash} revirtió on-chain — revisa el explorador para más detalle.`);
  }
  return receipt;
}

export type SwapStep =
  | "idle"
  | "switching-network"
  | "checking-approval"
  | "approving"
  | "requoting"
  | "signing-permit"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

export interface SwapState {
  step: SwapStep;
  errorMessage: string | null;
  /** true mientras esperamos el receipt vía polling manual tras un timeout del wait principal. */
  isSlowConfirmation: boolean;
  approvalTxHash: Hash | null;
  swapTxHash: Hash | null;
}

export interface ExecuteSwapArgs {
  chainId: SupportedChainId;
  walletAddress: Address;
  tokenIn: string;
  amountBaseUnits: string;
  /** refetch de useDebouncedQuote: fuerza un re-quote fresco justo antes de firmar/enviar. */
  refetchQuote: () => Promise<{ data?: QuoteResponse }>;
}

const INITIAL_STATE: SwapState = {
  step: "idle",
  errorMessage: null,
  isSlowConfirmation: false,
  approvalTxHash: null,
  swapTxHash: null,
};

function isUserRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: unknown }).name) : "";
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  return name === "UserRejectedRequestError" || /user rejected/i.test(message) || /rejected the request/i.test(message);
}

function friendlyErrorMessage(error: unknown): string {
  if (isUserRejection(error)) return "Firma cancelada por el usuario.";
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado durante el swap.";
}

interface JsonApiResponse {
  ok: boolean;
  status: number;
  data: { error?: string; detail?: string; [key: string]: unknown };
}

async function postJson(path: string, body: unknown): Promise<JsonApiResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export function useSwap() {
  const config = useConfig();
  const [state, setState] = useState<SwapState>(INITIAL_STATE);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const executeSwap = useCallback(
    async ({ chainId, walletAddress, tokenIn, amountBaseUnits, refetchQuote }: ExecuteSwapArgs) => {
      setState({ ...INITIAL_STATE, step: "switching-network" });
      try {
        await switchChain(config, { chainId });

        const isNativeInput = tokenIn.toLowerCase() === NATIVE_TOKEN_ADDRESS;

        if (!isNativeInput) {
          setState((s) => ({ ...s, step: "checking-approval" }));
          const approvalRes = await postJson("/api/check-approval", {
            walletAddress,
            token: tokenIn,
            amount: amountBaseUnits,
            chainId,
          });
          if (!approvalRes.ok) {
            throw new Error(approvalRes.data.detail ?? approvalRes.data.error ?? "No se pudo verificar el approval");
          }

          if (approvalRes.data.approval) {
            setState((s) => ({ ...s, step: "approving" }));
            const walletClient = await getWalletClient(config, { chainId });
            const approval = approvalRes.data.approval as ApprovalTransaction;
            const approvalHash = await walletClient.sendTransaction({
              to: approval.to as Address,
              data: approval.data as `0x${string}`,
              value: BigInt(approval.value || "0"),
            });
            setState((s) => ({ ...s, approvalTxHash: approvalHash }));

            const publicClient = getPublicClient(config, { chainId });
            if (!publicClient) throw new Error(`No hay public client configurado para chainId ${chainId}`);
            await waitForReceiptResilient(publicClient, approvalHash, () =>
              setState((s) => ({ ...s, isSlowConfirmation: true }))
            );
            setState((s) => ({ ...s, isSlowConfirmation: false }));
          }
        }

        // Los quotes expiran en ~30s: nunca ejecutar con uno viejo, siempre re-pedir justo antes.
        setState((s) => ({ ...s, step: "requoting" }));
        const { data: freshQuote } = await refetchQuote();
        if (!freshQuote) {
          throw new Error("No se pudo obtener una cotización fresca antes de ejecutar el swap");
        }

        let signature: string | undefined;
        const permitData = (freshQuote as unknown as { permitData?: unknown }).permitData;
        if (isUniswapPermitData(permitData)) {
          setState((s) => ({ ...s, step: "signing-permit" }));
          const walletClient = await getWalletClient(config, { chainId });
          signature = await walletClient.signTypedData(toSignTypedDataParams(permitData));
        }

        setState((s) => ({ ...s, step: "submitting" }));
        const swapRes = await postJson("/api/swap", { quoteResponse: freshQuote, signature });
        if (!swapRes.ok) {
          throw new Error(swapRes.data.detail ?? swapRes.data.error ?? "El swap fue rechazado por la API");
        }

        validateSwapTransaction(swapRes.data.swap as Record<string, unknown>);

        const walletClient = await getWalletClient(config, { chainId });
        const swap = swapRes.data.swap as SwapTransaction;
        const swapHash = await walletClient.sendTransaction({
          to: swap.to as Address,
          data: swap.data as `0x${string}`,
          value: BigInt(swap.value || "0"),
        });
        setState((s) => ({ ...s, swapTxHash: swapHash, step: "confirming" }));

        const publicClient = getPublicClient(config, { chainId });
        if (!publicClient) throw new Error(`No hay public client configurado para chainId ${chainId}`);
        await waitForReceiptResilient(publicClient, swapHash, () =>
          setState((s) => ({ ...s, isSlowConfirmation: true }))
        );

        setState((s) => ({ ...s, isSlowConfirmation: false, step: "success" }));
        return swapHash;
      } catch (error) {
        setState((s) => ({ ...s, step: "error", isSlowConfirmation: false, errorMessage: friendlyErrorMessage(error) }));
        return null;
      }
    },
    [config]
  );

  return { state, executeSwap, reset };
}

"use client";

import { useBalances } from "@/lib/hooks/useBalances";
import { useMounted } from "@/lib/hooks/useMounted";

export function BalancesPanel() {
  const mounted = useMounted();
  const { chainId, isConnected, balances, isLoading, isError, refetch } = useBalances();

  // !mounted primero, mismo criterio que SwapCard: el primer render del cliente debe
  // coincidir con SSR sin importar el isConnected/chainId real — ver lib/hooks/useMounted.ts.
  if (!mounted || !isConnected) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950">
        Conecta tu wallet para ver tus balances.
      </div>
    );
  }

  if (!chainId) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        Cambia a una red soportada (Base, Optimism, Polygon o Arbitrum) para ver tus balances.
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Mis balances</h2>
        <button
          type="button"
          onClick={refetch}
          disabled={isLoading}
          className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900 disabled:opacity-40 dark:hover:text-neutral-100"
        >
          {isLoading ? "Actualizando…" : "Refrescar"}
        </button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          No se pudieron leer algunos balances — puede ser un problema del RPC. Prueba &ldquo;Refrescar&rdquo;.
        </div>
      )}

      <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
        {balances.map(({ token, formatted, error }) => (
          <li key={token.address} className="flex items-center justify-between py-2 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{token.symbol}</span>
            {error ? (
              <span className="text-xs text-red-600 dark:text-red-400">error</span>
            ) : formatted === null ? (
              <span className="h-4 w-16 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
            ) : (
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatted}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

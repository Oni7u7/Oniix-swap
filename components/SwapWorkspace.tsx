"use client";

import { useCallback, useState } from "react";
import type { SupportedChainId } from "@/lib/chains";
import { useMounted } from "@/lib/hooks/useMounted";
import type { TokenInfo } from "@/lib/tokens";
import { BalancesPanel } from "./BalancesPanel";
import { PriceChart } from "./PriceChart";
import { SwapCard } from "./SwapCard";

interface ActiveToken {
  token: TokenInfo;
  chainId: SupportedChainId;
}

/**
 * Raíz de composición cliente: junta SwapCard, PriceChart y BalancesPanel. El único
 * acoplamiento entre el swap y el gráfico es "qué token mostrar" (levantado acá) — el
 * fetching de precios vive en sus propios hooks/queries, así que un fallo o lentitud del
 * gráfico no afecta al swap. Móvil: gráfico arriba (flex-col). Desktop: lado a lado.
 */
export function SwapWorkspace() {
  const mounted = useMounted();
  const [activeToken, setActiveToken] = useState<ActiveToken | null>(null);

  const handleActiveTokenChange = useCallback((token: TokenInfo, chainId: SupportedChainId) => {
    setActiveToken((prev) =>
      prev && prev.chainId === chainId && prev.token.address.toLowerCase() === token.address.toLowerCase()
        ? prev
        : { token, chainId }
    );
  }, []);

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      {/* mounted ? activeToken : null: en SSR y en el primer render del cliente esto es
          SIEMPRE null (activeToken solo se llena vía un efecto post-montaje en SwapCard),
          así que el primer paint del cliente coincide byte a byte con SSR. */}
      <PriceChart selected={mounted ? activeToken : null} />
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <SwapCard onActiveTokenChange={handleActiveTokenChange} />
        <BalancesPanel />
      </div>
    </div>
  );
}

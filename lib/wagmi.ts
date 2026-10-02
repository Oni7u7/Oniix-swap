import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
if (!walletConnectProjectId) {
  throw new Error("NEXT_PUBLIC_WC_PROJECT_ID is not set — get one at https://cloud.walletconnect.com");
}

const RPC_ENV_BY_CHAIN: Record<string, string | undefined> = {
  Ethereum: process.env.NEXT_PUBLIC_RPC_URL_ETHEREUM,
  Base: process.env.NEXT_PUBLIC_RPC_URL_BASE,
  Optimism: process.env.NEXT_PUBLIC_RPC_URL_OPTIMISM,
  Polygon: process.env.NEXT_PUBLIC_RPC_URL_POLYGON,
  "Arbitrum One": process.env.NEXT_PUBLIC_RPC_URL_ARBITRUM,
};

/**
 * http(url) usa la RPC configurada en NEXT_PUBLIC_RPC_URL_* (Alchemy/Infura) tanto en
 * dev como en producción — no hay lógica especial por entorno, el mismo valor de env
 * aplica a los dos. http(undefined) cae al RPC público por defecto de viem/chains SOLO
 * si la variable está vacía.
 *
 * El RPC público es aceptable para /quote (solo lectura), pero NO para probar el flujo
 * de swap completo: waitForTransactionReceipt puede agotar su timeout contra un RPC
 * público lento aunque la tx ya haya confirmado on-chain. Configura las 5
 * NEXT_PUBLIC_RPC_URL_* reales antes de probar approvals/swaps — ver README.
 */
if (process.env.NODE_ENV !== "production") {
  for (const [chainName, url] of Object.entries(RPC_ENV_BY_CHAIN)) {
    if (!url) {
      console.warn(
        `[wagmi] NEXT_PUBLIC_RPC_URL_* no configurada para ${chainName}: usando el RPC público de viem/chains. ` +
          "Puede ser lento devolviendo transaction receipts — configúrala en .env.local antes de probar approvals/swaps."
      );
    }
  }
}

export const wagmiConfig = getDefaultConfig({
  appName: "Oniix Swap",
  projectId: walletConnectProjectId,
  chains: [mainnet, base, optimism, polygon, arbitrum],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL_ETHEREUM),
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL_BASE),
    [optimism.id]: http(process.env.NEXT_PUBLIC_RPC_URL_OPTIMISM),
    [polygon.id]: http(process.env.NEXT_PUBLIC_RPC_URL_POLYGON),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_URL_ARBITRUM),
  },
  ssr: true,
});

// Registra el tipo concreto de la config para que useConfig()/useAccount()/etc.
// devuelvan tipos narrowed a nuestras 5 chains en vez del Config genérico de wagmi
// (sin esto, sendTransaction infiere "chain: never" en los call sites).
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

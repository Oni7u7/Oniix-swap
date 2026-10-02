import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Ver lib/stubs/x402-core-client-stub.ts: dependencias opcionales no instaladas
      // que arrastra @coinbase/cdp-sdk (vía el conector Base Account de RainbowKit)
      // y rompen el build si no se alias-ean.
      "@x402/core/client": "./lib/stubs/x402-core-client-stub.ts",
      "@x402/evm": "./lib/stubs/x402-core-client-stub.ts",
      "@x402/evm/exact/client": "./lib/stubs/x402-core-client-stub.ts",
      "@x402/evm/upto/client": "./lib/stubs/x402-core-client-stub.ts",
      "@x402/svm/exact/client": "./lib/stubs/x402-core-client-stub.ts",
    },
  },
};

export default nextConfig;

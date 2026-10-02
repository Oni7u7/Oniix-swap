/**
 * Stub compartido para varios paquetes `@x402/*` que NO están instalados
 * (son peer dependencies opcionales de `@coinbase/cdp-sdk` para su feature de
 * pagos x402, que esta app no usa).
 *
 * `@coinbase/cdp-sdk` es una dependencia transitiva de RainbowKit vía el
 * conector "Base Account" de `@wagmi/connectors` (parte del set de wallets
 * por defecto de `getDefaultConfig`). Turbopack resuelve estáticamente tanto
 * los `import` de nivel superior como los `import()` de cdp-sdk con specifier
 * literal (aunque estén detrás de un loader "lazy"), así que sin este alias
 * el build/SSR falla con "Module not found" aunque el código que de verdad
 * usa estos paquetes (firmar pagos x402) nunca se ejecute en esta app — ver
 * el TODO de fase 2 (Solana) en lib/chains.ts, no relacionado con x402.
 *
 * Los nombres exportados son dummies: solo necesitan existir para que la
 * evaluación del módulo no falle. Si algún día se integra x402 de verdad,
 * hay que instalar los paquetes reales y quitar este stub + el alias en
 * next.config.ts.
 */
export class x402Client {}
export class UptoEvmScheme {}
export class ExactSvmScheme {}

export function registerExactEvmScheme(): void {
  throw new Error("@x402/evm is stubbed out in this app — see lib/stubs/x402-core-client-stub.ts");
}

export function registerExactSvmScheme(): void {
  throw new Error("@x402/svm is stubbed out in this app — see lib/stubs/x402-core-client-stub.ts");
}

export function toClientEvmSigner(): void {
  throw new Error("@x402/evm is stubbed out in this app — see lib/stubs/x402-core-client-stub.ts");
}

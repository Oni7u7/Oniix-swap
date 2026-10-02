# Oniix Swap

MVP de swaps de tokens vía la [Trading API de Uniswap](https://docs.uniswap.org/), sobre **4 redes EVM mainnet**: Base, Optimism, Polygon y Arbitrum One.

⚠️ **Esto corre en mainnet, con dinero real.** Lee la sección [Primer swap seguro](#primer-swap-seguro-antes-de-usar-montos-grandes) antes de probar.

## Stack

- Next.js 16 (App Router) + TypeScript strict
- wagmi v2 + viem + RainbowKit (wallet, red, firma)
- TanStack Query (via wagmi)
- Tailwind CSS
- lightweight-charts (gráfico de precios)
- Vitest (tests de `lib/format.ts`)

## Arquitectura

```
Cliente (browser)
  └─ SwapCard → useDebouncedQuote / useSwap
        │            │
        │            └─ firma con la wallet del usuario (wagmi/viem) — el backend
        │               NUNCA ve ni maneja private keys.
        ▼
  /api/quote, /api/check-approval, /api/swap   (Route Handlers, server-only)
        │
        └─ agregan x-api-key y proxean a
           https://trade-api.gateway.uniswap.org/v1
```

- **`UNISWAP_API_KEY`** vive solo en el servidor (Route Handlers). Nunca se expone al cliente.
- **RPCs** (`NEXT_PUBLIC_RPC_URL_*`) sí viajan al cliente a propósito — wagmi/RainbowKit las necesitan en el browser. Se protegen restringiéndolas por dominio en el proveedor (Alchemy/Infura), no ocultándolas.
- Los tres endpoints backend (`/api/quote`, `/api/check-approval`, `/api/swap`) validan estrictamente cada input (direcciones, chainId soportado, montos) antes de reenviar nada a Uniswap, y aplican un rate limit ligero en memoria por IP para proteger la cuota de la API key. El status y el mensaje de error de la Trading API se devuelven tal cual al cliente (no se aplastan en un 500 genérico).

### Decisión: bloquear rutas gasless (UniswapX) en el MVP

La Trading API puede devolver rutas `CLASSIC` (gasful: el usuario firma y transmite la tx) o UniswapX `DUTCH_V2/V3/PRIORITY` (gasless: se firma una orden y la ejecuta un filler off-chain). La skill `swap-integration` documenta en detalle el flujo `/swap` para ambos casos, pero **no** documenta un endpoint separado de sumisión de orden — todo pasa por `/swap`, diferenciando solo si se envía o no `permitData`.

La skill también documenta `routingPreference: "CLASSIC"` como valor válido para forzar solo rutas gasful — **probado en vivo contra la API real, ese valor no existe**: devuelve `400 RequestValidationError` (`"routingPreference" must be one of [BEST_PRICE, FASTEST]`). Así que en vez de intentar forzarlo por request, el MVP deja que `/quote` use su comportamiento por defecto y bloquea el botón de swap en el cliente si la ruta que vuelve es UniswapX (`isGaslessRoute` en `components/SwapCard.tsx`), mostrando un aviso en vez de ejecutar un flujo con menos cobertura de pruebas. UniswapX V2 solo aparece en Ethereum/Arbitrum/Base/Unichain, así que en Optimism y Polygon esto nunca debería activarse. `lib/uniswap-client.ts` ya maneja correctamente `permitData`/`signature` para ambos tipos de routing si en el futuro se quiere habilitar UniswapX de verdad.

## Setup

```bash
npm install
cp .env.example .env.local   # ya existe, solo edítalo
```

Completa `.env.local`:

| Variable | Dónde conseguirla | Secreta |
|---|---|---|
| `UNISWAP_API_KEY` | https://developers.uniswap.org/ | Sí — solo backend |
| `NEXT_PUBLIC_WC_PROJECT_ID` | https://cloud.walletconnect.com | No |
| `NEXT_PUBLIC_RPC_URL_BASE/OPTIMISM/POLYGON/ARBITRUM` | Alchemy/Infura (una app por red, mainnet) | No, pero restringe por dominio |
| `ALCHEMY_API_KEY` | Alchemy (puede ser la misma app que las RPC_URL_* si tiene Prices API habilitada) | Sí — solo backend |
| `ALCHEMY_ALLOWED_ORIGIN` | El mismo Origin que agregaste al allowlist de esa app en Alchemy | No, pero debe coincidir exacto con el allowlist |

### Allowlist de la Alchemy Prices API (gráfico de precios)

La Prices API de Alchemy (`/app/api/price-history`, `/app/api/price-current`) exige un header `Origin` que esté en el allowlist configurado para esa API key en el dashboard de Alchemy — **incluso en llamadas servidor-a-servidor**, sin navegador de por medio. Sin esto responde `"Unspecified origin not on whitelist."` (verificado en vivo). El backend manda `ALCHEMY_ALLOWED_ORIGIN` como header `Origin` a mano en cada request (ver `lib/alchemy-prices-client.ts`) — configúralo en Alchemy (Security → Allowlist, para la app cuya key uses en `ALCHEMY_API_KEY`) y ponlo aquí exactamente igual (`http://localhost:3000` en dev, tu dominio real en producción).

Si dejas las `NEXT_PUBLIC_RPC_URL_*` vacías en desarrollo, la app cae automáticamente al RPC público de `viem/chains` (la consola del navegador te avisa con un warning si esto pasa).

⚠️ **El RPC público solo alcanza para probar `/quote`** (solo lectura). Para probar approvals y swaps de verdad, configura las 4 `NEXT_PUBLIC_RPC_URL_*` con RPCs reales (Alchemy/Infura) **antes** de tocar el flujo de escritura — el RPC público es lento devolviendo `transaction receipts`, y `waitForTransactionReceipt` puede agotar su timeout aunque la transacción ya haya confirmado on-chain (verías el error de timeout en la UI mientras Etherscan/Basescan/etc. ya muestra la tx como exitosa). La app reintenta el receipt con backoff si esto pasa (ver `lib/hooks/useSwap.ts`), pero un RPC real evita el problema de raíz y hace todo el flujo más rápido.

## Correr en dev

```bash
npm run dev
```

Abre http://localhost:3000, conecta tu wallet y elige una red soportada.

Otros comandos:

```bash
npm run build   # build de producción
npm run lint    # eslint
npx vitest run  # tests de lib/format.ts (conversión de decimales)
npx tsc --noEmit  # typecheck
```

## Primer swap seguro (antes de usar montos grandes)

1. **Usa una wallet dedicada con fondos limitados** para probar esta app por primera vez — no tu wallet principal.
2. Prueba `/quote` a fondo primero: es de solo lectura y gratis. Cambia de red, cambia de tokens, cambia el monto, y revisa que el precio, el mínimo a recibir y el gas estimado tengan sentido en cada una de las 4 redes.
3. Cuando hagas el primer swap real, usa el **monto más pequeño posible** (ej. unos centavos de USDC) para verificar que todo el flujo —approval si aplica, firma del permit, transacción, confirmación— funciona de punta a punta antes de mover montos mayores.
4. Verifica el hash de la transacción en el explorador correcto de la red (el link en pantalla ya apunta a Basescan/Optimistic Etherscan/Polygonscan/Arbiscan según corresponda).
5. Sube el slippage con cuidado: valores altos (⩾5%, marcado en la UI) te protegen menos de sandwich attacks.

## Despliegue

Pensado para Vercel. Configura las mismas variables de entorno en el dashboard del proyecto (Project Settings → Environment Variables) — no subas `.env.local`.

## Fase 2 (fuera de alcance de este MVP)

Solana no está implementado: es non-EVM y usaría Jupiter (Ultra API) + un wallet adapter de Solana en vez de wagmi/viem/Trading API. Hay un `TODO` en `lib/chains.ts` marcando dónde encajaría.

## Nota sobre dependencias

`npm audit` reporta vulnerabilidades moderadas/altas en paquetes transitivos de WalletConnect/Reown que trae `@rainbow-me/rainbowkit` (conector WalletConnect). Son problemas conocidos del lado del ecosistema de wallets, no de este código; no se pueden resolver sin romper la compatibilidad con RainbowKit. Revisa `npm audit` periódicamente y actualiza `@rainbow-me/rainbowkit` cuando publiquen un fix.

### Workaround: build roto por `@x402/*` sin instalar

El conector "Base Account" que trae `@wagmi/connectors` (incluido por defecto en `getDefaultConfig` de RainbowKit) arrastra `@coinbase/cdp-sdk`, que a su vez referencia varios paquetes `@x402/*` (soporte de pagos x402 sobre Solana) que no están instalados como dependencias — ni falta que hace, esta app no los usa. Sin el workaround, `next dev`/`next build` fallan con `Module not found: Can't resolve '@x402/...'`.

Se resuelve con un alias de Turbopack en `next.config.ts` (`turbopack.resolveAlias`) que redirige esos specifiers a `lib/stubs/x402-core-client-stub.ts`, un módulo con exports dummy que nunca se ejecutan de verdad (el código real de cdp-sdk que los usa solo corre si intentas firmar un pago x402, cosa que esta app no hace). Si en algún momento actualizas `@rainbow-me/rainbowkit`/`@wagmi/connectors` y el error reaparece con un specifier `@x402/*` distinto, agrégalo al mismo alias.

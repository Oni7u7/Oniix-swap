import type { TypedDataDomain } from "viem";

/**
 * Forma de permitData que devuelve la Trading API (ver skill swap-integration):
 * { domain, types, values }. viem necesita además `primaryType` y llama al mensaje
 * `message` en vez de `values`, así que hay que traducir antes de firmar.
 */
export interface UniswapPermitData {
  domain: TypedDataDomain;
  types: Record<string, { name: string; type: string }[]>;
  values: Record<string, unknown>;
}

export function isUniswapPermitData(value: unknown): value is UniswapPermitData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.domain === "object" &&
    v.domain !== null &&
    typeof v.types === "object" &&
    v.types !== null &&
    typeof v.values === "object" &&
    v.values !== null
  );
}

/**
 * La Trading API NUNCA incluye `primaryType` en permitData — verificado contra /quote
 * en vivo (Optimism, DAI->USDC, routing CLASSIC): la respuesta trae únicamente
 * `{ domain, types, values }`, sin ese campo. Contar "el único tipo que no sea
 * EIP712Domain" tampoco sirve para inferirlo: el permit de Permit2 (AllowanceTransfer)
 * declara DOS tipos en `types` —
 *   PermitSingle:  { details: PermitDetails, spender: address, sigDeadline: uint256 }
 *   PermitDetails: { token: address, amount: uint160, expiration: uint48, nonce: uint48 }
 * — porque EIP-712 exige declarar también los structs anidados, no solo el raíz.
 * `PermitDetails` es un tipo anidado REFERENCIADO desde `PermitSingle.details`, no el
 * tipo principal a firmar. Para los swaps CLASSIC de este MVP (el único routing que la
 * UI permite ejecutar — ver isGaslessRoute en SwapCard.tsx), el primaryType correcto es
 * siempre "PermitSingle". Las órdenes UniswapX (DUTCH_V2/V3/PRIORITY) usan un schema
 * EIP-712 totalmente distinto y no pasan por esta función en este MVP.
 */
const PERMIT2_PRIMARY_TYPE = "PermitSingle";

export function toSignTypedDataParams(permitData: UniswapPermitData) {
  if (!permitData.types[PERMIT2_PRIMARY_TYPE]) {
    throw new Error(
      `El permit no tiene el tipo esperado "${PERMIT2_PRIMARY_TYPE}" — shape inesperado de ` +
        `permitData.types: [${Object.keys(permitData.types).join(", ")}]. ` +
        "Puede ser una orden UniswapX en vez de un permit CLASSIC de Permit2 (no soportado aún)."
    );
  }

  return {
    domain: permitData.domain,
    types: permitData.types,
    primaryType: PERMIT2_PRIMARY_TYPE,
    message: permitData.values,
  };
}

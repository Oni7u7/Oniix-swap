import { formatUnits, parseUnits } from "viem";

/** Acepta enteros o decimales positivos: "1", "1.5", "0.000001". Rechaza vacío, negativos, notación científica, etc. */
const DECIMAL_AMOUNT_RE = /^\d+(\.\d+)?$/;

export function isValidDecimalAmount(amount: string): boolean {
  if (!DECIMAL_AMOUNT_RE.test(amount)) return false;
  return amount !== "0" && !/^0\.0*$/.test(amount);
}

/**
 * Convierte un monto legible por humanos ("1.5") a unidades mínimas (wei) respetando
 * los decimales del token. Lanza si el monto no es un decimal positivo válido.
 */
export function toBaseUnits(amount: string, decimals: number): string {
  if (!isValidDecimalAmount(amount)) {
    throw new Error(`Invalid decimal amount: "${amount}"`);
  }
  return parseUnits(amount, decimals).toString();
}

/** Convierte unidades mínimas (wei, como string) a un monto legible por humanos. */
export function fromBaseUnits(baseUnits: string, decimals: number): string {
  if (!/^\d+$/.test(baseUnits)) {
    throw new Error(`Invalid base units amount: "${baseUnits}"`);
  }
  return formatUnits(BigInt(baseUnits), decimals);
}

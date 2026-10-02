import { isAddress, isHex } from "viem";
import { isSupportedChainId, type SupportedChainId } from "./chains";
import { isValidDecimalAmount } from "./format";

export function assertSupportedChainId(value: unknown): SupportedChainId {
  const chainId = typeof value === "string" ? Number(value) : value;
  if (typeof chainId !== "number" || !Number.isInteger(chainId) || !isSupportedChainId(chainId)) {
    throw new ValidationError(`Unsupported or invalid chainId: ${String(value)}`);
  }
  return chainId;
}

export function assertAddress(value: unknown, field: string): `0x${string}` {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new ValidationError(`Invalid address for "${field}": ${String(value)}`);
  }
  return value;
}

/** Igual que assertAddress pero también acepta el sentinel de token nativo (todo ceros). */
export function assertTokenAddress(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(`Invalid token address for "${field}"`);
  }
  if (value === "0x0000000000000000000000000000000000000000") return value;
  return assertAddress(value, field);
}

/** Monto en unidades mínimas (wei): string de dígitos, sin signo, sin decimales. */
export function assertBaseUnitsAmount(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d+$/.test(value) || value === "0" || value.length > 78) {
    throw new ValidationError(`Invalid base-units amount for "${field}": ${String(value)}`);
  }
  return value;
}

/** Monto legible por humanos ("1.5"), tal como lo escribe el usuario en el input. */
export function assertHumanAmount(value: unknown, field: string): string {
  if (typeof value !== "string" || !isValidDecimalAmount(value)) {
    throw new ValidationError(`Invalid amount for "${field}": ${String(value)}`);
  }
  return value;
}

export function assertSlippage(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 50) {
    throw new ValidationError(`Invalid slippageTolerance: ${String(value)}`);
  }
  return value;
}

/** Símbolo de token para la Prices API: alfanumérico corto, ej. "ETH", "USDC". */
export function assertTokenSymbol(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9]{1,15}$/.test(value)) {
    throw new ValidationError(`Invalid token symbol for "${field}": ${String(value)}`);
  }
  return value.toUpperCase();
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Checklist pre-broadcast de la skill swap-integration: nunca transmitir un swap con calldata vacío o direcciones inválidas. */
export function validateSwapTransaction(swap: { data?: unknown; to?: unknown; from?: unknown; value?: unknown }): void {
  if (typeof swap.data !== "string" || swap.data === "" || swap.data === "0x") {
    throw new ValidationError("swap.data is empty - the quote may have expired, re-fetch it");
  }
  if (!isHex(swap.data)) {
    throw new ValidationError("swap.data is not valid hex");
  }
  if (typeof swap.to !== "string" || !isAddress(swap.to)) {
    throw new ValidationError("swap.to is not a valid address");
  }
  if (typeof swap.from !== "string" || !isAddress(swap.from)) {
    throw new ValidationError("swap.from is not a valid address");
  }
  if (swap.value === undefined || swap.value === null) {
    throw new ValidationError("swap.value is missing");
  }
}

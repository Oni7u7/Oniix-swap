"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * false en SSR y en el primer render del cliente; true después de la hidratación.
 * Úsalo para gatear cualquier rama de render derivada de estado client-only (wallet,
 * chain activa, tokens elegidos) para que el primer render del cliente sea
 * estructuralmente idéntico al de SSR — evita warnings de hydration mismatch en vez de
 * silenciarlos con suppressHydrationWarning.
 *
 * useSyncExternalStore (no useState+useEffect) a propósito: es el primitivo pensado
 * para "snapshot distinto en servidor vs. cliente" y no dispara el lint de
 * "setState dentro de un efecto" que sí dispara el patrón clásico mounted-flag.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

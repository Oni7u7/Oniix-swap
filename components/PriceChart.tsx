"use client";

import { AreaSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupportedChainId } from "@/lib/chains";
import { PRICE_TIMEFRAMES, usePriceHistory, type PriceTimeframe } from "@/lib/hooks/usePriceHistory";
import { usePriceCurrent } from "@/lib/hooks/usePriceCurrent";
import type { TokenInfo } from "@/lib/tokens";

interface PriceChartProps {
  selected: { token: TokenInfo; chainId: SupportedChainId } | null;
}

const UP_COLORS = { line: "#16a34a", top: "rgba(22,163,74,0.3)", bottom: "rgba(22,163,74,0.0)" };
const DOWN_COLORS = { line: "#dc2626", top: "rgba(220,38,38,0.3)", bottom: "rgba(220,38,38,0.0)" };

/**
 * lightweight-charts usa por defecto { precision: 2, minMove: 0.01 } — pensado para
 * precios tipo "$150.25". Con un stablecoin (rango real ~0.9996-0.9997, un spread de
 * ~0.00015) ese minMove cuantiza TODO el rango a un solo escalón de 0.01 y la línea
 * colapsa/desaparece, aunque los datos lleguen bien. Acá derivamos precision/minMove del
 * rango real de la serie: apuntamos a ~100 pasos distinguibles dentro del rango
 * observado. Para series con rango "normal" (ETH: cientos de dólares) esto converge al
 * mismo 2/0.01 de siempre; para stablecoins sube la precisión lo necesario para que la
 * variación real sea visible.
 */
function computePriceFormat(values: number[]): { precision: number; minMove: number } {
  if (values.length === 0) return { precision: 2, minMove: 0.01 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  // Si la serie es perfectamente plana (range ~0), usamos la magnitud del precio como
  // referencia en vez del rango para no dividir por ~0.
  const reference = range > 1e-12 ? range : Math.max(Math.abs(max), 1);

  const rawStep = reference / 100;
  const precision = Math.min(8, Math.max(2, Math.ceil(-Math.log10(rawStep))));
  const minMove = Math.pow(10, -precision);

  return { precision, minMove };
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  });
}

export function PriceChart({ selected }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<PriceTimeframe>("1D");
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const symbol = selected?.token.symbol ?? null;

  // Independientes del swap: cada uno con su propia query/caché (ver los hooks).
  const historyQuery = usePriceHistory(symbol, timeframe);
  const currentQuery = usePriceCurrent(symbol);

  const pctChange = useMemo(() => {
    const data = historyQuery.data;
    if (!data || data.length < 2) return null;
    const first = data[0]!.value;
    const last = data[data.length - 1]!.value;
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  }, [historyQuery.data]);

  // El chart de lightweight-charts se crea UNA sola vez (es una lib canvas imperativa,
  // no un componente React) y se destruye al desmontar. CRÍTICO: el <div ref={containerRef}>
  // de más abajo debe existir SIEMPRE en el DOM desde el primer render (nunca detrás de un
  // early-return condicional) — este efecto con deps [] corre una única vez al montar, y si
  // en ese momento el ref es null, el chart nunca se crea (no hay una segunda oportunidad).
  useEffect(() => {
    if (!containerRef.current) {
      console.warn("[PriceChart] containerRef es null al montar — el chart no se puede crear.");
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[PriceChart] contenedor al crear el chart:",
        containerRef.current.clientWidth,
        "x",
        containerRef.current.clientHeight
      );
    }
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#737373" },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(115,115,115,0.12)" } },
      timeScale: { timeVisible: true, secondsVisible: false },
      // Padding vertical extra: sin esto, con un rango casi plano (stablecoins) la línea
      // puede quedar pegada al borde superior/inferior aunque el autoscale funcione bien.
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.15 } },
      crosshair: { horzLine: { visible: false }, vertLine: { labelVisible: false } },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, { lineWidth: 2, ...UP_COLORS });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const data = historyQuery.data ?? [];
    if (process.env.NODE_ENV !== "production") {
      console.debug("[PriceChart] setData con", data.length, "puntos. primero:", data[0], "último:", data[data.length - 1]);
    }
    const colors = pctChange !== null && pctChange < 0 ? DOWN_COLORS : UP_COLORS;
    const priceFormat = computePriceFormat(data.map((p) => p.value));

    series.applyOptions({
      lineColor: colors.line,
      topColor: colors.top,
      bottomColor: colors.bottom,
      priceFormat: { type: "price", precision: priceFormat.precision, minMove: priceFormat.minMove },
    });
    series.setData(data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    if (data.length > 0) chart.timeScale().fitContent();
  }, [historyQuery.data, pctChange]);

  // OJO: nunca hacer un early-return acá arriba que omita el <div ref={containerRef}> de
  // abajo — el efecto de montaje del chart corre una sola vez, y si esa vez el div no
  // existe en el DOM (por un return condicional antes de este punto), el chart nunca se
  // crea aunque más tarde "selected" deje de ser null. El contenedor vive siempre montado
  // y los distintos estados (sin token / cargando / error) son overlays encima.
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 lg:max-w-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {selected?.token.symbol ?? "—"}
          </h2>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {selected && currentQuery.data !== undefined
                ? `$${formatUsd(currentQuery.data)}`
                : selected && currentQuery.isLoading
                  ? "…"
                  : "—"}
            </span>
            {selected && pctChange !== null && (
              <span className={`text-xs font-medium ${pctChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                {pctChange >= 0 ? "+" : ""}
                {pctChange.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          {PRICE_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              disabled={!selected}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                timeframe === tf
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-64">
        <div ref={containerRef} className="h-full w-full" />

        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white px-4 text-center text-xs text-neutral-500 dark:bg-neutral-950">
            Conecta tu wallet y elige un token en el swap para ver su gráfico.
          </div>
        )}
        {selected && historyQuery.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
            Cargando gráfico…
          </div>
        )}
        {selected && historyQuery.isError && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-600 dark:text-red-400">
            {historyQuery.error instanceof Error ? historyQuery.error.message : "No se pudo cargar el gráfico"}
          </div>
        )}
      </div>
    </div>
  );
}

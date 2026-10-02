"use client";

import { useState } from "react";
import { MAX_SLIPPAGE_PERCENT, MIN_SLIPPAGE_PERCENT } from "@/lib/constants";

const PRESETS = [0.1, 0.5, 1.0];

interface SlippageControlProps {
  value: number;
  onChange: (value: number) => void;
}

export function SlippageControl({ value, onChange }: SlippageControlProps) {
  const [customInput, setCustomInput] = useState("");
  const isCustom = !PRESETS.includes(value);

  function applyCustom(raw: string) {
    setCustomInput(raw);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_SLIPPAGE_PERCENT && parsed <= MAX_SLIPPAGE_PERCENT) {
      onChange(parsed);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-neutral-500">Slippage máximo</span>
      <div className="flex items-center gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setCustomInput("");
              onChange(preset);
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              !isCustom && value === preset
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {preset}%
          </button>
        ))}
        <input
          type="number"
          inputMode="decimal"
          placeholder="Custom"
          value={isCustom ? customInput || value : customInput}
          onChange={(e) => applyCustom(e.target.value)}
          min={MIN_SLIPPAGE_PERCENT}
          max={MAX_SLIPPAGE_PERCENT}
          step="0.1"
          className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <span className="text-xs text-neutral-400">%</span>
      </div>
      {value >= 5 && (
        <span className="text-xs text-amber-600 dark:text-amber-500">
          Un slippage alto te expone más a MEV/sandwich attacks.
        </span>
      )}
    </div>
  );
}

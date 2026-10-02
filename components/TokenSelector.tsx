"use client";

import type { TokenInfo } from "@/lib/tokens";

interface TokenSelectorProps {
  label: string;
  tokens: TokenInfo[];
  selected: TokenInfo;
  onSelect: (token: TokenInfo) => void;
  disabledAddress?: string;
}

export function TokenSelector({ label, tokens, selected, onSelect, disabledAddress }: TokenSelectorProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      <select
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium text-neutral-900 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        value={selected.address}
        onChange={(e) => {
          const token = tokens.find((t) => t.address === e.target.value);
          if (token) onSelect(token);
        }}
      >
        {tokens.map((token) => (
          <option
            key={token.address}
            value={token.address}
            disabled={disabledAddress?.toLowerCase() === token.address.toLowerCase()}
          >
            {token.symbol} — {token.name}
          </option>
        ))}
      </select>
    </label>
  );
}

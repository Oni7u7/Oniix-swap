import { SwapWorkspace } from "@/components/SwapWorkspace";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Oniix Swap</h1>
        <p className="text-sm text-zinc-500">Ethereum · Base · Optimism · Polygon · Arbitrum</p>
      </div>
      <SwapWorkspace />
    </div>
  );
}

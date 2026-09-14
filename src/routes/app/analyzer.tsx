import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/analyzer")({
  component: AnalyzerPage,
});

function AnalyzerPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Deal Analyzer
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Model a flip or wholesale deal: purchase price, rehab, ARV and
        estimated profit.
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        The analyzer calculator arrives in a later milestone.
      </div>
    </div>
  );
}
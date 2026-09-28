import type { MetricResult, Severity } from "@/lib/types";

type Strategy = "mobile" | "desktop";

type LighthouseAudit = {
  numericValue?: number;
  displayValue?: string;
};

type FieldMetric = {
  percentile?: number | string;
  category?: string;
};

type PageSpeedResponse = {
  loadingExperience?: {
    id?: string;
    metrics?: Record<string, FieldMetric>;
  };
  originLoadingExperience?: {
    id?: string;
    metrics?: Record<string, FieldMetric>;
  };
  lighthouseResult?: {
    finalUrl?: string;
    lighthouseVersion?: string;
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, LighthouseAudit>;
    runtimeError?: { message?: string };
  };
};

const LAB_METRICS = [
  { id: "first-contentful-paint", key: "fcp", label: "First Contentful Paint", unit: "ms", good: 1800, poor: 3000 },
  { id: "largest-contentful-paint", key: "lcp", label: "Largest Contentful Paint", unit: "ms", good: 2500, poor: 4000 },
  { id: "cumulative-layout-shift", key: "cls", label: "Cumulative Layout Shift", unit: "", good: 0.1, poor: 0.25 },
  { id: "total-blocking-time", key: "tbt", label: "Total Blocking Time", unit: "ms", good: 200, poor: 600 },
  { id: "speed-index", key: "speed_index", label: "Speed Index", unit: "ms", good: 3400, poor: 5800 },
] as const;

const FIELD_METRICS = [
  { key: "FIRST_CONTENTFUL_PAINT_MS", metricKey: "field_fcp", label: "First Contentful Paint", unit: "ms", good: 1800, poor: 3000 },
  { key: "LARGEST_CONTENTFUL_PAINT_MS", metricKey: "field_lcp", label: "Largest Contentful Paint", unit: "ms", good: 2500, poor: 4000 },
  { key: "CUMULATIVE_LAYOUT_SHIFT_SCORE", metricKey: "field_cls", label: "Cumulative Layout Shift", unit: "", good: 0.1, poor: 0.25 },
  { key: "INTERACTION_TO_NEXT_PAINT", metricKey: "field_inp", label: "Interaction to Next Paint", unit: "ms", good: 200, poor: 500 },
  { key: "EXPERIMENTAL_TIME_TO_FIRST_BYTE", metricKey: "field_ttfb", label: "Time to First Byte", unit: "ms", good: 800, poor: 1800 },
] as const;

function metricSeverity(value: number, good: number, poor: number): Severity {
  if (value <= good) return "info";
  if (value <= poor) return "medium";
  return "high";
}

function pageSpeedScoreSeverity(score: number): Severity {
  if (score >= 90) return "info";
  if (score >= 50) return "medium";
  return "high";
}

async function runStrategy(url: string, strategy: Strategy) {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(35_000),
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`PageSpeed returned HTTP ${response.status}.`);

  const result = (await response.json()) as PageSpeedResponse;
  if (result.lighthouseResult?.runtimeError) {
    throw new Error("Lighthouse could not load this page.");
  }

  const lighthouse = result.lighthouseResult;
  const rawScore = lighthouse?.categories?.performance?.score;
  if (typeof rawScore !== "number") throw new Error("PageSpeed did not return a Lighthouse performance score.");

  const evidence = {
    strategy,
    finalUrl: lighthouse?.finalUrl,
    lighthouseVersion: lighthouse?.lighthouseVersion,
  };
  const score = Math.round(rawScore * 100);
  const metrics: MetricResult[] = [
    {
      category: "performance",
      metricKey: `psi_${strategy}_performance_score`,
      metricLabel: `Lighthouse performance score (${strategy})`,
      numericValue: score,
      unit: "/100",
      status: pageSpeedScoreSeverity(score),
      source: "pagespeed-lab",
      evidence,
    },
  ];

  for (const definition of LAB_METRICS) {
    const value = lighthouse?.audits?.[definition.id]?.numericValue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    metrics.push({
      category: "performance",
      metricKey: `psi_${strategy}_${definition.key}`,
      metricLabel: `${definition.label} (${strategy})`,
      numericValue: value,
      unit: definition.unit,
      status: metricSeverity(value, definition.good, definition.poor),
      source: "pagespeed-lab",
      evidence: {
        ...evidence,
        displayValue: lighthouse?.audits?.[definition.id]?.displayValue,
      },
    });
  }

  return { strategy, result, metrics };
}

function hasFieldMetrics(data: PageSpeedResponse["loadingExperience"]) {
  return Boolean(data?.metrics && Object.keys(data.metrics).length);
}

function collectFieldMetrics(result: PageSpeedResponse): MetricResult[] {
  const pageData = result.loadingExperience;
  const originData = result.originLoadingExperience;
  const usePageData = hasFieldMetrics(pageData);
  const fieldData = usePageData ? pageData : originData;
  if (!fieldData?.metrics) return [];

  const scope = usePageData ? "page" : "origin";
  const metrics: MetricResult[] = [];
  for (const definition of FIELD_METRICS) {
    const rawValue = fieldData.metrics[definition.key]?.percentile;
    if (rawValue === undefined) continue;
    const percentile = Number(rawValue);
    if (!Number.isFinite(percentile)) continue;
    const value = definition.key === "CUMULATIVE_LAYOUT_SHIFT_SCORE" ? percentile / 100 : percentile;
    metrics.push({
      category: "performance",
      metricKey: definition.metricKey,
      metricLabel: `${definition.label} (p75, ${scope})`,
      numericValue: value,
      unit: definition.unit,
      status: metricSeverity(value, definition.good, definition.poor),
      source: "crux-field",
      evidence: {
        scope,
        recordId: fieldData.id,
        percentile: 75,
        category: fieldData.metrics[definition.key]?.category,
        period: "rolling 28 days",
      },
    });
  }
  return metrics;
}

export async function runPageSpeedAnalysis(url: string) {
  const strategies: Strategy[] = ["mobile", "desktop"];
  const settled = await Promise.allSettled(strategies.map((strategy) => runStrategy(url, strategy)));
  const successes = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const warnings = settled.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${strategies[index]} PageSpeed scan unavailable: ${result.reason instanceof Error ? result.reason.message : "request failed"}`]
      : [],
  );

  const metrics = successes.flatMap((result) => result.metrics);
  const fieldSource = successes.find((result) => hasFieldMetrics(result.result.loadingExperience)) ??
    successes.find((result) => hasFieldMetrics(result.result.originLoadingExperience));
  if (fieldSource) metrics.push(...collectFieldMetrics(fieldSource.result));

  return { metrics, warning: warnings.length ? warnings.join(" ") : null };
}
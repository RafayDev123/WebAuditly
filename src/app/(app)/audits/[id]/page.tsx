import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  auditMetrics,
  auditStages,
  audits,
  websites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/server";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils";
import { AuditProgress } from "@/components/audit/audit-progress";
import { RescanButton } from "@/components/audit/rescan-button";
import { PageSpeedScoreChart } from "@/components/audit/pagespeed-score-chart";
import { PageSpeedAutoRefresh } from "@/components/audit/pagespeed-auto-refresh";

export default async function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const audit = await db
    .select({
      id: audits.id,
      status: audits.status,
      createdAt: audits.createdAt,
      errorMessage: audits.errorMessage,
      domain: websites.domain,
    })
    .from(audits)
    .innerJoin(websites, eq(websites.id, audits.websiteId))
    .where(and(eq(audits.id, id), eq(audits.userId, user.userId)))
    .limit(1);

  if (!audit[0]) notFound();

  const [stages, metrics] = await Promise.all([
    db.select().from(auditStages).where(eq(auditStages.auditId, id)).orderBy(asc(auditStages.sortOrder)),
    db.select().from(auditMetrics).where(eq(auditMetrics.auditId, id)).orderBy(asc(auditMetrics.createdAt)),
  ]);

  const googleMetrics = metrics.filter((metric) => metric.source === "pagespeed-lab" || metric.source === "crux-field");
  const lighthouseMetrics = googleMetrics.filter((metric) => metric.source === "pagespeed-lab");
  const fieldMetrics = googleMetrics.filter((metric) => metric.source === "crux-field");
  const pageSpeedWarning = stages.find((stage) => stage.stageKey === "performance")?.details;
  const lighthouseCategories = [
    { id: "performance", label: "Performance" },
    { id: "accessibility", label: "Accessibility" },
    { id: "best-practices", label: "Best Practices" },
    { id: "seo", label: "SEO" },
  ] as const;
  const lighthouseScoreData = lighthouseCategories.map((category) => ({
    category: category.label,
    mobile: metrics.find((metric) => metric.metricKey === `psi_mobile_${category.id}_score`)?.numericValue ?? null,
    desktop: metrics.find((metric) => metric.metricKey === `psi_desktop_${category.id}_score`)?.numericValue ?? null,
  }));
  const needsGoogleRefresh = lighthouseScoreData.some((point) => point.mobile === null || point.desktop === null);

  function metricValue(metric: (typeof metrics)[number]) {
    if (metric.numericValue === null) return "—";
    const value = metric.metricKey.endsWith("_cls") ? metric.numericValue.toFixed(2) : metric.numericValue;
    return `${value}${metric.unit ? ` ${metric.unit}` : ""}`;
  }

  function metricSource(metric: (typeof metrics)[number]) {
    if (metric.source === "pagespeed-lab") {
      const strategy = metric.evidence?.strategy;
      return `Google Lighthouse${typeof strategy === "string" ? ` (${strategy})` : ""}`;
    }
    return "Google CrUX real-user data";
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">Audit report</p>
          <h1 className="text-2xl font-semibold">{audit[0].domain}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Scanned: {formatDateTime(audit[0].createdAt)}</p>
          <div className="mt-2">
            <StatusBadge status={audit[0].status} />
          </div>
        </div>
        <div className="flex gap-2">
          <RescanButton auditId={audit[0].id} />
        </div>
      </header>

      <AuditProgress auditId={audit[0].id} initialStatus={audit[0].status} />

      {audit[0].status === "failed" ? (
        <Card>
          <h2 className="text-base font-semibold">Audit failed</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{audit[0].errorMessage ?? "The scan could not complete."}</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-base font-semibold">Google PageSpeed Insights</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Lighthouse category scores from Google PageSpeed Insights.</p>
        {audit[0].status === "completed" ? (
          <PageSpeedAutoRefresh auditId={audit[0].id} needed={needsGoogleRefresh} />
        ) : null}
        {!lighthouseMetrics.length ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            PageSpeed results are unavailable. {pageSpeedWarning ?? "No Google Lighthouse results were saved for this audit."}
          </p>
        ) : null}
        {lighthouseMetrics.length > 0 && !fieldMetrics.length ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            CrUX field data is unavailable for this page or origin; lab results are shown below.
          </p>
        ) : null}
        <PageSpeedScoreChart data={lighthouseScoreData} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--muted-foreground)]">
              <tr>
                <th className="py-1">Category</th>
                <th className="py-1">Mobile</th>
                <th className="py-1">Desktop</th>
              </tr>
            </thead>
            <tbody>
              {lighthouseCategories.map((category) => (
                <tr key={category.id} className="border-t border-[var(--border-subtle)]">
                  <td className="py-2">{category.label}</td>
                  {(["mobile", "desktop"] as const).map((strategy) => {
                    const score = metrics.find(
                      (metric) => metric.metricKey === `psi_${strategy}_${category.id}_score`,
                    );
                    return (
                      <td key={strategy} className="mono py-2">
                        {score?.numericValue !== null && score ? `${score.numericValue} / 100` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--muted-foreground)]">
              <tr>
                <th className="py-1">Metric</th>
                <th className="py-1">Value</th>
                <th className="py-1">Source</th>
              </tr>
            </thead>
            <tbody>
              {googleMetrics.map((metric) => (
                <tr key={metric.id} className="border-t border-[var(--border-subtle)]">
                  <td className="py-1">{metric.metricLabel}</td>
                  <td className="mono py-1">{metricValue(metric)}</td>
                  <td className="py-1 text-[var(--muted-foreground)]">{metricSource(metric)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!googleMetrics.length ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">No Google metrics were collected.</p> : null}
      </Card>
    </div>
  );
}

import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  auditAiSummaries,
  auditFindings,
  auditMetrics,
  auditStages,
  auditTechnologies,
  audits,
  recommendations,
  websites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/server";
import { Card } from "@/components/ui/card";
import { ScoreRing } from "@/components/ui/score-ring";
import { ScoreBar } from "@/components/ui/score-bar";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils";
import { AuditProgress } from "@/components/audit/audit-progress";
import { RescanButton } from "@/components/audit/rescan-button";
import { DownloadReportButton } from "@/components/audit/download-report-button";

export default async function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const audit = await db
    .select({
      id: audits.id,
      websiteId: audits.websiteId,
      targetUrl: audits.targetUrl,
      status: audits.status,
      overallScore: audits.overallScore,
      performance: audits.performanceScore,
      seo: audits.seoScore,
      accessibility: audits.accessibilityScore,
      security: audits.securityScore,
      ux: audits.uxScore,
      scoreVersion: audits.scoreVersion,
      createdAt: audits.createdAt,
      completedAt: audits.completedAt,
      errorMessage: audits.errorMessage,
      domain: websites.domain,
    })
    .from(audits)
    .innerJoin(websites, eq(websites.id, audits.websiteId))
    .where(and(eq(audits.id, id), eq(audits.userId, user.userId)))
    .limit(1);

  if (!audit[0]) notFound();

  const [stages, findings, metrics, tech, recs, ai] = await Promise.all([
    db.select().from(auditStages).where(eq(auditStages.auditId, id)).orderBy(asc(auditStages.sortOrder)),
    db.select().from(auditFindings).where(eq(auditFindings.auditId, id)).orderBy(asc(auditFindings.createdAt)),
    db.select().from(auditMetrics).where(eq(auditMetrics.auditId, id)).orderBy(asc(auditMetrics.createdAt)),
    db.select().from(auditTechnologies).where(eq(auditTechnologies.auditId, id)).orderBy(asc(auditTechnologies.createdAt)),
    db.select().from(recommendations).where(eq(recommendations.auditId, id)).orderBy(asc(recommendations.priority)),
    db.select().from(auditAiSummaries).where(eq(auditAiSummaries.auditId, id)).limit(1),
  ]);

  const highCount = findings.filter((f) => f.severity === "high" || f.severity === "critical").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;
  const lighthouseMetrics = metrics.filter((metric) => metric.source === "pagespeed-lab");
  const fieldMetrics = metrics.filter((metric) => metric.source === "crux-field");
  const pageSpeedWarning = stages.find((stage) => stage.stageKey === "performance")?.details;

  function metricValue(metric: (typeof metrics)[number]) {
    if (metric.numericValue === null) return "—";
    const value = metric.metricKey.endsWith("_cls") ? metric.numericValue.toFixed(2) : metric.numericValue;
    return `${value}${metric.unit ? ` ${metric.unit}` : ""}`;
  }

  function metricSource(metric: (typeof metrics)[number]) {
    if (metric.source === "pagespeed-lab") {
      const strategy = metric.evidence?.strategy;
      return `Lighthouse${typeof strategy === "string" ? ` (${strategy})` : ""}`;
    }
    if (metric.source === "crux-field") return "CrUX field data";
    return "Custom HTTP check";
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
          {audit[0].status === "completed" ? (
            <DownloadReportButton
              report={{
                domain: audit[0].domain,
                targetUrl: audit[0].targetUrl,
                createdAt: audit[0].createdAt.toISOString(),
                overallScore: audit[0].overallScore,
                performance: audit[0].performance,
                seo: audit[0].seo,
                accessibility: audit[0].accessibility,
                security: audit[0].security,
                ux: audit[0].ux,
                summary: ai[0]?.summary ?? null,
                findings: findings.map((finding) => ({
                  title: finding.title,
                  severity: finding.severity,
                  summary: finding.summary,
                  recommendedFix: finding.recommendedFix,
                })),
                metrics: metrics.map((metric) => ({
                  metricLabel: metric.metricLabel,
                  numericValue: metric.numericValue,
                  unit: metric.unit,
                  source: metric.source,
                })),
                technologies: tech.map((technology) => ({
                  name: technology.name,
                  category: technology.category,
                  confidence: technology.confidence,
                })),
                recommendations: recs.map((recommendation) => ({
                  priority: recommendation.priority,
                  title: recommendation.title,
                  description: recommendation.description,
                })),
              }}
            />
          ) : null}
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

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="grid place-items-center">
          <ScoreRing score={audit[0].overallScore ?? 0} />
          <p className="mono mt-2 text-3xl font-semibold">{audit[0].overallScore ?? "—"} / 100</p>
          <p className="text-sm text-[var(--muted-foreground)]">Custom site audit score</p>
          <p className="text-sm text-[var(--muted-foreground)]">Score version {audit[0].scoreVersion}</p>
        </Card>

        <Card className="space-y-3">
          <ScoreBar label="HTTP performance checks" score={audit[0].performance ?? 0} />
          <ScoreBar label="SEO" score={audit[0].seo ?? 0} />
          <ScoreBar label="Accessibility" score={audit[0].accessibility ?? 0} />
          <ScoreBar label="Security" score={audit[0].security ?? 0} />
          <ScoreBar label="UX" score={audit[0].ux ?? 0} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Priority findings</h2>
          <div className="mt-3 flex gap-2 text-sm">
            <span className="rounded-full bg-rose-500/15 px-2 py-1 text-rose-400">{highCount} High</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-400">{mediumCount} Medium</span>
            <span className="rounded-full bg-sky-500/15 px-2 py-1 text-sky-400">{lowCount} Low</span>
          </div>
          <div className="mt-4 space-y-3">
            {findings.slice(0, 6).map((finding) => (
              <details key={finding.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                  <span>{finding.title}</span>
                  <SeverityBadge severity={finding.severity} />
                </summary>
                <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                  <p>{finding.summary}</p>
                  <p>
                    <strong className="text-[var(--foreground)]">Why it matters:</strong> {finding.whyItMatters}
                  </p>
                  <p>
                    <strong className="text-[var(--foreground)]">Recommended fix:</strong> {finding.recommendedFix}
                  </p>
                  {finding.technicalDetails ? <p className="mono text-xs">{finding.technicalDetails}</p> : null}
                </div>
              </details>
            ))}
            {!findings.length ? <p className="text-sm text-[var(--muted-foreground)]">No unresolved issues were detected in this scan.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">AI summary</h2>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">{ai[0]?.summary ?? "AI summary is unavailable for this audit."}</p>
          <h3 className="mt-4 text-sm font-semibold">Top 3 priorities</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-[var(--muted-foreground)]">
            {(ai[0]?.topProblems ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <h3 className="mt-4 text-sm font-semibold">Why these first?</h3>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{ai[0]?.businessImpact ?? "Recommendations are prioritized by weighted score impact and severity."}</p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Technology stack</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {tech.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-2 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {item.category} · {item.confidence} confidence
                </p>
              </div>
            ))}
            {!tech.length ? <p className="text-sm text-[var(--muted-foreground)]">Not confidently detected.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Google PageSpeed results</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {(["mobile", "desktop"] as const).map((strategy) => {
              const score = metrics.find((metric) => metric.metricKey === `psi_${strategy}_performance_score`);
              return (
                <div key={strategy} className="border-l-2 border-[var(--border)] pl-3">
                  <p className="text-xs capitalize text-[var(--muted-foreground)]">Lighthouse {strategy}</p>
                  <p className="mono mt-1 text-2xl font-semibold">
                    {score?.numericValue !== null && score ? `${score.numericValue} / 100` : "—"}
                  </p>
                </div>
              );
            })}
          </div>
          {!lighthouseMetrics.length ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              PageSpeed results are unavailable. {pageSpeedWarning ?? "The custom HTTP checks are still available below."}
            </p>
          ) : null}
          {lighthouseMetrics.length > 0 && !fieldMetrics.length ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              CrUX field data is unavailable for this page or origin; lab results are shown below.
            </p>
          ) : null}
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
                {metrics.map((metric) => (
                  <tr key={metric.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-1">{metric.metricLabel}</td>
                    <td className="mono py-1">{metricValue(metric)}</td>
                    <td className="py-1 text-[var(--muted-foreground)]">{metricSource(metric)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!metrics.length ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">No sufficient lab data collected.</p> : null}
        </Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold">Recommended order</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-[var(--muted-foreground)]">
          {recs.map((rec) => (
            <li key={rec.id}>
              <span className="font-medium text-[var(--foreground)]">{rec.title}</span> — {rec.description}
            </li>
          ))}
          {!recs.length ? <li>No recommendations available.</li> : null}
        </ol>
      </Card>
    </div>
  );
}

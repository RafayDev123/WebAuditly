"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";

type ReportData = {
  domain: string;
  targetUrl: string;
  createdAt: string;
  overallScore: number | null;
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  security: number | null;
  ux: number | null;
  summary: string | null;
  findings: Array<{
    title: string;
    severity: string;
    summary: string;
    recommendedFix: string;
  }>;
  metrics: Array<{
    metricLabel: string;
    numericValue: number | null;
    unit: string | null;
    source: string;
  }>;
  technologies: Array<{
    name: string;
    category: string;
    confidence: string;
  }>;
  recommendations: Array<{
    priority: number;
    title: string;
    description: string;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function DownloadReportButton({ report }: { report: ReportData }) {
  const [loading, setLoading] = useState(false);

  function downloadReport() {
    setLoading(true);

    try {
      const document = new jsPDF();
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const margin = 42;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - margin) {
          document.addPage();
          y = margin;
        }
      };

      const addText = (text: string, size = 10, gap = 5) => {
        document.setFontSize(size);
        const lines = document.splitTextToSize(text, contentWidth) as string[];
        ensureSpace(lines.length * 14 + gap);
        document.text(lines, margin, y);
        y += lines.length * 14 + gap;
      };

      const addHeading = (text: string) => {
        ensureSpace(28);
        document.setFont("helvetica", "bold");
        addText(text, 13, 8);
        document.setFont("helvetica", "normal");
      };

      document.setFont("helvetica", "bold");
      addText("WebsiteAudit AI - Audit Report", 20, 10);
      document.setFont("helvetica", "normal");
      addText(report.domain, 14, 3);
      addText(report.targetUrl, 10, 3);
      addText(`Scanned: ${formatDate(report.createdAt)}`, 10, 14);

      addHeading("Overall score");
      addText(`${report.overallScore ?? "-"} / 100`, 22, 12);

      addHeading("Category scores");
      addText(
        [
          `Performance: ${report.performance ?? "-"}`,
          `SEO: ${report.seo ?? "-"}`,
          `Accessibility: ${report.accessibility ?? "-"}`,
          `Security: ${report.security ?? "-"}`,
          `UX: ${report.ux ?? "-"}`,
        ].join(" | "),
        10,
        12,
      );

      addHeading("Summary");
      addText(report.summary ?? "No summary is available for this audit.", 10, 12);

      addHeading("Priority findings");
      if (report.findings.length) {
        report.findings.forEach((finding, index) => {
          addText(`${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`, 10, 2);
          addText(`Summary: ${finding.summary}`, 9, 2);
          addText(`Recommended fix: ${finding.recommendedFix}`, 9, 8);
        });
      } else {
        addText("No unresolved issues were detected.", 10, 10);
      }

      addHeading("Performance metrics");
      if (report.metrics.length) {
        report.metrics.forEach((metric) => {
          addText(`${metric.metricLabel}: ${metric.numericValue ?? "-"} ${metric.unit ?? ""} (${metric.source})`, 10, 4);
        });
      } else {
        addText("No sufficient lab data collected.", 10, 10);
      }

      addHeading("Technology stack");
      addText(
        report.technologies.length
          ? report.technologies.map((technology) => `${technology.name} - ${technology.category} (${technology.confidence} confidence)`).join("\n")
          : "No technologies were confidently detected.",
        10,
        10,
      );

      addHeading("Recommended order");
      addText(
        report.recommendations.length
          ? report.recommendations.map((recommendation) => `${recommendation.priority}. ${recommendation.title}: ${recommendation.description}`).join("\n")
          : "No recommendations are available.",
        10,
        10,
      );

      const totalPages = document.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        document.setPage(page);
        document.setFontSize(8);
        document.setTextColor(110, 110, 110);
        document.text(`WebsiteAudit AI | Page ${page} of ${totalPages}`, margin, pageHeight - 20);
        document.setTextColor(0, 0, 0);
      }

      const filename = `${report.domain.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "website"}-audit-report.pdf`;
      document.save(filename);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={downloadReport} disabled={loading}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {loading ? "Preparing PDF..." : "Download report"}
    </Button>
  );
}

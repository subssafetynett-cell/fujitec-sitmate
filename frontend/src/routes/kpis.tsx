import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/sheq/primitives";
import { KpiDisciplineWorkspace } from "@/components/sheq/kpi-discipline-workspace";
import { KpiExportProvider, useKpiExport } from "@/lib/kpi-export-context";
import { useSheq } from "@/lib/sheq-context";

export const Route = createFileRoute("/kpis")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Track occupational health & safety, environmental, quality and lift regulation KPIs with targets, trends and monthly comparisons.",
      },
      { property: "og:title", content: "Sitemate" },
      { property: "og:description", content: "Targets, trends and monthly comparison for every SHEQ KPI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KpiPage,
});

function shortLabelFor(slug: string, short: string, label: string) {
  if (slug === "health-safety") return "OHS";
  if (slug === "lift-regulations") return "Lift Regs";
  return short || label;
}

function KpiExportButton() {
  const { exportPdf, exporting } = useKpiExport();

  return (
    <Button
      variant="outline"
      className="rounded-xl"
      disabled={exporting}
      onClick={() => {
        void exportPdf().catch(() => {
          /* toast handled in exporters */
        });
      }}
    >
      {exporting ? <Loader2 className="animate-spin" /> : <Download />}
      {exporting ? "Exporting…" : "Export"}
    </Button>
  );
}

function KpiPageContent() {
  const { kpiGroups } = useSheq();
  const [activeTab, setActiveTab] = useState(kpiGroups[0]!.slug);

  return (
    <>
      <PageHeader
        title="KPI Management"
        description="Dedicated dashboards for occupational health & safety, environmental, quality and lift regulation performance."
        actions={<KpiExportButton />}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 h-auto flex-wrap gap-1 rounded-xl p-1">
          {kpiGroups.map((g) => (
            <TabsTrigger key={g.slug} value={g.slug} className="rounded-lg px-4 py-2 text-sm">
              {g.short}
            </TabsTrigger>
          ))}
        </TabsList>
        {kpiGroups.map((g) => (
          <TabsContent key={g.slug} value={g.slug}>
            {activeTab === g.slug ? (
              <KpiDisciplineWorkspace
                slug={g.slug}
                label={g.label}
                shortLabel={shortLabelFor(g.slug, g.short, g.label)}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function KpiPage() {
  return (
    <KpiExportProvider>
      <KpiPageContent />
    </KpiExportProvider>
  );
}

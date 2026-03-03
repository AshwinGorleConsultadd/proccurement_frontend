import { useEffect, useMemo } from "react";
import { useProjects } from "../../redux/hooks/project/useProjects";
import {
  Images,
  Layers,
  CalendarDays,
  FileJson,
  TrendingUp,
  Loader2,
  Package,
} from "lucide-react";

/* ── Summary Tab ────────────────────────────────────────────────────────── */
export function SummaryTab({ project }) {
  const { projectPages, pagesLoading, loadProjectPages } = useProjects();
  const id = project._id ?? project.id; // MongoDB _id
  const savedData = projectPages[id];
  const savedImages = savedData?.images ?? [];

  useEffect(() => {
    loadProjectPages(id);
  }, [id, loadProjectPages]);

  const byPage = useMemo(() => {
    const acc = {};
    for (const img of savedImages) {
      const p = img.page_number ?? img.page_num ?? "Unknown";
      if (!acc[p]) acc[p] = [];
      acc[p].push(img);
    }
    return acc;
  }, [savedImages]);

  const pageEntries = Object.entries(byPage).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Images",
              value: savedImages.length,
              icon: Images,
              from: "from-violet-500/10",
              iconCls: "text-violet-400",
            },
            {
              label: "Pages Used",
              value: pageEntries.length,
              icon: Layers,
              from: "from-indigo-500/10",
              iconCls: "text-indigo-400",
            },
            {
              label: "Created",
              value: formatDate(project.created_at),
              icon: CalendarDays,
              from: "from-emerald-500/10",
              iconCls: "text-emerald-400",
              small: true,
            },
          ].map(({ label, value, icon: Icon, from, iconCls, small }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4"
            >
              <div
                className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${from} to-transparent flex items-center justify-center`}
              >
                <Icon className={`h-5 w-5 ${iconCls}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  {label}
                </p>
                <p
                  className={`font-bold leading-tight mt-0.5 ${small ? "text-base" : "text-2xl"}`}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
        {project.pdf_name && (
          <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <FileJson className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Source PDF
              </p>
              <p className="text-sm font-semibold mt-0.5">{project.pdf_name}</p>
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-violet-400" />
            <span className="font-semibold text-sm">Pages Breakdown</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {pageEntries.length} pages
            </span>
          </div>
          {pagesLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : pageEntries.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <Package className="h-9 w-9 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No pages saved yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Switch to Source tab to add pages.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {pageEntries.map(([page, imgs], idx) => (
                <div
                  key={page}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <span className="text-xs text-muted-foreground/40 w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-violet-400">
                      {page}
                    </span>
                  </div>
                  <span className="text-sm font-medium flex-1">
                    Page {page}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-1 font-semibold">
                    {imgs.length} image{imgs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

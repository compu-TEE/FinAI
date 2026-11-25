"use client";

import { useMemo, useState } from "react";

type DocumentationTabsProps = {
  srsContent: string;
  userStoriesContent?: string;
  useCasesContent?: string;
  acceptanceCriteriaContent?: string;
  traceabilityContent?: string;
  hasRequirements: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
};

type SRSSection = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  lines: string[];
};

function parseIEEEContent(raw: string): SRSSection[] {
  if (!raw.trim()) return [];

  const lines = raw.split("\n");
  const sections: SRSSection[] = [];
  let current: SRSSection | null = null;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const h3 = trimmed.match(/^###\s+(.+)/);
    const h2 = trimmed.match(/^##\s+(.+)/);
    const h1 = trimmed.match(/^#\s+(.+)/);

    if (h3 || h2 || h1) {
      if (current) sections.push(current);
      const level = h3 ? 3 : h2 ? 2 : 1;
      const title = (h3?.[1] || h2?.[1] || h1?.[1] || "").trim();
      current = {
        id: `srs-sec-${idx}`,
        level,
        title,
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    } else if (trimmed) {
      current = {
        id: `srs-sec-${idx}`,
        level: 1,
        title: "Overview",
        lines: [line],
      };
    }
  });

  if (current) sections.push(current);
  return sections;
}

function renderFormattedLine(line: string, idx: number) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={idx} className="h-2" />;

  // Bullet point (- or *)
  if (/^[-*]\s+/.test(trimmed)) {
    const text = trimmed.replace(/^[-*]\s+/, "");
    const colonIdx = text.indexOf(":");
    return (
      <div key={idx} className="flex items-start gap-2.5 pl-2 text-sm leading-6 text-zinc-700">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
        <span>
          {colonIdx > 0 && colonIdx < 40 ? (
            <>
              <strong className="font-semibold text-zinc-900">
                {text.slice(0, colonIdx + 1)}
              </strong>
              {text.slice(colonIdx + 1)}
            </>
          ) : (
            text
          )}
        </span>
      </div>
    );
  }

  return (
    <p key={idx} className="text-sm leading-6 text-zinc-700">
      {trimmed}
    </p>
  );
}

export default function DocumentationTabs({
  srsContent,
  hasRequirements,
  isGenerating,
  onGenerate,
}: DocumentationTabsProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const sections = useMemo(() => parseIEEEContent(srsContent), [srsContent]);

  // Major sections (level 1 & 2) for clean navigation
  const navSections = useMemo(
    () => sections.filter((s) => s.level <= 2),
    [sections]
  );

  // If a specific section is focused, include it and any nested subsections (level 3) until the next level <= 2 section
  const visibleSections = useMemo(() => {
    if (selectedSectionId === "all") return sections;
    const startIdx = sections.findIndex((s) => s.id === selectedSectionId);
    if (startIdx === -1) return sections;

    const selected = sections[startIdx];
    const result: SRSSection[] = [selected];
    for (let i = startIdx + 1; i < sections.length; i++) {
      if (sections[i].level <= selected.level) break;
      result.push(sections[i]);
    }
    return result;
  }, [sections, selectedSectionId]);

  const currentNavIndex = navSections.findIndex(
    (s) => s.id === selectedSectionId
  );

  const handleCopy = async () => {
    if (!srsContent) return;
    await navigator.clipboard.writeText(srsContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Software Requirements Specification (IEEE 830)
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Standardized IEEE SRS generated from your validated project requirements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {srsContent && (
            <button
              onClick={handleCopy}
              className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {copied ? "Copied!" : "Copy SRS"}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={!hasRequirements || isGenerating}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating
              ? "Generating SRS..."
              : srsContent
                ? "Regenerate SRS"
                : "Generate IEEE SRS"}
          </button>
        </div>
      </div>

      {!srsContent ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-zinc-800">
            No SRS document generated yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {hasRequirements
              ? "Click Generate IEEE SRS to produce a structured IEEE 830 specification."
              : "Extract requirements in Elicitation Chat first to generate the SRS."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] items-start">
          {/* Left Sticky Index / Table of Contents */}
          <aside className="sticky top-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                SRS Index
              </h3>
              {selectedSectionId !== "all" && (
                <button
                  onClick={() => setSelectedSectionId("all")}
                  className="text-[11px] font-medium text-zinc-600 underline hover:text-zinc-900"
                >
                  View All
                </button>
              )}
            </div>

            <nav className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedSectionId("all")}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ${
                  selectedSectionId === "all"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                Full Document
              </button>

              {navSections.map((sec) => {
                const isActive = selectedSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`w-full rounded-lg py-1.5 pr-2.5 text-left text-xs transition ${
                      sec.level === 1
                        ? "mt-2 pl-2.5 font-semibold"
                        : "pl-5 font-normal"
                    } ${
                      isActive
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {sec.title}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Formatted IEEE SRS Reader */}
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-xs">
            <div className="space-y-6">
              {visibleSections.map((sec) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className={
                    sec.level === 1
                      ? "border-b border-zinc-200 pb-6 last:border-b-0"
                      : "pt-1"
                  }
                >
                  {sec.level === 1 && (
                    <h3 className="mb-3 text-xl font-bold tracking-tight text-zinc-900">
                      {sec.title}
                    </h3>
                  )}
                  {sec.level === 2 && (
                    <h4 className="mb-2 text-base font-semibold text-zinc-900">
                      {sec.title}
                    </h4>
                  )}
                  {sec.level === 3 && (
                    <h5 className="mb-2 mt-3 rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-800 border-l-2 border-zinc-900">
                      {sec.title}
                    </h5>
                  )}

                  <div className="space-y-1.5">
                    {sec.lines.map((line, lIdx) => renderFormattedLine(line, lIdx))}
                  </div>
                </section>
              ))}
            </div>

            {/* Section-by-Section Stepper Controls */}
            {navSections.length > 0 && (
              <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-4">
                <button
                  onClick={() => {
                    if (selectedSectionId === "all") {
                      setSelectedSectionId(navSections[0].id);
                    } else if (currentNavIndex > 0) {
                      setSelectedSectionId(navSections[currentNavIndex - 1].id);
                    }
                  }}
                  disabled={selectedSectionId !== "all" && currentNavIndex <= 0}
                  className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous Section
                </button>

                <span className="text-xs text-zinc-400">
                  {selectedSectionId === "all"
                    ? `Showing all ${navSections.length} sections`
                    : `Section ${currentNavIndex + 1} of ${navSections.length}`}
                </span>

                <button
                  onClick={() => {
                    if (selectedSectionId === "all") {
                      setSelectedSectionId(navSections[0].id);
                    } else if (currentNavIndex < navSections.length - 1) {
                      setSelectedSectionId(navSections[currentNavIndex + 1].id);
                    }
                  }}
                  disabled={
                    selectedSectionId !== "all" &&
                    currentNavIndex >= navSections.length - 1
                  }
                  className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next Section →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
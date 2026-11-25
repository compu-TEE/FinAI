"use client";

import { NavSection, ProjectSummary } from "../types";

type SidebarProps = {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  projects: ProjectSummary[];
  currentProjectId: number | null;
  currentProjectName: string;
  onSelectProject: (projectId: number) => void;
  onNewProject: () => void;
  counts: {
    requirements: number;
    issues: number;
    compliance: number;
    risks: number;
    hasDocs: boolean;
  };
};

export default function Sidebar({
  activeSection,
  onSelectSection,
  projects,
  currentProjectId,
  currentProjectName,
  onSelectProject,
  onNewProject,
  counts,
}: SidebarProps) {
  const navItems: { id: NavSection; label: string; badge?: string | number }[] = [
    { id: "overview", label: "Overview" },
    { id: "chat", label: "Elicitation Chat" },
    { id: "requirements", label: "Requirements", badge: counts.requirements || undefined },
    {
      id: "analysis",
      label: "Quality, Compliance & Risk",
      badge: counts.issues + counts.compliance + counts.risks || undefined,
    },
    { id: "sdlc", label: "SDLC & Workflow" },
    { id: "documentation", label: "Documentation", badge: counts.hasDocs ? "IEEE" : undefined },
    { id: "knowledge", label: "Knowledge Base" },
  ];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6">
      <div className="mb-6 px-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          FinAI
        </span>
        <h1 className="mt-0.5 text-base font-semibold text-zinc-900">
          Requirements Studio
        </h1>
      </div>

      {/* Project Switcher */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Project
          </span>
          <button
            type="button"
            onClick={onNewProject}
            className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-zinc-800"
          >
            + New
          </button>
        </div>

        <select
          aria-label="Select project"
          value={currentProjectId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id) onSelectProject(id);
          }}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400"
        >
          {projects.length === 0 ? (
            <option value={currentProjectId ?? ""}>{currentProjectName}</option>
          ) : (
            projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
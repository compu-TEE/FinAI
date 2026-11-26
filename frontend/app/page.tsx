"use client";

import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import DocumentationTabs from "./components/DocumentationTabs";
import { API_BASE_URL } from "./lib/api";
import AuthPage, { AuthUser } from "./components/AuthPage";
import {
  ComplianceAnalysis,
  Message,
  NavSection,
  ProjectSummary,
  QualityAnalysis,
  Requirement,
  RiskAnalysis,
  SDLCRecommendation,
  SDLCWorkflow,
} from "./types";

const SDLC_MODELS = [
  "Waterfall",
  "V-Model",
  "Prototyping",
  "Iterative/Incremental",
  "RAD",
  "Spiral",
  "Agile",
];

export default function Home() {
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [currentProjectName, setCurrentProjectName] = useState("Current Project");
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState("");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [missingInformation, setMissingInformation] = useState<string[]>([]);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
  const [complianceAnalysis, setComplianceAnalysis] = useState<ComplianceAnalysis | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);

  const [srsContent, setSrsContent] = useState("");
  const [userStoriesContent, setUserStoriesContent] = useState("");
  const [useCasesContent, setUseCasesContent] = useState("");
  const [acceptanceCriteriaContent, setAcceptanceCriteriaContent] = useState("");
  const [traceabilityContent, setTraceabilityContent] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [sdlcRecommendation, setSdlcRecommendation] =
    useState<SDLCRecommendation | null>(null);
  const [sdlcWorkflow, setSdlcWorkflow] = useState<SDLCWorkflow | null>(null);
  const [sdlcLoading, setSdlcLoading] = useState(false);
  const [overrideModel, setOverrideModel] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverridingSDLC, setIsOverridingSDLC] = useState(false);

  const [ragQuery, setRagQuery] = useState("");
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragSources, setRagSources] = useState<
    { source: string; chunk_id: number; distance: number }[]
  >([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [documentationLoading, setDocumentationLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const hydrateProjectData = (data: any) => {
    if (data.project?.id) setCurrentProjectId(data.project.id);
    if (data.project?.name) setCurrentProjectName(data.project.name);

    const loadedRequirements = (data.requirements || []).map((req: any) => ({
      id: req.requirement_code,
      db_id: req.id,
      statement: req.statement,
      category: req.category,
      source_stakeholder: req.source_stakeholder,
      business_justification: req.business_justification,
      priority: req.priority,
      dependencies: req.dependencies || [],
      assumptions: req.assumptions || [],
      acceptance_criteria: req.acceptance_criteria || [],
      applicable_regulations: req.applicable_regulations || [],
      risk_level: req.risk_level,
      confidence_score: req.confidence_score,
      approval_status: req.approval_status,
    }));

    setRequirements(loadedRequirements);
    setMessages(data.messages || []);

    if (data.quality_analysis?.length > 0) {
      setQualityAnalysis(data.quality_analysis[data.quality_analysis.length - 1]);
    } else {
      setQualityAnalysis(null);
    }

    if (data.compliance_findings?.length > 0) {
      setComplianceAnalysis({
        findings: data.compliance_findings,
        summary: "Compliance analysis performed using retrieved regulatory evidence.",
      });
    } else {
      setComplianceAnalysis(null);
    }

    if (data.risk_findings?.length > 0) {
      setRiskAnalysis({
        findings: data.risk_findings,
        summary: "Risk analysis performed using requirements and regulatory evidence.",
      });
    } else {
      setRiskAnalysis(null);
    }

    if (data.sdlc_recommendations?.length > 0) {
      const latestSDLC =
        data.sdlc_recommendations[data.sdlc_recommendations.length - 1];
      setSdlcRecommendation({
        id: latestSDLC.id,
        recommended_model: latestSDLC.recommended_model,
        reasoning: latestSDLC.reasoning,
        key_factors: latestSDLC.key_factors || [],
        approval_status: latestSDLC.approval_status || "Draft",
      });
    } else {
      setSdlcRecommendation(null);
    }

    if (data.documentation_artifacts?.length > 0) {
      const artifacts = data.documentation_artifacts;
      const findArtifact = (type: string) =>
        artifacts.find((a: any) => a.artifact_type === type)?.content || "";

      setSrsContent(findArtifact("SRS"));
      setUserStoriesContent(findArtifact("User Stories"));
      setUseCasesContent(findArtifact("Use Cases"));
      setAcceptanceCriteriaContent(findArtifact("Acceptance Criteria"));
      setTraceabilityContent(findArtifact("Traceability"));
    } else {
      setSrsContent("");
      setUserStoriesContent("");
      setUseCasesContent("");
      setAcceptanceCriteriaContent("");
      setTraceabilityContent("");
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`);
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const loadProjectById = async (projectId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
      const data = await response.json();
      if (!data.project) return;
      hydrateProjectData(data);
      setSdlcWorkflow(null);
      setIsOverridingSDLC(false);
      setErrorMessage("");
    } catch (error) {
      console.error("Failed to load project:", error);
      setErrorMessage("Failed to load selected project.");
    }
  };

// const createNewProject = async () => {
//   const enteredName = window.prompt(
//     "Enter a name for the new project:",
//     `Project #${projects.length + 1}`
//   );
//   if (enteredName === null) return;

//   try {
//     const response = await fetch(`${API_BASE_URL}/project/new`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ name: enteredName.trim() }),
//     });
//     if (!response.ok) throw new Error("Failed to create new project");
//     const newProj = await response.json();

//     setProjects((prev) => [newProj, ...prev.filter((p) => p.id !== newProj.id)]);
//     setCurrentProjectId(newProj.id);
//     setCurrentProjectName(newProj.name);
//     setMessages([]);
//     setRequirements([]);
//     setMissingInformation([]);
//     setClarificationQuestions([]);
//     setQualityAnalysis(null);
//     setComplianceAnalysis(null);
//     setRiskAnalysis(null);
//     setSrsContent("");
//     setSdlcRecommendation(null);
//     setSdlcWorkflow(null);
//     setIsOverridingSDLC(false);
//     setOverrideReason("");
//     setRagQuery("");
//     setRagAnswer("");
//     setRagSources([]);
//     setErrorMessage("");
//     setEditingId(null);
//     setEditText("");
//     await loadProjects();
//   } catch (error) {
//     console.error("Failed to create new project:", error);
//     setErrorMessage("Failed to create a new project. Please try again.");
//   }
// };

const sendMessage = async () => {
  if (!message.trim() || loading) return;
  setActiveOperation("chat");
  const userMessage: Message = { role: "user", content: message };
  const updatedMessages = [...messages, userMessage];

  setMessages(updatedMessages);
  setMessage("");
  setLoading(true);

  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: currentProjectId,
        messages: updatedMessages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Chat request failed");

    const modelMessage: Message = { role: "model", content: data.response };
    setMessages([...updatedMessages, modelMessage]);

    const projectUrl = currentProjectId
      ? `${API_BASE_URL}/projects/${currentProjectId}`
      : `${API_BASE_URL}/project`;
    const projectRes = await fetch(projectUrl);
    const projectData = await projectRes.json();

    if (projectData.project?.id && !currentProjectId) {
      setCurrentProjectId(projectData.project.id);
      setCurrentProjectName(projectData.project.name);
      await loadProjects();
    }

    const requirementsWithDbIds = (data.requirements || []).map(
      (req: Requirement) => {
        const dbRequirement = projectData.requirements?.find(
          (dbReq: any) => dbReq.statement === req.statement
        );
        return { ...req, db_id: dbRequirement?.id };
      }
    );

    setRequirements(requirementsWithDbIds);
    setMissingInformation(data.missing_information || []);
    setClarificationQuestions(data.clarification_questions || []);
  } catch {
    setMessages([
      ...updatedMessages,
      { role: "model", content: "Failed to connect to the backend." },
    ]);
  } finally {
    setLoading(false);
    setActiveOperation(null);
  }
};

  const updateRequirementStatus = async (id: string, status: string) => {
    const requirement = requirements.find((req) => req.id === id);
    if (!requirement?.db_id) {
      setErrorMessage("Database requirement ID not found.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/requirements/${requirement.db_id}/approval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.detail || "Approval update failed");

      setRequirements((current) =>
        current.map((req) =>
          req.id === id ? { ...req, approval_status: updated.approval_status } : req
        )
      );
    } catch (error) {
      console.error("Approval update failed:", error);
      setErrorMessage("Failed to update requirement approval.");
    }
  };

  const startEditing = (req: Requirement) => {
    setEditingId(req.id);
    setEditText(req.statement);
  };

  const saveEdit = (id: string) => {
    if (!editText.trim()) return;
    setRequirements((current) =>
      current.map((req) =>
        req.id === id ? { ...req, statement: editText.trim() } : req
      )
    );
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

const analyzeRequirements = async () => {
  if (requirements.length === 0 || loading) return;
  setActiveOperation("quality");
  setLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: currentProjectId,
        requirements,
        missing_information: missingInformation,
        clarification_questions: [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Quality analysis failed");
    setQualityAnalysis(data);
    setActiveSection("analysis");
  } catch (error: any) {
    console.error("Quality analysis failed:", error);
    setErrorMessage(error.message || "Failed to analyze requirements.");
  } finally {
    setLoading(false);
    setActiveOperation(null);
  }
};

const analyzeCompliance = async () => {
  if (requirements.length === 0 || loading) return;
  setActiveOperation("compliance");
  setLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/compliance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: currentProjectId,
        requirements,
        missing_information: missingInformation,
        clarification_questions: clarificationQuestions,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Compliance analysis failed");
    setComplianceAnalysis(data);
    setActiveSection("analysis");
  } catch (error: any) {
    console.error("Compliance analysis failed:", error);
    setErrorMessage(error.message || "Failed to analyze compliance.");
  } finally {
    setLoading(false);
    setActiveOperation(null);
  }
};

const analyzeRisk = async () => {
  if (requirements.length === 0 || loading) return;
  setActiveOperation("risk");
  setLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: currentProjectId,
        requirements,
        missing_information: missingInformation,
        clarification_questions: clarificationQuestions,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Risk analysis failed");
    setRiskAnalysis(data);
    setActiveSection("analysis");
  } catch (error: any) {
    console.error("Risk analysis failed:", error);
    setErrorMessage(error.message || "Failed to analyze risk.");
  } finally {
    setLoading(false);
    setActiveOperation(null);
  }
};

  const askKnowledgeBase = async () => {
    if (!ragQuery.trim() || loading) return;
    setActiveOperation("rag");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery }),
      });
      const data = await res.json();
      setRagAnswer(data.answer || "No answer returned.");
      setRagSources(data.sources || []);
    } catch (error) {
      console.error("RAG request failed:", error);
      setRagAnswer("Failed to query the knowledge base.");
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const updateComplianceApproval = async (
    findingId: number,
    status: "Draft" | "Approved" | "Rejected"
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/compliance/${findingId}/approval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.detail || "Approval update failed");

      setComplianceAnalysis((current) =>
        current
          ? {
              ...current,
              findings: current.findings.map((f) =>
                f.requirement_id === updated.requirement_code
                  ? { ...f, approval_status: updated.approval_status }
                  : f
              ),
            }
          : current
      );
    } catch (error) {
      console.error("Compliance approval update failed:", error);
      setErrorMessage("Failed to update compliance approval.");
    }
  };

  const updateRiskApproval = async (
    findingId: number,
    status: "Draft" | "Approved" | "Rejected"
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/risk/${findingId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.detail || "Approval update failed");

      setRiskAnalysis((current) =>
        current
          ? {
              ...current,
              findings: current.findings.map((f) =>
                f.requirement_id === updated.requirement_code
                  ? { ...f, approval_status: updated.approval_status }
                  : f
              ),
            }
          : current
      );
    } catch (error) {
      console.error("Risk approval update failed:", error);
      setErrorMessage("Failed to update risk approval.");
    }
  };

  const updateSDLCApproval = async (
    recommendationId: number,
    status: "Draft" | "Approved" | "Rejected"
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/sdlc/${recommendationId}/approval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.detail || "Approval update failed");

      setSdlcRecommendation((current) =>
        current ? { ...current, approval_status: updated.approval_status } : current
      );
    } catch (error) {
      console.error("SDLC approval update failed:", error);
      setErrorMessage("Failed to update SDLC approval.");
    }
  };

const generateSRS = async () => {
  if (requirements.length === 0) return;
  setActiveOperation("documentation");
  setDocumentationLoading(true);
  try {
    const query = currentProjectId ? `?project_id=${currentProjectId}` : "";
    const response = await fetch(`${API_BASE_URL}/documentation${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requirements),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to generate documentation");

    setSrsContent(data.srs.content);
    setUserStoriesContent(data.user_stories.content);
    setUseCasesContent(data.use_cases.content);
    setAcceptanceCriteriaContent(data.acceptance_criteria.content);
    setTraceabilityContent(data.traceability.content);
  } catch (error: any) {
    console.error(error);
    setErrorMessage(error.message || "Failed to generate documentation artifacts.");
  } finally {
    setDocumentationLoading(false);
    setActiveOperation(null);
  }
};

const recommendSDLC = async () => {
  setErrorMessage("");
  setSdlcLoading(true);
  try {
    const query = currentProjectId ? `?project_id=${currentProjectId}` : "";
    const res = await fetch(`${API_BASE_URL}/sdlc${query}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to get SDLC recommendation");
    setSdlcRecommendation(data);
    setSdlcWorkflow(null);
    setIsOverridingSDLC(false);
  } catch (error: any) {
    console.error(error);
    setErrorMessage(error.message || "Failed to generate SDLC recommendation.");
  } finally {
    setSdlcLoading(false);
  }
};

const generateSDLCWorkflow = async () => {
  setErrorMessage("");
  setSdlcLoading(true);
  try {
    const query = currentProjectId ? `?project_id=${currentProjectId}` : "";
    const res = await fetch(`${API_BASE_URL}/sdlc/workflow${query}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to generate SDLC workflow");
    setSdlcWorkflow(data);
  } catch (error: any) {
    console.error(error);
    setErrorMessage(error.message || "Failed to generate SDLC workflow.");
  } finally {
    setSdlcLoading(false);
  }
};

  const overrideSDLC = async () => {
    if (!sdlcRecommendation?.id || !overrideModel) return;
    setErrorMessage("");
    setSdlcLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/sdlc/${sdlcRecommendation.id}/override`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommended_model: overrideModel,
            override_reason: overrideReason,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to override SDLC model");
      setSdlcRecommendation(data);
      setSdlcWorkflow(null);
      setIsOverridingSDLC(false);
      setOverrideReason("");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Failed to override SDLC model.");
    } finally {
      setSdlcLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem("finai_token");
      if (savedToken) {
        try {
          const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (meRes.ok) {
            const user = await meRes.json();
            setAuthToken(savedToken);
            setCurrentUser(user);
          } else {
            localStorage.removeItem("finai_token");
          }
        } catch {
          localStorage.removeItem("finai_token");
        }
      }
      setAuthChecked(true);

      try {
        const res = await fetch(`${API_BASE_URL}/project`);
        if (res.ok) hydrateProjectData(await res.json());
      } catch (error) {
        console.error("Failed to load saved project:", error);
      }
      await loadProjects();
    };
    init();
  }, []);

  const handleLogout = async () => {
    if (authToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("finai_token");
    setAuthToken(null);
    setCurrentUser(null);
  };

  if (!authChecked) return null;
  if (!authToken || !currentUser) {
    return (
      <AuthPage
        onAuthenticated={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
        }}
      />
    );
  }

  const approvedRequirements = requirements.filter(
    (r) => r.approval_status === "Approved"
  ).length;
  const rejectedRequirements = requirements.filter(
    (r) => r.approval_status === "Rejected"
  ).length;
  const complianceFindings = complianceAnalysis?.findings.length ?? 0;
  const riskFindings = riskAnalysis?.findings.length ?? 0;
  const complianceRelevant =
    complianceAnalysis?.findings.filter(
      (f) => f.status?.toLowerCase() === "relevant"
    ).length ?? 0;
  const complianceApproved =
    complianceAnalysis?.findings.filter((f) => f.approval_status === "Approved")
      .length ?? 0;
  const highRiskFindings =
    riskAnalysis?.findings.filter((f) => f.severity?.toLowerCase() === "high")
      .length ?? 0;
  const riskApproved =
    riskAnalysis?.findings.filter((f) => f.approval_status === "Approved")
      .length ?? 0;
  const qualityIssues = qualityAnalysis?.issues.length ?? 0;

  const overallApproval =
    requirements.length > 0 && approvedRequirements === requirements.length
      ? "Approved"
      : requirements.length > 0 && rejectedRequirements > 0
        ? "Needs Review"
        : "Draft";

  const getComplianceStatus = (reqId: string) =>
    complianceAnalysis?.findings.find((f) => f.requirement_id === reqId)?.status;

  const getRiskSeverity = (reqId: string) =>
    riskAnalysis?.findings.find((r) => r.requirement_id === reqId)?.severity;

  const statusBadgeClass = (status?: string) => {
    if (status === "Approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "Rejected" || status === "Needs Review")
      return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
  };

const openNewProjectModal = () => {
    setNewProjectNameInput(`Project #${projects.length + 1}`);
    setIsNewProjectModalOpen(true);
  };

  const confirmCreateNewProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName =
      newProjectNameInput.trim() || `Project #${projects.length + 1}`;
    setIsNewProjectModalOpen(false);

    try {
      const response = await fetch(`${API_BASE_URL}/project/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      if (!response.ok) throw new Error("Failed to create new project");
      const newProj = await response.json();

      setProjects((prev) => [newProj, ...prev.filter((p) => p.id !== newProj.id)]);
      setCurrentProjectId(newProj.id);
      setCurrentProjectName(newProj.name);
      setMessages([]);
      setRequirements([]);
      setMissingInformation([]);
      setClarificationQuestions([]);
      setQualityAnalysis(null);
      setComplianceAnalysis(null);
      setRiskAnalysis(null);
      setSrsContent("");
      setUserStoriesContent("");
      setUseCasesContent("");
      setAcceptanceCriteriaContent("");
      setTraceabilityContent("");
      setSdlcRecommendation(null);
      setSdlcWorkflow(null);
      setIsOverridingSDLC(false);
      setOverrideReason("");
      setRagQuery("");
      setRagAnswer("");
      setRagSources([]);
      setErrorMessage("");
      setEditingId(null);
      setEditText("");
      await loadProjects();
    } catch (error) {
      console.error("Failed to create new project:", error);
      setErrorMessage("Failed to create a new project. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={confirmCreateNewProject}
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-zinc-900">
              Create New Project
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Your existing projects remain saved and accessible from the sidebar.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Project Name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g., UPI Merchant Treasury Engine"
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:bg-white"
                value={newProjectNameInput}
                onChange={(e) => setNewProjectNameInput(e.target.value)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}
<Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        projects={projects}
        currentProjectId={currentProjectId}
        currentProjectName={currentProjectName}
        onSelectProject={loadProjectById}
        onNewProject={openNewProjectModal}
        user={currentUser}
        onLogout={handleLogout}
        counts={{
          requirements: requirements.length,
          issues: qualityIssues,
          compliance: complianceFindings,
          risks: riskFindings,
          hasDocs: Boolean(srsContent),
        }}
      />

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-5xl">
          {errorMessage && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage("")}
                className="text-xs font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 1. OVERVIEW */}
          {activeSection === "overview" && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Project Overview
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Current progress across elicitation, regulatory checks, and artifacts
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                    overallApproval
                  )}`}
                >
                  Status: {overallApproval}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => setActiveSection("requirements")}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-xs transition hover:border-zinc-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Requirements
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">
                    {requirements.length}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {approvedRequirements} approved
                  </p>
                </button>

                <button
                  onClick={() => setActiveSection("analysis")}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-xs transition hover:border-zinc-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Quality Issues
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">
                    {qualityIssues}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {qualityAnalysis
                      ? `${qualityAnalysis.completeness_score}% completeness`
                      : "Analysis not run"}
                  </p>
                </button>

                <button
                  onClick={() => setActiveSection("analysis")}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-xs transition hover:border-zinc-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Compliance Findings
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">
                    {complianceFindings}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {complianceAnalysis
                      ? `${complianceRelevant} relevant · ${complianceApproved} approved`
                      : "Analysis not run"}
                  </p>
                </button>

                <button
                  onClick={() => setActiveSection("analysis")}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-xs transition hover:border-zinc-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Risk Findings
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-900">
                    {riskFindings}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {riskAnalysis
                      ? `${highRiskFindings} high severity · ${riskApproved} approved`
                      : "Analysis not run"}
                  </p>
                </button>

                <button
                  onClick={() => setActiveSection("sdlc")}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-xs transition hover:border-zinc-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    SDLC Model
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-900">
                    {sdlcRecommendation?.recommended_model || "Not selected"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {sdlcRecommendation
                      ? `Approval: ${sdlcRecommendation.approval_status || "Draft"}`
                      : "Run SDLC recommendation"}
                  </p>
                </button>

                <button
                  onClick={() => setActiveSection("documentation")}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-xs transition hover:border-zinc-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Documentation
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-900">
                    {srsContent ? "Generated" : "Pending"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {srsContent ? "5 artifacts available" : "Generate SRS & specs"}
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* 2. ELICITATION CHAT */}
          {activeSection === "chat" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  Stakeholder Elicitation
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Describe product goals and regulatory constraints to extract structured requirements
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                  <div className="mb-4 max-h-[520px] flex-1 space-y-4 overflow-y-auto pr-1">
                    {messages.length === 0 ? (
                      <p className="py-12 text-center text-sm text-zinc-400">
                        Start describing your financial application to extract requirements.
                      </p>
                    ) : (
                      messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl px-4 py-3 text-sm leading-6 ${
                            msg.role === "user"
                              ? "ml-8 bg-zinc-900 text-white"
                              : "mr-8 border border-zinc-200 bg-zinc-50 text-zinc-800"
                          }`}
                        >
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-60">
                            {msg.role === "user" ? "Stakeholder" : "FinAI"}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-zinc-100 pt-4">
                    <textarea
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                      rows={3}
                      placeholder="Describe features, user roles, transaction limits, or compliance rules..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">
                        Press Enter to send · Shift+Enter for new line
                      </span>
                      <button
                        onClick={sendMessage}
                        disabled={activeOperation === "chat"}
                        className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {activeOperation === "chat" ? "Extracting..." : "Send"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clarification & Missing Info */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Clarification Questions
                    </h3>
                    {clarificationQuestions.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        No open clarification questions.
                      </p>
                    ) : (
                      <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-zinc-700">
                        {clarificationQuestions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Information Still Needed
                    </h3>
                    {missingInformation.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        No missing gaps flagged.
                      </p>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-5 text-zinc-700">
                        {missingInformation.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. REQUIREMENTS */}
          {activeSection === "requirements" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Extracted Requirements
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Edit statements, approve baseline items, and trigger downstream checks
                  </p>
                </div>

                {requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={analyzeRequirements}
                      disabled={activeOperation === "quality"}
                      className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {activeOperation === "quality" ? "Analyzing..." : "Run Quality"}
                    </button>
                    <button
                      onClick={analyzeCompliance}
                      disabled={activeOperation === "compliance"}
                      className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {activeOperation === "compliance"
                        ? "Checking..."
                        : "Run Compliance"}
                    </button>
                    <button
                      onClick={analyzeRisk}
                      disabled={activeOperation === "risk"}
                      className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {activeOperation === "risk" ? "Analyzing..." : "Run Risk"}
                    </button>
                  </div>
                )}
              </div>

              {requirements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
                  No requirements extracted yet. Use Elicitation Chat to gather requirements.
                </div>
              ) : (
                <div className="space-y-4">
                  {requirements.map((req) => (
                    <div
                      key={req.db_id ?? req.id}
                      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-zinc-900">
                            {req.id}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            {req.category}
                          </span>
                          {req.confidence_score != null && (
                            <span className="text-xs text-zinc-400">
                              {Math.round(req.confidence_score * 100)}% confidence
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {getRiskSeverity(req.id) && (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-700">
                              Risk: {getRiskSeverity(req.id)}
                            </span>
                          )}
                          {getComplianceStatus(req.id) && (
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-700">
                              Compliance: {getComplianceStatus(req.id)}
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
                              req.approval_status
                            )}`}
                          >
                            {req.approval_status}
                          </span>
                        </div>
                      </div>

                      {editingId === req.id ? (
                        <div className="mb-4 space-y-2">
                          <textarea
                            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:bg-white"
                            rows={3}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(req.id)}
                              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mb-4 text-sm leading-6 text-zinc-800">
                          {req.statement}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                        <button
                          onClick={() => startEditing(req)}
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => updateRequirementStatus(req.id, "Approved")}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateRequirementStatus(req.id, "Rejected")}
                          className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. QUALITY, COMPLIANCE & RISK */}
          {activeSection === "analysis" && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Quality, Compliance & Risk
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Automated audits grounded in regulatory evidence and threat analysis
                  </p>
                </div>

                {requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={analyzeRequirements}
                      disabled={activeOperation === "quality"}
                      className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {activeOperation === "quality" ? "Running..." : "Quality Check"}
                    </button>
                    <button
                      onClick={analyzeCompliance}
                      disabled={activeOperation === "compliance"}
                      className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {activeOperation === "compliance"
                        ? "Running..."
                        : "Compliance Check"}
                    </button>
                    <button
                      onClick={analyzeRisk}
                      disabled={activeOperation === "risk"}
                      className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {activeOperation === "risk" ? "Running..." : "Risk Check"}
                    </button>
                  </div>
                )}
              </div>

              {/* Quality */}
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Quality & Conflict Analysis
                </h3>
                {!qualityAnalysis ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    No quality analysis run yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs font-medium text-zinc-700">
                        <span>Completeness Score</span>
                        <span>{qualityAnalysis.completeness_score}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{ width: `${qualityAnalysis.completeness_score}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-zinc-600">{qualityAnalysis.summary}</p>
                    <div className="space-y-3">
                      {qualityAnalysis.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border p-4 ${
                            issue.type.toLowerCase() === "conflict"
                              ? "border-rose-200 bg-rose-50/60"
                              : "border-zinc-200 bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-zinc-900">
                              {issue.type}
                            </span>
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                              {issue.severity}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-700">{issue.description}</p>
                          {issue.affected_requirement && (
                            <p className="mt-1 text-xs text-zinc-500">
                              Affected: {issue.affected_requirement}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-zinc-600">
                            <span className="font-medium text-zinc-800">Suggestion:</span>{" "}
                            {issue.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Compliance */}
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Regulatory Compliance Findings
                </h3>
                {!complianceAnalysis ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    No compliance analysis run yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-zinc-600">{complianceAnalysis.summary}</p>
                    {complianceAnalysis.findings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold text-zinc-900">
                            {finding.requirement_id}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-700">
                              {finding.status}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
                                finding.approval_status
                              )}`}
                            >
                              {finding.approval_status || "Draft"}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-zinc-800">{finding.finding}</p>

                        {finding.evidence?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                              Regulatory Evidence
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-zinc-600">
                              {finding.evidence.map((src, sIdx) => (
                                <li key={sIdx}>{src}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <p className="mt-3 text-xs text-zinc-700">
                          <span className="font-semibold">Recommendation:</span>{" "}
                          {finding.recommendation}
                        </p>

                        <div className="mt-4 flex gap-2 border-t border-zinc-200/70 pt-3">
                          <button
                            onClick={() => {
                              const id = Number(finding.id);
                              if (id) updateComplianceApproval(id, "Approved");
                            }}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const id = Number(finding.id);
                              if (id) updateComplianceApproval(id, "Rejected");
                            }}
                            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Risk */}
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Security & Risk Findings
                </h3>
                {!riskAnalysis ? (
                  <p className="mt-2 text-sm text-zinc-500">No risk analysis run yet.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-zinc-600">{riskAnalysis.summary}</p>
                    {riskAnalysis.findings.map((risk, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-zinc-900">
                              {risk.risk_type}
                            </span>
                            <span className="ml-2 font-mono text-xs text-zinc-500">
                              ({risk.requirement_id})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-700">
                              {risk.severity}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
                                risk.approval_status
                              )}`}
                            >
                              {risk.approval_status || "Draft"}
                            </span>
                          </div>
                        </div>

                        <p className="mt-2 text-sm text-zinc-800">{risk.description}</p>
                        <p className="mt-2 text-xs text-zinc-700">
                          <span className="font-semibold">Mitigation:</span>{" "}
                          {risk.mitigation}
                        </p>

                        <div className="mt-4 flex gap-2 border-t border-zinc-200/70 pt-3">
                          <button
                            onClick={() =>
                              risk.id && updateRiskApproval(risk.id, "Approved")
                            }
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              risk.id && updateRiskApproval(risk.id, "Rejected")
                            }
                            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 5. SDLC & WORKFLOW */}
          {activeSection === "sdlc" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    SDLC Recommendation & Workflow
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Methodology selection and execution plan derived from your requirements and analyses
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={recommendSDLC}
                    disabled={
                      sdlcLoading ||
                      (requirements.length === 0 && messages.length === 0)
                    }
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sdlcLoading
                      ? "Analyzing..."
                      : sdlcRecommendation
                        ? "Re-evaluate SDLC"
                        : "Recommend SDLC"}
                  </button>

                  {sdlcRecommendation && (
                    <button
                      onClick={generateSDLCWorkflow}
                      disabled={sdlcLoading}
                      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Generate Workflow
                    </button>
                  )}
                </div>
              </div>

              {!sdlcRecommendation ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
                  <p className="text-sm font-medium text-zinc-800">
                    No SDLC recommendation generated yet
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {requirements.length > 0 || messages.length > 0
                      ? "Click Recommend SDLC to analyze your requirements, quality, compliance, and risk findings."
                      : "Gather requirements in Elicitation Chat first to generate an SDLC recommendation."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-zinc-900">
                      Recommended Model: {sdlcRecommendation.recommended_model}
                    </h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                        sdlcRecommendation.approval_status
                      )}`}
                    >
                      {sdlcRecommendation.approval_status || "Draft"}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    {sdlcRecommendation.reasoning}
                  </p>

                  {sdlcRecommendation.key_factors?.length > 0 && (
                    <>
                      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Key Decision Factors
                      </h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                        {sdlcRecommendation.key_factors.map((factor, idx) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          sdlcRecommendation.id &&
                          updateSDLCApproval(sdlcRecommendation.id, "Approved")
                        }
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          sdlcRecommendation.id &&
                          updateSDLCApproval(sdlcRecommendation.id, "Rejected")
                        }
                        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                      >
                        Reject
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setOverrideModel(sdlcRecommendation.recommended_model);
                        setIsOverridingSDLC((prev) => !prev);
                      }}
                      className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      {isOverridingSDLC ? "Cancel Override" : "Override Model"}
                    </button>
                  </div>

                  {isOverridingSDLC && (
                    <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-700">
                            Select SDLC Model
                          </label>
                          <select
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            value={overrideModel}
                            onChange={(e) => setOverrideModel(e.target.value)}
                          >
                            {SDLC_MODELS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-700">
                            Override Rationale (optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Strict regulatory audit gates required"
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={overrideSDLC}
                          disabled={sdlcLoading || !overrideModel}
                          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Save Override
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sdlcWorkflow && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                  <h3 className="mb-4 text-lg font-semibold text-zinc-900">
                    {sdlcWorkflow.model} Execution Workflow
                  </h3>
                  <div className="space-y-4">
                    {sdlcWorkflow.workflow.map((item) => (
                      <div
                        key={item.step}
                        className="border-l-2 border-zinc-900 pl-4"
                      >
                        <h4 className="text-sm font-semibold text-zinc-900">
                          {item.step}. {item.phase}
                        </h4>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. DOCUMENTATION (TABBED) */}
          {activeSection === "documentation" && (
            <DocumentationTabs
              srsContent={srsContent}
              userStoriesContent={userStoriesContent}
              useCasesContent={useCasesContent}
              acceptanceCriteriaContent={acceptanceCriteriaContent}
              traceabilityContent={traceabilityContent}
              hasRequirements={requirements.length > 0}
              isGenerating={
                documentationLoading || activeOperation === "documentation"
              }
              onGenerate={generateSRS}
            />
          )}

          {/* 7. KNOWLEDGE BASE (RAG) */}
          {activeSection === "knowledge" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  Financial Regulatory Knowledge Base
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Query indexed RBI directions, customer protection policies, and security controls
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                <textarea
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                  rows={3}
                  placeholder="Ask about fraud risk reporting timelines, zero-liability rules, or authentication controls..."
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={askKnowledgeBase}
                    disabled={loading}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {loading && activeOperation === "rag"
                      ? "Searching..."
                      : "Search Knowledge Base"}
                  </button>
                </div>

                {ragAnswer && (
                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <h3 className="text-sm font-semibold text-zinc-900">Answer</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                      {ragAnswer}
                    </p>

                    {ragSources.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          Evidence Sources
                        </h4>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {ragSources.map((source, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs"
                            >
                              <div className="font-medium text-zinc-900">
                                {source.source}
                              </div>
                              <div className="mt-0.5 text-zinc-500">
                                Chunk #{source.chunk_id}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
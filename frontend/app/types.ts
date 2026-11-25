export type Requirement = {
  id: string;
  db_id?: number;
  statement: string;
  category: string;
  source_stakeholder?: string | null;
  business_justification?: string | null;
  priority?: string | null;
  dependencies: string[];
  assumptions: string[];
  acceptance_criteria: string[];
  applicable_regulations: string[];
  risk_level?: string | null;
  confidence_score?: number | null;
  approval_status: string;
};

export type QualityIssue = {
  type: string;
  severity: string;
  description: string;
  affected_requirement?: string | null;
  suggestion: string;
};

export type QualityAnalysis = {
  completeness_score: number;
  issues: QualityIssue[];
  summary: string;
};

export type ComplianceFinding = {
  id?: number;
  requirement_id: string;
  status: string;
  finding: string;
  evidence: string[];
  recommendation: string;
  approval_status?: string;
};

export type ComplianceAnalysis = {
  findings: ComplianceFinding[];
  summary: string;
};

export type RiskFinding = {
  id?: number;
  requirement_id: string;
  risk_type: string;
  severity: string;
  description: string;
  mitigation: string;
  approval_status?: string;
};

export type RiskAnalysis = {
  findings: RiskFinding[];
  summary: string;
};

export type SDLCRecommendation = {
  id?: number;
  recommended_model: string;
  reasoning: string;
  key_factors: string[];
  approval_status?: string;
};

export type SDLCWorkflowStep = {
  step: number;
  phase: string;
  description: string;
};

export type SDLCWorkflow = {
  model: string;
  workflow: SDLCWorkflowStep[];
};

export type Message = {
  role: "user" | "model";
  content: string;
};

export type ProjectSummary = {
  id: number;
  name: string;
};

export type NavSection =
  | "overview"
  | "chat"
  | "requirements"
  | "analysis"
  | "sdlc"
  | "documentation"
  | "knowledge";
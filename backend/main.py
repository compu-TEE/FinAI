import os
import time
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai.errors import APIError, ServerError
from pydantic import BaseModel
from rag import rag_answer, retrieve_documents
from sqlalchemy.orm import Session
from models import (
    Project,
    Requirement as DBRequirement,
    QualityAnalysis as DBQualityAnalysis,
    ComplianceFinding as DBComplianceFinding,
    RiskFinding as DBRiskFinding,
    SDLCRecommendation as DBSDLCRecommendation,
    DocumentationArtifact as DBDocumentationArtifact,
    AuditLog,
    ConversationMessage,
)
from database import SessionLocal

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
import random

MODEL_POOL = [
    os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]
# Deduplicate while preserving order
MODEL_POOL = list(dict.fromkeys(MODEL_POOL))


def generate_structured(contents: str, schema):
    last_error = None
    for model_name in MODEL_POOL:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config={
                        "response_mime_type": "application/json",
                        "response_schema": schema,
                    },
                )
                return response.parsed
            except (ServerError, APIError) as exc:
                last_error = exc
                code = getattr(exc, "code", None)
                if code in (429, 500, 502, 503, 504):
                    time.sleep(1.0 * (attempt + 1) + random.uniform(0.1, 0.6))
                    continue
                if code == 404:
                    break
                raise HTTPException(
                    status_code=503,
                    detail=f"Gemini API error ({code}) on {model_name}: {getattr(exc, 'message', str(exc))}",
                ) from exc
    raise HTTPException(
        status_code=503,
        detail=f"All Gemini models temporarily unavailable. Last error: {last_error}",
    )

@app.get("/")
def root():
    return {"message": "Backend connected successfully!", "model": os.getenv("GEMINI_MODEL") or MODEL_POOL}


class Requirement(BaseModel):
    id: str
    statement: str
    category: str
    source_stakeholder: str | None = None
    business_justification: str | None = None
    priority: str | None = None
    dependencies: list[str] = []
    assumptions: list[str] = []
    acceptance_criteria: list[str] = []
    applicable_regulations: list[str] = []
    risk_level: str | None = None
    confidence_score: float | None = None
    approval_status: str = "pending"


class RequirementState(BaseModel):
    requirements: list[Requirement] = []
    missing_information: list[str] = []
    clarification_questions: list[str] = []


class RequirementAnalysis(BaseModel):
    response: str
    requirements: list[Requirement] = []
    missing_information: list[str] = []
    clarification_questions: list[str] = []


class QualityIssue(BaseModel):
    type: str
    severity: str
    description: str
    affected_requirement: str | None = None
    suggestion: str


class QualityAnalysis(BaseModel):
    completeness_score: float
    issues: list[QualityIssue] = []
    summary: str


class ComplianceFinding(BaseModel):
    id: int | None = None
    requirement_id: str
    status: str
    finding: str
    evidence: list[str] = []
    recommendation: str
    approval_status: str = "Draft"


class SingleComplianceAnalysis(BaseModel):
    status: str
    finding: str
    evidence: list[str] = []
    recommendation: str


class ComplianceAnalysis(BaseModel):
    findings: list[ComplianceFinding] = []
    summary: str


class RiskFinding(BaseModel):
    id: int | None = None
    requirement_id: str
    risk_type: str
    severity: str
    description: str
    mitigation: str
    approval_status: str = "Draft"


class SingleRiskAnalysis(BaseModel):
    risk_type: str
    severity: str
    description: str
    mitigation: str


class RiskAnalysis(BaseModel):
    findings: list[RiskFinding] = []
    summary: str


ALLOWED_SDLC_MODELS = [
    "Waterfall",
    "V-Model",
    "Prototyping",
    "Iterative/Incremental",
    "RAD",
    "Spiral",
    "Agile",
]


class SDLCAutoOutput(BaseModel):
    recommended_model: str
    reasoning: str
    key_factors: list[str] = []


class SDLCRecommendation(BaseModel):
    id: int | None = None
    recommended_model: str
    reasoning: str
    key_factors: list[str] = []
    approval_status: str = "Draft"


class SDLCOverrideRequest(BaseModel):
    recommended_model: str
    override_reason: str | None = ""


class SDLCWorkflowStep(BaseModel):
    step: int
    phase: str
    description: str


class SDLCWorkflow(BaseModel):
    model: str
    workflow: list[SDLCWorkflowStep]


class DocumentationArtifact(BaseModel):
    title: str
    content: str


class DocumentationPackage(BaseModel):
    srs: DocumentationArtifact
    user_stories: DocumentationArtifact
    use_cases: DocumentationArtifact
    acceptance_criteria: DocumentationArtifact
    traceability: DocumentationArtifact


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    project_id: int | None = None
    messages: list[ChatMessage]
    requirement_state: RequirementState | None = None


class RequirementState(BaseModel):
    project_id: int | None = None
    requirements: list[Requirement] = []
    missing_information: list[str] = []
    clarification_questions: list[str] = []


class RAGRequest(BaseModel):
    query: str


class ApprovalUpdate(BaseModel):
    status: Literal["Draft", "Approved", "Rejected"]

class ProjectCreate(BaseModel):
    name: str | None = None


class ProjectRename(BaseModel):
    name: str


def _resolve_project(db, project_id: int | None = None, create_if_missing: bool = False) -> Project:
    if project_id is not None:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        return project

    project = db.query(Project).order_by(Project.id.desc()).first()
    if not project and create_if_missing:
        project = Project(
            name="Project #1",
            description="Financial software requirements workspace",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
    elif not project:
        raise HTTPException(status_code=404, detail="No active project found.")
    return project


SYSTEM_PROMPT = """
You are a Requirements Engineering AI assistant for financial software projects.
Gather complete, clear, consistent, and testable software requirements from stakeholders.
When writing a formal requirement, use testable language such as "The system shall ...".
Do not invent business rules, technical constraints, regulations, or stakeholder decisions.
"""

QUALITY_PROMPT = """
You are a Software Requirements Quality Analysis Agent for financial software.
Analyze the provided requirements for completeness, ambiguity, consistency (conflicts),
testability, security, financial constraints, and traceability.
Return a completeness score between 0 and 100 and actionable issues.
For conflicts, set type to "conflict" and identify affected requirement IDs.
"""

COMPLIANCE_PROMPT = """
You are a Financial Software Compliance Analysis Agent.
Analyze the provided software requirement using ONLY the provided knowledge-base evidence.
Possible statuses: relevant, no_relevant_evidence, insufficient_evidence.
Do not invent regulations or policies.
"""

RISK_PROMPT = """
You are a Security and Risk Analysis Agent for financial software.
Analyze the provided software requirement and identify realistic security, privacy,
financial, operational, or availability risks supported by the requirement and evidence.
Severity must be low, medium, or high.
"""

AUTO_SDLC_PROMPT = """
You are an expert Software Development Life Cycle (SDLC) methodology advisor for financial software projects.

Analyze the stakeholder conversation, extracted requirements, quality analysis, compliance findings, and risk findings to recommend exactly ONE SDLC model from these 7 options:
1. Waterfall
2. V-Model
3. Prototyping
4. Iterative/Incremental
5. RAD
6. Spiral
7. Agile

Evaluate regulatory criticality, requirement stability/clarity, change frequency, technical complexity, and security/compliance risks directly from the project artifacts provided below.

Return a clear, grounded explanation ("reasoning") referencing the actual requirements, risks, and compliance findings, plus 3 to 5 concise "key_factors".
"""

SDLC_WORKFLOW_PROMPT = """
You are an SDLC workflow generation agent for financial software projects.
Generate a project-specific development workflow based on the selected SDLC model and project characteristics.
Return ONLY valid JSON matching the requested schema.
"""

DOCUMENTATION_PROMPT = """
You are a software documentation agent for financial software projects.
Generate 5 artifacts from the provided requirements:

1. srs: Format strictly according to the IEEE 830 / ISO/IEC/IEEE 29148 Software Requirements Specification standard using clear Markdown headings:
   - 1. Introduction
     - 1.1 Purpose
     - 1.2 Scope
     - 1.3 Definitions, Acronyms, and Abbreviations
     - 1.4 References
     - 1.5 Overview
   - 2. Overall Description
     - 2.1 Product Perspective
     - 2.2 Product Functions
     - 2.3 User Characteristics
     - 2.4 Constraints
     - 2.5 Assumptions and Dependencies
   - 3. Specific Requirements
     - 3.1 External Interface Requirements (User, Hardware, Software, Communications)
     - 3.2 Functional Requirements (organized by requirement ID, description, inputs, processing, outputs)
     - 3.3 Non-Functional Requirements (Performance, Security, Reliability, Availability, Regulatory Compliance)
     - 3.4 Logical Database / Data Requirements
   - 4. Appendices / Supporting Information

2. user_stories ("As a <user>, I want <goal>, so that <benefit>.")
3. use_cases (Actors, preconditions, main flow, alternate flows, postconditions)
4. acceptance_criteria (Testable Given/When/Then or checklist acceptance criteria mapped to requirement IDs)
5. traceability (Traceability matrix mapping each Requirement ID to User Stories, Use Cases, and Acceptance Criteria)

Only use information contained in the provided requirements. Do not invent unstated features.
"""


def analysis_agent(requirements: list[Requirement]) -> QualityAnalysis:
    requirements = [req for req in requirements if req.approval_status != "Rejected"]
    if not requirements:
        return QualityAnalysis(
            completeness_score=0,
            issues=[
                QualityIssue(
                    type="completeness",
                    severity="high",
                    description="No requirements have been captured yet.",
                    affected_requirement=None,
                    suggestion="Gather and document at least one requirement.",
                )
            ],
            summary="There are currently no requirements to analyze.",
        )

    requirements_text = "\n\n".join(
        f"ID: {req.id}\nStatement: {req.statement}\nCategory: {req.category}\nPriority: {req.priority}\nRisk: {req.risk_level}\nAcceptance Criteria: {req.acceptance_criteria}"
        for req in requirements
    )
    return generate_structured(
        QUALITY_PROMPT + "\n\nREQUIREMENTS:\n" + requirements_text,
        QualityAnalysis,
    )


def compliance_agent(requirements: list[Requirement]) -> ComplianceAnalysis:
    requirements = [req for req in requirements if req.approval_status != "Rejected"]
    if not requirements:
        return ComplianceAnalysis(
            findings=[],
            summary="No requirements were provided for compliance analysis.",
        )

    all_findings = []
    for requirement in requirements:
        retrieved = retrieve_documents(requirement.statement)
        context = "\n\n".join(
            f"SOURCE: {item['source']}\nCHUNK: {item['chunk_id']}\nCONTENT:\n{item['content']}"
            for item in retrieved
        )
        prompt = (
            COMPLIANCE_PROMPT
            + f"\n\nREQUIREMENT:\nID: {requirement.id}\nStatement: {requirement.statement}"
            + "\n\nKNOWLEDGE BASE EVIDENCE:\n"
            + context
        )
        result = generate_structured(prompt, SingleComplianceAnalysis)
        all_findings.append(
            ComplianceFinding(
                requirement_id=requirement.id,
                status=result.status,
                finding=result.finding,
                evidence=result.evidence,
                recommendation=result.recommendation,
            )
        )

    return ComplianceAnalysis(
        findings=all_findings,
        summary="Compliance analysis was performed using the available knowledge-base evidence.",
    )


def risk_agent(requirements: list[Requirement]) -> RiskAnalysis:
    requirements = [req for req in requirements if req.approval_status != "Rejected"]
    if not requirements:
        return RiskAnalysis(
            findings=[],
            summary="No requirements were provided for risk analysis.",
        )

    all_findings = []
    for requirement in requirements:
        retrieved = retrieve_documents(requirement.statement)
        context = "\n\n".join(
            f"SOURCE: {item['source']}\nCHUNK: {item['chunk_id']}\nCONTENT:\n{item['content']}"
            for item in retrieved
        )
        prompt = (
            RISK_PROMPT
            + f"\n\nREQUIREMENT:\nID: {requirement.id}\nStatement: {requirement.statement}"
            + "\n\nKNOWLEDGE BASE EVIDENCE:\n"
            + context
        )
        result = generate_structured(prompt, SingleRiskAnalysis)
        all_findings.append(
            RiskFinding(
                requirement_id=requirement.id,
                risk_type=result.risk_type,
                severity=result.severity,
                description=result.description,
                mitigation=result.mitigation,
            )
        )

    return RiskAnalysis(
        findings=all_findings,
        summary="Risk analysis was performed using the available requirements and knowledge-base evidence.",
    )

def _build_project_context(db, project_id: int) -> str:
    requirements = (
        db.query(DBRequirement)
        .filter(
            DBRequirement.project_id == project_id,
            DBRequirement.approval_status != "Rejected",
        )
        .all()
    )
    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.project_id == project_id)
        .order_by(ConversationMessage.created_at.asc())
        .all()
    )
    latest_quality = (
        db.query(DBQualityAnalysis)
        .filter(DBQualityAnalysis.project_id == project_id)
        .order_by(DBQualityAnalysis.id.desc())
        .first()
    )
    compliance_findings = (
        db.query(DBComplianceFinding)
        .filter(
            DBComplianceFinding.project_id == project_id,
            DBComplianceFinding.approval_status != "Rejected",
        )
        .all()
    )
    risk_findings = (
        db.query(DBRiskFinding)
        .filter(
            DBRiskFinding.project_id == project_id,
            DBRiskFinding.approval_status != "Rejected",
        )
        .all()
    )

    if not requirements and not messages:
        raise HTTPException(
            status_code=400,
            detail="Add stakeholder messages or requirements before generating an SDLC recommendation.",
        )

    conv_text = "\n".join(f"{m.role.upper()}: {m.content}" for m in messages) or "None"
    req_text = "\n".join(
        f"- [{r.requirement_code}] ({r.category}, priority={r.priority}, risk={r.risk_level}): {r.statement}"
        for r in requirements
    ) or "None"
    quality_text = (
        f"Completeness: {latest_quality.completeness_score}% | Summary: {latest_quality.summary} | Issues: {len(latest_quality.issues or [])}"
        if latest_quality
        else "Not run yet"
    )
    compliance_text = "\n".join(
        f"- [{c.requirement_code}] ({c.status}): {c.finding}" for c in compliance_findings
    ) or "Not run yet"
    risk_text = "\n".join(
        f"- [{r.requirement_code}] ({r.severity} - {r.risk_type}): {r.description}"
        for r in risk_findings
    ) or "Not run yet"

    return (
        f"STAKEHOLDER CONVERSATION:\n{conv_text}\n\n"
        f"EXTRACTED REQUIREMENTS:\n{req_text}\n\n"
        f"QUALITY ANALYSIS:\n{quality_text}\n\n"
        f"COMPLIANCE FINDINGS:\n{compliance_text}\n\n"
        f"RISK FINDINGS:\n{risk_text}"
    )

def sdlc_agent(project_context: str) -> SDLCAutoOutput:
    return generate_structured(
        AUTO_SDLC_PROMPT + "\n\n" + project_context,
        SDLCAutoOutput,
    )


def sdlc_workflow_agent(
    project_context: str,
    recommendation: SDLCRecommendation,
) -> SDLCWorkflow:
    prompt = (
        SDLC_WORKFLOW_PROMPT
        + f"\n\nSelected SDLC Model: {recommendation.recommended_model}"
        + f"\nReasoning: {recommendation.reasoning}"
        + f"\n\nPROJECT ARTIFACTS:\n{project_context}"
    )
    return generate_structured(prompt, SDLCWorkflow)


def documentation_agent(requirements: list[Requirement]) -> DocumentationPackage:
    active_reqs = [r for r in requirements if r.approval_status != "Rejected"]
    if not active_reqs:
        raise HTTPException(
            status_code=400,
            detail="At least one non-rejected requirement is needed to generate documentation.",
        )
    prompt = (
        DOCUMENTATION_PROMPT
        + "\n\nValidated Requirements:\n"
        + "\n".join(req.model_dump_json(indent=2) for req in active_reqs)
    )
    return generate_structured(prompt, DocumentationPackage)


@app.post("/chat")
def chat(request: ChatRequest):
    conversation = "\n\n".join(
        f"{m.role.upper()}: {m.content}" for m in request.messages
    )
    structured_prompt = (
        SYSTEM_PROMPT
        + '\n\nAnalyze the stakeholder conversation and return structured JSON with "response", "requirements", "missing_information", and "clarification_questions".\n\n'
        + conversation
    )
    parsed = generate_structured(structured_prompt, RequirementAnalysis)
    result = parsed.model_dump()

    db = SessionLocal()
    try:
        project = _resolve_project(db, request.project_id, create_if_missing=True)
        if not project:
            project = Project(
                name="Financial Requirements AI Project",
                description="Automatically extracted financial software requirements",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        db.query(ConversationMessage).filter(
            ConversationMessage.project_id == project.id
        ).delete()

        for msg in request.messages:
            db.add(
                ConversationMessage(
                    project_id=project.id,
                    role=msg.role,
                    content=msg.content,
                )
            )

        db.add(
            ConversationMessage(
                project_id=project.id,
                role="model",
                content=result["response"],
            )
        )

        for req in result.get("requirements", []):
            requirement = DBRequirement(
                project_id=project.id,
                requirement_code=req.get("id"),
                statement=req.get("statement"),
                category=req.get("category"),
                source_stakeholder=req.get("source_stakeholder"),
                business_justification=req.get("business_justification"),
                priority=req.get("priority"),
                dependencies=req.get("dependencies", []),
                assumptions=req.get("assumptions", []),
                acceptance_criteria=req.get("acceptance_criteria", []),
                applicable_regulations=req.get("applicable_regulations", []),
                risk_level=req.get("risk_level"),
                confidence_score=req.get("confidence_score"),
                approval_status=req.get("approval_status", "pending"),
            )
            db.add(requirement)
            db.flush()
            req["db_id"] = requirement.id

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return result


@app.post("/analyze")
def analyze_requirements(request: RequirementState):
    analysis = analysis_agent(request.requirements)
    db = SessionLocal()
    try:
        project = _resolve_project(db, request.project_id, create_if_missing=True)
        if not project:
            project = Project(
                name="Financial Requirements AI Project",
                description="Automatically extracted financial software requirements",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        db.add(
            DBQualityAnalysis(
                project_id=project.id,
                completeness_score=analysis.completeness_score,
                summary=analysis.summary,
                issues=[issue.model_dump() for issue in analysis.issues],
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return analysis.model_dump()


@app.post("/rag")
def rag(request: RAGRequest):
    result = rag_answer(request.query)
    return {
        "query": request.query,
        "answer": result["answer"],
        "sources": result["sources"],
    }


@app.post("/compliance")
def analyze_compliance(request: RequirementState):
    analysis = compliance_agent(request.requirements)
    db = SessionLocal()
    try:
        project = _resolve_project(db, request.project_id, create_if_missing=True)
        if not project:
            project = Project(
                name="Financial Requirements AI Project",
                description="Automatically extracted financial software requirements",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        for finding in analysis.findings:
            record = DBComplianceFinding(
                project_id=project.id,
                requirement_code=finding.requirement_id,
                status=finding.status,
                finding=finding.finding,
                evidence=finding.evidence,
                recommendation=finding.recommendation,
            )
            db.add(record)
            db.flush()
            finding.id = record.id
            finding.approval_status = record.approval_status

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return analysis.model_dump()


@app.post("/risk")
def analyze_risk(request: RequirementState):
    analysis = risk_agent(request.requirements)
    db = SessionLocal()
    try:
        project = _resolve_project(db, request.project_id, create_if_missing=True)
        if not project:
            project = Project(
                name="Financial Requirements AI Project",
                description="Automatically extracted financial software requirements",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        for finding in analysis.findings:
            record = DBRiskFinding(
                project_id=project.id,
                requirement_code=finding.requirement_id,
                risk_type=finding.risk_type,
                severity=finding.severity,
                description=finding.description,
                mitigation=finding.mitigation,
            )
            db.add(record)
            db.flush()
            finding.id = record.id
            finding.approval_status = record.approval_status

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return analysis.model_dump()


@app.patch("/risk/{finding_id}/approval")
def update_risk_approval(finding_id: int, approval: ApprovalUpdate):
    db = SessionLocal()
    try:
        finding = db.query(DBRiskFinding).filter(DBRiskFinding.id == finding_id).first()
        if not finding:
            raise HTTPException(status_code=404, detail="Risk finding not found")
        old_status = finding.approval_status
        finding.approval_status = approval.status
        db.add(
            AuditLog(
                entity_type="Risk",
                entity_id=finding.id,
                action="Approval Status Changed",
                old_status=old_status,
                new_status=approval.status,
            )
        )
        db.commit()
        db.refresh(finding)
        return {
            "message": "Risk approval status updated",
            "finding_id": finding.id,
            "requirement_code": finding.requirement_code,
            "approval_status": finding.approval_status,
        }
    finally:
        db.close()


@app.post("/sdlc", response_model=SDLCRecommendation)
def recommend_sdlc():
    project_id: int | None = None
    db = SessionLocal()
    try:
        project = _resolve_project(db, project_id, create_if_missing=(project_id is None))
        if not project:
            raise HTTPException(status_code=404, detail="No active project found.")

        context = _build_project_context(db, project.id)
        auto_result = sdlc_agent(context)

        sdlc_record = DBSDLCRecommendation(
            project_id=project.id,
            regulatory_criticality="auto",
            change_frequency="auto",
            risk_level="auto",
            complexity="auto",
            delivery_priority="auto",
            requirements_clarity="auto",
            recommended_model=auto_result.recommended_model,
            reasoning=auto_result.reasoning,
            key_factors=auto_result.key_factors,
        )
        db.add(sdlc_record)
        db.flush()

        response = SDLCRecommendation(
            id=sdlc_record.id,
            recommended_model=sdlc_record.recommended_model,
            reasoning=sdlc_record.reasoning,
            key_factors=sdlc_record.key_factors,
            approval_status=sdlc_record.approval_status or "Draft",
        )
        db.commit()
        return response
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@app.post("/sdlc/workflow", response_model=SDLCWorkflow)
def generate_sdlc_workflow():
    project_id: int | None = None
    db = SessionLocal()
    try:
        project = _resolve_project(db, project_id, create_if_missing=(project_id is None))
        if not project:
            raise HTTPException(status_code=404, detail="No active project found.")

        latest_sdlc = (
            db.query(DBSDLCRecommendation)
            .filter(DBSDLCRecommendation.project_id == project.id)
            .order_by(DBSDLCRecommendation.id.desc())
            .first()
        )
        if not latest_sdlc:
            raise HTTPException(
                status_code=400,
                detail="Generate an SDLC recommendation before generating a workflow.",
            )

        context = _build_project_context(db, project.id)
        rec = SDLCRecommendation(
            id=latest_sdlc.id,
            recommended_model=latest_sdlc.recommended_model,
            reasoning=latest_sdlc.reasoning,
            key_factors=latest_sdlc.key_factors or [],
            approval_status=latest_sdlc.approval_status or "Draft",
        )
        return sdlc_workflow_agent(context, rec)
    finally:
        db.close()


@app.post("/documentation", response_model=DocumentationPackage)
def generate_documentation(requirements: list[Requirement]):
    requirements: list[Requirement]
    project_id: int | None = None
    documentation = documentation_agent(requirements)
    db = SessionLocal()
    try:
        project = _resolve_project(db, project_id, create_if_missing=(project_id is None))
        if not project:
            project = Project(
                name="Financial Requirements AI Project",
                description="Automatically extracted financial software requirements",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        artifacts = [
            documentation.srs,
            documentation.user_stories,
            documentation.use_cases,
            documentation.acceptance_criteria,
            documentation.traceability,
        ]
        artifact_types = [
            "SRS",
            "User Stories",
            "Use Cases",
            "Acceptance Criteria",
            "Traceability",
        ]
        for artifact_type, artifact in zip(artifact_types, artifacts):
            db.add(
                DBDocumentationArtifact(
                    project_id=project.id,
                    artifact_type=artifact_type,
                    title=artifact.title,
                    content=artifact.content,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return documentation

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ProjectCreate(BaseModel):
    name: str | None = None

@app.post("/project/new")
def create_new_project(
    payload: ProjectCreate | None = None,
    db: Session = Depends(get_db),
):
    custom_name = (payload.name or "").strip() if payload else ""
    if not custom_name:
        count = db.query(Project).count() + 1
        custom_name = f"Project #{count}"

    new_project = Project(name=custom_name)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return {
        "id": new_project.id,
        "name": new_project.name,
        "created_at": new_project.created_at,
    }


def _serialize_project(db, project: Project):
    requirements = (
        db.query(DBRequirement).filter(DBRequirement.project_id == project.id).all()
    )
    quality_analysis = (
        db.query(DBQualityAnalysis)
        .filter(DBQualityAnalysis.project_id == project.id)
        .all()
    )
    compliance_findings = (
        db.query(DBComplianceFinding)
        .filter(DBComplianceFinding.project_id == project.id)
        .all()
    )
    risk_findings = (
        db.query(DBRiskFinding).filter(DBRiskFinding.project_id == project.id).all()
    )
    sdlc_recommendations = (
        db.query(DBSDLCRecommendation)
        .filter(DBSDLCRecommendation.project_id == project.id)
        .all()
    )
    documentation_artifacts = (
        db.query(DBDocumentationArtifact)
        .filter(DBDocumentationArtifact.project_id == project.id)
        .all()
    )
    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.project_id == project.id)
        .order_by(ConversationMessage.created_at.asc())
        .all()
    )

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
        },
        "requirements": [
            {
                "id": req.id,
                "requirement_code": req.requirement_code,
                "statement": req.statement,
                "category": req.category,
                "source_stakeholder": req.source_stakeholder,
                "business_justification": req.business_justification,
                "priority": req.priority,
                "dependencies": req.dependencies,
                "assumptions": req.assumptions,
                "acceptance_criteria": req.acceptance_criteria,
                "applicable_regulations": req.applicable_regulations,
                "risk_level": req.risk_level,
                "confidence_score": req.confidence_score,
                "approval_status": req.approval_status,
            }
            for req in requirements
        ],
        "quality_analysis": [
            {
                "id": qa.id,
                "completeness_score": qa.completeness_score,
                "summary": qa.summary,
                "issues": qa.issues,
            }
            for qa in quality_analysis
        ],
        "compliance_findings": [
            {
                "id": f.id,
                "requirement_code": f.requirement_code,
                "status": f.status,
                "finding": f.finding,
                "evidence": f.evidence,
                "recommendation": f.recommendation,
                "approval_status": f.approval_status,
            }
            for f in compliance_findings
        ],
        "risk_findings": [
            {
                "id": f.id,
                "requirement_code": f.requirement_code,
                "risk_type": f.risk_type,
                "severity": f.severity,
                "description": f.description,
                "mitigation": f.mitigation,
                "approval_status": f.approval_status,
            }
            for f in risk_findings
        ],
        "sdlc_recommendations": [
            {
                "id": r.id,
                "regulatory_criticality": r.regulatory_criticality,
                "change_frequency": r.change_frequency,
                "risk_level": r.risk_level,
                "complexity": r.complexity,
                "delivery_priority": r.delivery_priority,
                "requirements_clarity": r.requirements_clarity,
                "recommended_model": r.recommended_model,
                "reasoning": r.reasoning,
                "key_factors": r.key_factors,
                "approval_status": r.approval_status,
            }
            for r in sdlc_recommendations
        ],
        "documentation_artifacts": [
            {
                "id": a.id,
                "artifact_type": a.artifact_type,
                "title": a.title,
                "content": a.content,
            }
            for a in documentation_artifacts
        ],
        "messages": [{"role": m.role, "content": m.content} for m in messages],
    }


@app.get("/project")
def get_project():
    db = SessionLocal()
    try:
        project = db.query(Project).order_by(Project.id.desc()).first()
        if not project:
            return {"message": "No project found"}
        return _serialize_project(db, project)
    finally:
        db.close()

@app.post("/project/new")
def create_new_project(
    payload: ProjectCreate | None = None,
    db: Session = Depends(get_db),
):
    custom_name = (payload.name or "").strip() if payload else ""
    if not custom_name:
        count = db.query(Project).count() + 1
        custom_name = f"Project #{count}"

    new_project = Project(name=custom_name)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return {
        "id": new_project.id,
        "name": new_project.name,
        "created_at": new_project.created_at,
    }


@app.patch("/projects/{project_id}")
def rename_project(project_id: int, payload: ProjectRename):
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Project name cannot be empty")
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project.name = clean_name
        db.commit()
        db.refresh(project)
        return {"id": project.id, "name": project.name, "description": project.description}
    finally:
        db.close()


@app.patch("/requirements/{requirement_id}/approval")
def update_requirement_approval(requirement_id: int, approval: ApprovalUpdate):
    db = SessionLocal()
    try:
        requirement = (
            db.query(DBRequirement).filter(DBRequirement.id == requirement_id).first()
        )
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        old_status = requirement.approval_status
        requirement.approval_status = approval.status
        db.add(
            AuditLog(
                entity_type="Requirement",
                entity_id=requirement.id,
                action="Approval Status Changed",
                old_status=old_status,
                new_status=approval.status,
            )
        )
        db.commit()
        db.refresh(requirement)
        return {
            "message": "Requirement approval status updated",
            "requirement_id": requirement.id,
            "requirement_code": requirement.requirement_code,
            "approval_status": requirement.approval_status,
        }
    finally:
        db.close()


@app.patch("/compliance/{finding_id}/approval")
def update_compliance_approval(finding_id: int, approval: ApprovalUpdate):
    db = SessionLocal()
    try:
        finding = (
            db.query(DBComplianceFinding)
            .filter(DBComplianceFinding.id == finding_id)
            .first()
        )
        if not finding:
            raise HTTPException(status_code=404, detail="Compliance finding not found")
        old_status = finding.approval_status
        finding.approval_status = approval.status
        db.add(
            AuditLog(
                entity_type="Compliance",
                entity_id=finding.id,
                action="Approval Status Changed",
                old_status=old_status,
                new_status=approval.status,
            )
        )
        db.commit()
        db.refresh(finding)
        return {
            "message": "Compliance approval status updated",
            "finding_id": finding.id,
            "requirement_code": finding.requirement_code,
            "approval_status": finding.approval_status,
        }
    finally:
        db.close()


@app.patch("/sdlc/{recommendation_id}/approval")
def update_sdlc_approval(recommendation_id: int, approval: ApprovalUpdate):
    db = SessionLocal()
    try:
        recommendation = (
            db.query(DBSDLCRecommendation)
            .filter(DBSDLCRecommendation.id == recommendation_id)
            .first()
        )
        if not recommendation:
            raise HTTPException(status_code=404, detail="SDLC recommendation not found")
        old_status = recommendation.approval_status
        recommendation.approval_status = approval.status
        db.add(
            AuditLog(
                entity_type="SDLC",
                entity_id=recommendation.id,
                action="Approval Status Changed",
                old_status=old_status,
                new_status=approval.status,
            )
        )
        db.commit()
        db.refresh(recommendation)
        return {
            "message": "SDLC approval status updated",
            "recommendation_id": recommendation.id,
            "recommended_model": recommendation.recommended_model,
            "approval_status": recommendation.approval_status,
        }
    finally:
        db.close()

@app.patch("/sdlc/{recommendation_id}/override")
def override_sdlc_recommendation(recommendation_id: int, payload: SDLCOverrideRequest):
    from models import SDLCRecommendation as SDLCRecommendationORM

    db = SessionLocal()
    try:
        rec = (
            db.query(SDLCRecommendationORM)
            .filter(SDLCRecommendationORM.id == recommendation_id)
            .first()
        )
        if not rec:
            raise HTTPException(status_code=404, detail="SDLC recommendation not found")

        rec.recommended_model = payload.recommended_model.strip()
        if payload.override_reason and payload.override_reason.strip():
            rec.reasoning = (
                f"[Human Override] {payload.override_reason.strip()}\n\n"
                f"Previous AI Analysis: {rec.reasoning}"
            )
        rec.approval_status = "Approved"
        db.commit()
        db.refresh(rec)

        return {
            "id": rec.id,
            "recommended_model": rec.recommended_model,
            "reasoning": rec.reasoning,
            "key_factors": rec.key_factors or [],
            "approval_status": rec.approval_status,
        }
    finally:
        db.close()


@app.get("/projects")
def get_projects():
    db = SessionLocal()
    try:
        projects = db.query(Project).order_by(Project.id.desc()).all()
        return [
            {"id": p.id, "name": p.name, "description": p.description}
            for p in projects
        ]
    finally:
        db.close()


@app.get("/projects/{project_id}")
def get_project_by_id(project_id: int):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return _serialize_project(db, project)
    finally:
        db.close()
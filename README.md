# FinAI Requirements Studio

**Agentic AI–Powered Requirements Engineering, Regulatory Compliance & SDLC Recommendation Platform for the Financial Sector**

FinAI Requirements Studio automates end-to-end software requirements engineering for regulated financial systems (digital banking, UPI merchant settlement, treasury management, lending, and fraud prevention). Multi-agent LLM workflows collaborate with human stakeholders to elicit requirements, detect quality and conflict issues, ground compliance and risk audits in regulatory evidence (RBI directions), select and customize an appropriate SDLC methodology, and generate standardized IEEE 830 / 29148 specifications.

---

## Key Capabilities

* **Stakeholder Authentication & Role Context:** Sign up and log in with role profiles (*Product Owner*, *Business Analyst*, *Compliance & Legal Officer*, *Information Security Architect*, *Risk Manager*) and persistent session management.
* **Multi-Project Workspace:** Create, switch between, and persist independent financial software projects with isolated conversations, requirements, audits, SDLC decisions, and documentation.
* **Adaptive Stakeholder Elicitation:** Conversational requirement gathering that asks context-aware clarification questions, flags missing information, and converts unstructured dialogue into structured requirements (`ID`, `statement`, `category`, `confidence_score`, `approval_status`).
* **Automated Quality, Compliance & Risk Audits:**
  * **Quality & Conflict Analysis:** Evaluates requirement completeness, ambiguity, inconsistency, and conflicting expectations.
  * **Regulatory Compliance Mapping:** Retrieval-grounded checks against financial regulations with supporting evidence citations and recommendations.
  * **Security & Risk Analysis:** Identifies threat vectors, severity levels, and concrete mitigations.
* **Human-in-the-Loop Governance:** Explicit **Approve / Reject** gates on extracted requirements, compliance findings, risk findings, and SDLC selections, plus inline requirement editing.
* **Automatic SDLC Selection & Execution Workflow:** Infers project characteristics directly from conversations, requirements, quality, compliance, and risk findings to recommend a justified SDLC model (*Waterfall*, *V-Model*, *Prototyping*, *Iterative/Incremental*, *RAD*, *Spiral*, *Agile*), supports human model overrides with rationale, and generates a phase-by-phase execution workflow.
* **5-Artifact Specification Suite:**
  1. **IEEE 830 SRS Document** (with interactive section index and previous/next section navigation)
  2. **User Stories**
  3. **Use Cases**
  4. **Acceptance Criteria**
  5. **Requirements Traceability Matrix**
* **Financial Regulatory Knowledge Base (RAG):** Semantic search over indexed RBI circulars and compliance policies with source chunk citations.

---

## Architecture & Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js (App Router), React, TypeScript, Tailwind CSS |
| **Backend API** | FastAPI, Uvicorn, Pydantic |
| **Database & ORM** | PostgreSQL, SQLAlchemy, `psycopg` |
| **LLM & Retrieval** | Google Gemini API, Vector Store (RAG over regulatory documents) |

---

## Project Structure

```text
SE-MP/
├── backend/
│   ├── main.py              # FastAPI routes (auth, projects, chat, analysis, SDLC, docs, RAG)
│   ├── models.py            # SQLAlchemy ORM models (User, Project, Requirement, Findings, SDLC, Artifacts)
│   ├── database.py          # PostgreSQL engine and SessionLocal configuration
│   └── .env                 # Environment variables (DATABASE_URL, GEMINI_API_KEY)
└── frontend/
    └── app/
        ├── page.tsx         # Main application state, auth gate, and section views
        ├── types.ts         # TypeScript interfaces for requirements, audits, SDLC, and projects
        ├── lib/
        │   └── api.ts       # Backend API base URL configuration
        └── components/
            ├── AuthPage.tsx          # Login & Sign-up interface with stakeholder role selector
            ├── Sidebar.tsx           # Project switcher, navigation badges, and user sign-out footer
            └── DocumentationTabs.tsx # Tabbed viewer for IEEE SRS (indexed) + 4 specification artifacts
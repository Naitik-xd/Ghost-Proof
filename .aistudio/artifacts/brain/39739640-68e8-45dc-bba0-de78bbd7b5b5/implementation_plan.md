# GhostProof — Open-Source AI Fact Checker & Code Reviewer

GhostProof is a high-precision developer utility and analytical tool designed to verify AI-generated claims against factual web evidence and inspect source code for security flaws, secret leaks, and quality defects—without treating AI as infallible.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been confirmed based on user direction:

- **Confirmed Decision 1 (Model Selection)**: Exclusively Gemma 4 models (`gemma-4-31b-it` / `gemma-4-26b-a4b-it`) will be used as the primary AI engine for both Fact Checking and Code Review, with automated fallback to Gemma 2 (`gemma-2-27b-it` / `gemma-2-9b-it`). No Gemini models will be employed.
- **Confirmed Decision 2 (Code Review Ingestion)**: Both public GitHub repository URL analysis and in-browser client-side ZIP archive inspection are supported as mutually exclusive input methods per review.
- **Confirmed Decision 3 (Interactive Demonstration)**: Pre-loaded 1-click test claims (AI hallucinations, scientific claims, mixed facts) and sample code projects (vulnerable repository patterns with hardcoded tokens and SQL injection) will be integrated directly into the zero-states for instant verification.

---

### 1. Overview & Core Concept

GhostProof provides two focused, standalone tools accessible via a unified navigation shell:

1. **AI Fact Checker**:
   - Accepts pasted text (AI outputs, news snippets, blog posts) or uploaded documents (`.txt`, `.md`, `.json`, `.csv`).
   - Extracts discrete testable factual assertions.
   - Retrieves live credible web evidence corresponding to each extracted claim.
   - Prompts Gemma 4 to assess each claim against gathered evidence into four strict classifications: **Supported**, **Contradicted**, **Mixed Evidence**, and **Unverified**.
   - Generates an evidence breakdown highlighting quotes, source domains, confidence, and exportable Markdown/JSON audit reports.

2. **AI Code Reviewer**:
   - **Option A (Public GitHub Repository)**: Fetches repository trees via public GitHub API endpoints, filters out binaries/build artifacts/dependencies, extracts bounded source files, and streams findings.
   - **Option B (ZIP Archive)**: Parsed 100% inside the browser using JSZip, filtering for allowed source extensions (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.json`, `.html`, etc.), applying size/file limits, and displaying an interactive file tree preview before submitting.
   - Scans for hardcoded secrets and tokens (with deterministic regex pattern detection and automatic masking), security vulnerabilities (OWASP Top 10, injection, unsanitized inputs), bugs, and maintainability issues with exact file and line references.

---

### 2. User Experience & Visual Design

Following the universal frontend design constitution and developer console guidelines (`references/3_saas_dashboard.md`):

- **Aesthetic Direction**: Editorial developer-tool aesthetic. Technical, restrained, and confident. Avoids generic AI templates, floating purple orbs, glassmorphic blur, and static pill tags.
- **Color Palette & Contrast**:
  - Neutral canvas: Deep graphite / clean slate (`#0B0F17` / `#111827` dark foundation with clean light mode contrast).
  - Structural surfaces: `#1A2234` subtle hairline borders (`border-slate-800`), flat cards with single-elevation depth.
  - Semantic Status Colors:
    - Supported / Safe: Emerald (`#10B981`)
    - Contradicted / Critical: Crimson (`#EF4444`)
    - Mixed Evidence / Warning: Amber (`#F59E0B`)
    - Unverified / Info: Slate (`#64748B`)
- **Typography**: Clean contemporary pairing with `Plus Jakarta Sans` for display headlines and structural controls, paired with `JetBrains Mono` / `tabular-nums` for code snippets, line numbers, file paths, and confidence telemetry.
- **Top Bar Contract**:
  - Zone 1: Wordmark `GhostProof` with subtle ghost glyph.
  - Zone 2: Navigation tabs: `Fact Checker`, `Code Reviewer`, `About & Model Disclosure`.
  - Zone 3: Direct link to GitHub Open Source repository and status indicator.
- **Zero-Pill Discipline**: Status labels, timestamps, and claims use clean unboxed text with typographic bullet separators (`·` or `/`) instead of colorful bubble pills.
- **Empty & Demo States**: 1-click preset selector buttons ("Test AI Hallucination", "Verify Space Exploration Claim", "Scan Leaked Secret Repo", "Inspect Express API ZIP").

---

### 3. Key Product Decisions & Trade-Offs

- **Server-Side Gemma 4 Architecture**:
  - *Chosen Approach*: Backend Express endpoints (`/api/fact-check`, `/api/code-review`, `/api/github-tree`) handle model orchestration and credential protection.
  - *Why*: Protects `GEMINI_API_KEY`, enforces token and payload limits, handles deterministic regex secret scans, and handles Gemma 4 invocation with Gemma 2 fallback.
- **Client-Side ZIP Extraction**:
  - *Chosen Approach*: Decompress ZIP archives strictly in the browser using client-side JSZip. Only bounded, selected text contents are transmitted to `/api/code-review`.
  - *Why*: Eliminates large binary uploads to the backend server, prevents server-side denial of service, guarantees zero execution of untrusted binaries, and lets users inspect exactly which files are submitted.
- **Live Web Evidence for Gemma**:
  - *Chosen Approach*: Server-side web retrieval queries public authoritative search endpoints and knowledge extracts, feeding verifiable external context directly into Gemma 4's assessment prompt.
  - *Why*: Gemma 4 does not feature proprietary closed-search grounding out of the box; providing retrieved source text ensures transparency, reproducible source URLs, and prevents fabricated citations.
- **Deterministic Secret Masking**:
  - *Chosen Approach*: Deterministic pre-flight regex scanner identifies API keys, JWTs, private keys, and passwords before or during model review, masking the raw secret (e.g. `sk_live_...4a2b`) so secrets are never echoed in cleartext in UI or logs.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GhostProof Client                             │
│                                                                        │
│  ┌───────────────────────┐                  ┌───────────────────────┐  │
│  │   AI Fact Checker     │                  │   AI Code Reviewer    │  │
│  │  - Paste text / Doc   │                  │  - GitHub Repo URL    │  │
│  │  - Claim extraction   │                  │  - Browser JSZip      │  │
│  │  - 1-Click Samples    │                  │  - File Tree Preview  │  │
│  └───────────┬───────────┘                  └───────────┬───────────┘  │
│              │                                          │              │
│              ▼                                          ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │      Client State & Filter Controls (Status, Severity, Search)   │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │ HTTP POST JSON
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend (/api)                          │
│                                                                        │
│  ┌─────────────────────────┐               ┌────────────────────────┐  │
│  │   /api/fact-check       │               │   /api/code-review     │  │
│  │  - Claim extraction     │               │  - Deterministic Regex │  │
│  │  - Web Evidence Search  │               │    Secret Scanner      │  │
│  │  - Source Attribution   │               │  - Token Sanitizer     │  │
│  └───────────┬─────────────┘               └───────────┬────────────┘  │
│              │                                         │               │
│              └────────────────────┬────────────────────┘               │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Gemma 4 Service Engine                       │  │
│  │  - Primary: models/gemma-4-31b-it (or gemma-4-26b-a4b-it)        │  │
│  │  - Fallback: models/gemma-2-27b-it / gemma-2-9b-it              │  │
│  │  - Structured JSON response parsing & validation                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Structures

- **FactCheckReport**:
  - `id`: string
  - `inputText`: string
  - `claims`: Array of:
    - `id`: string
    - `claim`: string
    - `verdict`: `'supported' | 'contradicted' | 'mixed' | 'unverified'`
    - `confidence`: number (0-100)
    - `explanation`: string
    - `evidenceSnippet`: string
    - `sources`: Array<{ `title`: string, `url`: string, `domain`: string }>
  - `summary`: { `total`: number, `supported`: number, `contradicted`: number, `mixed`: number, `unverified`: number }

- **CodeReviewReport**:
  - `target`: string (repo name or ZIP filename)
  - `filesScanned`: number
  - `findings`: Array of:
    - `id`: string
    - `file`: string
    - `line`: number | null
    - `category`: `'secret' | 'security' | 'bug' | 'maintainability'`
    - `severity`: `'critical' | 'high' | 'medium' | 'low'`
    - `title`: string
    - `description`: string
    - `remediation`: string
    - `codeSnippet`: string (with masked secrets)
  - `stats`: { `critical`: number, `high`: number, `medium`: number, `low`: number }

#### Key Interactive Workflows & Handlers

1. **Fact Check Analysis**: User submits text -> UI displays staged progress (Extracting claims -> Gathering evidence -> Analyzing with Gemma 4) -> Results render with filter tabs (All, Supported, Contradicted, Mixed, Unverified) -> Copy Markdown Report / Download JSON.
2. **GitHub Review Workflow**: User inputs URL (e.g. `https://github.com/facebook/react`) -> Server validates URL, fetches repo tree via GitHub REST API, selects top code files within token limits -> Gemma 4 analyzes files -> Severity filterable finding cards with copyable fix patches.
3. **ZIP Archive Workflow**: User drops or selects `.zip` -> Browser parses directory hierarchy, skips ignored paths (`node_modules`, `dist`, `.git`, images, binaries) -> Shows file selector modal with checkboxes and file count -> User reviews files and clicks "Start Code Review" -> Server performs scan and returns actionable audit.
4. **Instant Test Samples**: One-click pills populate Fact Checker or Code Reviewer with curated real-world examples for seamless instant demonstration.

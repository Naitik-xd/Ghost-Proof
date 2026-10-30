# GhostProof — AI Fact Checker & Code Reviewer

GhostProof is a high-precision developer utility and analytical tool designed to verify claims against credible web evidence and inspect source code for security vulnerabilities, hardcoded backdoors, and quality defects.

---

## ⚡ Model Architecture & Priority Strategy

GhostProof employs a multi-tier model orchestration pipeline:

* **Priority Model: Gemma 4 (`gemma-4-26b-a4b-it`)**  
  All fact-checking assessments and code security audits are routed primarily to Google's open-weights Gemma 4 model.
* **Automated Fallback: Gemini (`gemini-2.5-flash`)**  
  If the Gemma 4 service times out or encounters upstream availability issues, the system automatically falls back to Gemini 2.5 Flash, ensuring zero downtime and reliable completion of audits.

---

## 🔒 Server-Side Security & Resource Protection

* **100% Server-Side API Key**: The `GEMINI_API_KEY` is loaded and executed strictly on the server (`server.ts` / `/api/*`). No API keys or credentials are ever exposed in client bundles or network traffic.
* **Global Rate Limiter (15 Requests / 5 Hours)**: To protect API quotas and prevent automated scraping or resource abuse, the server enforces a global rate limit of **15 AI requests per 5 hours across all incoming IPs**. Requests exceeding this threshold receive a `429 Too Many Requests` response with retry countdowns.
* **Client-Side Secret Masking**: Before code is sent for analysis, hardcoded tokens, passwords, and private keys are detected and masked (`sk-••••••••abcd`) to prevent credential leakage.
* **Search Engine Shield**: Configured with `<meta name="robots" content="noindex, nofollow" />` to keep testing and private audits unindexed.

---

## 🛠️ Features

### 1. AI Fact Checker
* Extracts discrete, testable factual assertions from paragraphs, lists, or uploaded notes (`.txt`, `.md`, `.json`, `.csv`).
* Retrieves live authoritative web evidence citations.
* Categorizes claims into **Supported**, **Contradicted**, **Mixed Evidence**, and **Unverified** with confidence ratings and source URLs.
* Exports structured Markdown and JSON audit reports.

### 2. AI Code Reviewer
* **Public Repository Ingestion**: Retrieves full source trees (up to 40+ files) via public Git APIs, filtering out build artifacts, dependencies, and lockfiles.
* **In-Browser ZIP Inspection**: Decompresses and extracts `.zip` projects 100% in the browser sandbox using JSZip before sending bounded source files.
* **Deterministic & AI Flaw Detection**: Catches hardcoded credentials, administrative email privilege escalation backdoors, client-side role gates, SQL injection, unauthenticated command injection, unsafe `eval()`, and CORS misconfigurations.
* **Interactive File Tree**: Preview, toggle, or filter which files are submitted for inspection.

---

## 🚀 Deployment on Vercel

GhostProof is preconfigured for zero-config Vercel deployment:

1. Import the repository into your [Vercel Dashboard](https://vercel.com).
2. Under **Project Settings > Environment Variables**, add:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Deploy! Vercel will automatically build the Vite frontend (`dist/`) and route `/api/*` to the serverless function (`api/index.ts`) defined in `vercel.json`.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# 3. Start local development server (port 3000)
npm run dev

# 4. Production build test
npm run build
npm start
```

---

## 📄 License

Open-source developer utility distributed under the Apache 2.0 License.

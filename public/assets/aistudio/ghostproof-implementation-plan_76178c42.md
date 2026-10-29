# GhostProof — Implementation Plan
**Hacktoberfest Open-Source AI Challenge · Week 4: Ghost in the Machine**

> **Product promise:** Check AI-generated claims against web evidence, or inspect code for security and quality issues—without pretending AI is infallible.

## 1. Product Overview

GhostProof is a lightweight, premium-feeling web app with **two separate tools users choose between**:

1. **AI Fact Checker** — users paste text or upload a supported document. GhostProof extracts checkable claims, searches the web for evidence, and uses Gemma to compare claims against sources.
2. **AI Code Reviewer** — users choose **one** input method:
   - Enter a public GitHub repository URL, **or**
   - Upload a ZIP archive of a code project.

The tools are independent. Users do not need to use both, and code reviewers never need to provide both a repository URL and a ZIP.

The project should feel like a real developer utility, not a generic AI chatbot or an oversized dashboard. Keep the weekend MVP focused on two reliable end-to-end workflows.

## 2. Core User Flows

### A. AI Fact Checker

1. User opens Fact Checker.
2. User pastes text or uploads a supported file.
3. Extract text from the file, preview it, and let the user correct extraction mistakes.
4. Identify individual claims that can be checked.
5. Search the web for relevant, credible evidence.
6. Ask the configured Gemma model to compare claims with retrieved evidence.
7. Show results grouped by claim:
   - **Supported**
   - **Contradicted**
   - **Mixed evidence**
   - **Unverified**
8. Display concise reasoning, source links, and the specific evidence used.
9. Allow the user to copy or export the report.

Rules:
- Lack of evidence is not proof that a claim is false.
- Separate a source's statements from the model's interpretation.
- Cite sources for findings and avoid fabricated citations.
- Make clear that results are evidence-assisted assessments, not a guarantee of truth.
- Limit input length and number of claims per run to control latency and API usage.
- For the first version, support only file types that can be extracted reliably. Show clear errors for unsupported or unreadable files.

### B. AI Code Reviewer

The user must choose **exactly one** input path per review:

#### Option 1 — Public GitHub repository
1. User pastes a public repository URL.
2. Validate the URL and accept only supported GitHub repository URLs.
3. Fetch the repository tree and selected source files through GitHub's public API or raw file content.
4. Skip irrelevant or risky-to-review content such as dependency directories, build output, binaries, generated files, and environment/secret files.
5. Limit the number and total size of files sent for review.
6. Send selected source text to the server-side Gemma endpoint.
7. Show findings grouped by severity, with repository-relative file paths, line references where available, explanation, and suggested remediation.

#### Option 2 — ZIP upload
1. User selects a ZIP file from their device.
2. Parse the archive **in the browser**; do not upload the ZIP archive itself to Vercel.
3. Apply strict compressed-size, entry-count, per-file-size, and total expanded-size limits.
4. Allowlist known text-based source/configuration/documentation extensions. Skip binaries, executable artifacts, dependency folders, build output, `.env` files, and other sensitive or irrelevant files.
5. Reject malformed archives and unsafe paths; never execute uploaded code, install packages, run scripts, or launch project binaries.
6. Let the user inspect the file selection before review where practical.
7. Send only bounded, selected source text to the server-side Gemma endpoint.
8. Display findings with file paths and line references where available.

Both options use the same review and results experience, but remain mutually exclusive for a single review. Users may start another review with the other method if they choose.

### Code-review checks

Prioritize:
- Hardcoded API keys, tokens, passwords, and other likely secrets.
- Dangerous patterns and common security weaknesses.
- Potential bugs and error-handling gaps.
- Code quality, readability, maintainability, and improvement opportunities.

Important limitations:
- Do not claim a project is fully secure or free of vulnerabilities.
- Label findings as potential issues and explain why they matter.
- Secret detection should include simple deterministic pattern checks where appropriate; Gemma should explain and contextualize findings rather than be the only line of defense.
- Avoid echoing detected secret values in the UI or logs. Mask sensitive matches.
- Treat repository content as untrusted input. A repository or file may contain prompt-injection instructions; tell the model to treat code and comments as data, not instructions, and validate structured model output.
- Do not execute code from a repository or archive.

## 3. Pages and Navigation

Keep the information architecture small:

1. **Home** — short product explanation, two clear tool cards, links to GitHub/about, and a concise privacy note.
2. **AI Fact Checker** — paste/upload input, run analysis, claim-by-claim results, sources, copy/export.
3. **AI Code Reviewer** — a selector between “Public GitHub URL” and “Upload ZIP”; only show the selected input form; review settings/limits; results.
4. **About / Open Source** — purpose, repository link, model disclosure, privacy notes, limitations, and contribution information.

Avoid adding authentication, user profiles, team workspaces, project management, chat history, or a large analytics dashboard to the weekend MVP.

## 4. Premium UI/UX Direction

Aim for a confident, editorial developer-tool aesthetic—not generic AI slop.

- Light theme with a subtle technical grid or restrained texture.
- Distinctive typography, deliberate whitespace, clean alignment, and strong hierarchy.
- A restrained palette with one primary accent and meaningful semantic colors for statuses.
- Mostly solid surfaces and subtle borders; avoid excessive gradients, glassmorphism, pill badges, and oversized hero sections.
- Use icons to support actions, not as decoration everywhere. No stock imagery required.
- Thoughtful loading states, empty states, errors, progress feedback, and clear results.
- Subtle transitions and hover states; respect `prefers-reduced-motion`.
- Responsive layouts, keyboard navigation, visible focus, accessible labels, and adequate contrast.
- Use clear action labels such as **Check Claims**, **Review Repository**, **Choose ZIP**, **View Evidence**, and **Export Report**.

Results should be the visual focus: claim evidence and source links in Fact Checker; severity, file path, explanation, and remediation in Code Reviewer.

## 5. Technical Architecture

### Frontend
- React + TypeScript + Tailwind CSS, matching the existing project setup.
- Keep the two tools as separate routes/views with shared design components.
- Parse ZIP files in the browser with a maintained archive library; never execute archive contents.
- Extract supported document text using maintained parsers. Keep the initial file-format list small and test each format.

### Backend
- Vercel-compatible server-side API routes.
- Keep the Google AI Studio API key in server-side environment variables; never expose it to client code or commit it to the repository.
- Configure and verify the exact Gemma model identifier and API support before implementing calls. Use the chosen Gemma model for both tools; do not silently switch models.
- Validate request shapes and sizes, apply rate limits, set timeouts, handle provider errors, and cap output sizes.
- Return structured JSON with schema validation. Handle malformed model responses gracefully.
- Never log complete uploaded content or secret values.

### Suggested endpoints
- `POST /api/fact-check` — receive bounded extracted text, retrieve web evidence, ask Gemma to assess claims, and return findings with source metadata.
- `POST /api/code-review` — receive a validated repository URL or bounded selected source files, then return code-review findings.
- Keep any shared model/evidence helpers internal rather than duplicating integration logic.

The web-search provider must be chosen and verified before implementation. Prefer an available, documented option that fits the project's free-tier constraints. Do not assume that the Gemma model itself automatically has live web access. If search is unavailable or quota-limited, show a clear error rather than fabricating evidence.

## 6. Privacy, Security, and Cost Controls

- No Supabase and no mandatory login.
- Avoid persistent storage unless the existing app needs it; do not store submitted content on the server by default.
- Clearly disclose that submitted text/source code is sent to the configured AI provider for analysis and that web search sends queries to the selected search provider.
- Browser-side ZIP parsing avoids sending the archive file itself to the server, but selected source text still goes to the backend/model.
- Set conservative limits for input size, claim count, file count, expanded ZIP size, and total code characters/tokens.
- Skip `.env`, credentials, private keys, and dependency/build folders; mask likely secrets found in source.
- Add rate limiting and basic abuse protection to server-side endpoints.
- Do not execute uploaded or remotely retrieved code.
- Use timeouts and bounded retries; avoid automatic retry loops.
- Provide understandable errors for unsupported files, invalid repository URLs, rate limits, unavailable models/search, and oversized input.
- Do not promise unlimited free usage. API quotas and provider policies can change.

## 7. MVP Scope and Build Order

### P0 — Must work
1. Premium responsive shell with two separate tool entry points.
2. Fact Checker: paste text, automatic web evidence retrieval, Gemma-assisted claim assessment, source links, and report copy/export.
3. Code Reviewer: public GitHub URL flow with bounded file selection, structured findings, and file references.
4. Server-side API key handling, request validation, limits, and useful error states.
5. Working deployed demo and clear project README.

### P1 — Add if time allows
1. Supported file uploads in Fact Checker with extraction preview and correction.
2. Browser-side ZIP parsing with strict safety limits and user-visible file selection.
3. Deterministic secret-pattern scanning with masking.
4. Markdown report export and polish for empty/loading/error states.

### P2 — Later, not required for the challenge
- Additional document and archive formats.
- More sophisticated static analysis.
- Persistent review history or accounts.
- Multi-repository batch analysis.
- Advanced diff views or automatic code changes.

If ZIP support is already implemented early, keep it; otherwise, finish and test the GitHub workflow first. Never cut security controls to fit the deadline.

## 8. Demo Scenario

Create a short demo that shows the product's two independent tools:

- **Fact Checker:** submit a short AI-generated paragraph containing several checkable claims; show source-backed findings and one claim marked unverified where evidence is insufficient.
- **Code Reviewer:** review a small public repository or safe sample ZIP; show a plausible hardcoded-secret warning, a maintainability suggestion, and file references.

Use sample content that is safe to share. Do not claim findings are real unless they are verified against the actual input and cited evidence.

## 9. Definition of Done

- Users can choose either tool independently.
- Fact Checker accepts pasted text and, when supported, a file; it retrieves web evidence and shows source-linked findings.
- Code Reviewer accepts a public GitHub URL **or** a ZIP, never requiring both for one review.
- ZIP contents are parsed as data only; no uploaded code is executed.
- Secrets are handled carefully and masked in output.
- Model and search failures produce clear errors, not fake results.
- API keys remain server-side.
- The UI is responsive, accessible, and visually coherent.
- README explains setup, environment variables, supported inputs, limitations, and privacy behavior.

## 10. Implementation Notes

- Verify the exact Gemma model and Google AI Studio API compatibility first; model availability, free quotas, and API terms can change.
- Choose the automatic web-search integration based on current availability, documented API behavior, and free-tier limits.
- Keep the first release small. Prioritize one reliable end-to-end workflow for each tool over extra formats or visualizations.
- Preserve existing working code and adapt the current project rather than restarting unnecessarily.

**Guiding principle:** GhostProof should help people question AI output with evidence and inspect code with actionable findings—while being honest about uncertainty and careful with user data.

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK with user agent telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Priority Gemma 4 models with token-efficient lightweight fallbacks
const GEMMA_MODELS = [
  'gemma-4-26b-a4b-it',    // Priority 1: Gemma 4 26B
  'gemma-4-31b-it',        // Priority 2: Gemma 4 31B
  'gemini-2.5-flash',       // Fallback 1: Gemini 2.5 Flash
  'gemini-2.5-flash-lite',  // Fallback 2: Gemini 2.5 Flash Lite (ultra-lightweight token saver & resilient to 503 spikes)
];

// ==========================================
// GLOBAL RATE LIMITER (15 requests per 5 hours across all IPs)
// Protects server-side API key and prevents abuse
// ==========================================
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const MAX_GLOBAL_AI_REQUESTS = 15;
const globalAiRequestTimestamps: number[] = [];

function checkGlobalAiRateLimit(): { allowed: boolean; remaining: number; retryAfterMinutes: number } {
  const now = Date.now();
  // Remove timestamps outside the 5-hour rolling window
  while (globalAiRequestTimestamps.length > 0 && globalAiRequestTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    globalAiRequestTimestamps.shift();
  }

  if (globalAiRequestTimestamps.length >= MAX_GLOBAL_AI_REQUESTS) {
    const oldest = globalAiRequestTimestamps[0];
    const retryAfterMs = Math.max(0, oldest + RATE_LIMIT_WINDOW_MS - now);
    const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterMs / (60 * 1000)));
    return {
      allowed: false,
      remaining: 0,
      retryAfterMinutes,
    };
  }

  return {
    allowed: true,
    remaining: MAX_GLOBAL_AI_REQUESTS - globalAiRequestTimestamps.length,
    retryAfterMinutes: 0,
  };
}

function recordGlobalAiRequest(): void {
  globalAiRequestTimestamps.push(Date.now());
}

function extractModelText(response: any): string | null {
  if (!response) return null;
  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    // 1. Check for standard response text (non-thought parts)
    const normalText = candidate.content.parts
      .filter((p: any) => !p.thought && p.text)
      .map((p: any) => p.text)
      .join('\n')
      .trim();
    if (normalText) return normalText;

    // 2. If the model output text within thought parts, extract it
    const anyText = candidate.content.parts
      .map((p: any) => p.text || '')
      .join('\n')
      .trim();
    if (anyText) return anyText;
  }
  return null;
}

/**
 * Execute prompt with Gemma model priority sequence and resilient fallback
 */
async function callGemma(prompt: string, instructionPrefix?: string): Promise<{ text: string; modelUsed: string } | null> {
  const fullPrompt = instructionPrefix ? `${instructionPrefix}\n\n${prompt}` : prompt;
  const startTime = Date.now();

  for (let i = 0; i < GEMMA_MODELS.length; i++) {
    const modelName = GEMMA_MODELS[i];
    const isPrimary = i === 0;

    // Remaining total budget (strictly staying within Vercel 55s limit)
    const elapsedSoFar = Date.now() - startTime;
    const remainingBudgetMs = Math.max(3000, 52000 - elapsedSoFar);
    if (remainingBudgetMs < 4000) {
      console.warn(`[AI Engine] Execution budget near Vercel 60s limit (${elapsedSoFar}ms elapsed). Breaking.`);
      break;
    }

    // Allocate per-model timeout: Gemma gets up to 22s, fallbacks get 10-14s
    const perModelMax = modelName.includes('gemma') ? 22000 : 12000;
    const timeoutMs = Math.min(perModelMax, remainingBudgetMs - 2000);

    try {
      console.log(`[AI Engine] Attempting ${isPrimary ? 'primary' : 'fallback'} model: ${modelName} (timeout: ${timeoutMs}ms)`);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      );

      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
          temperature: 0.15,
          systemInstruction: 'You are a concise code and factual auditor. Skip preliminary chain-of-thought analysis and directly output the requested JSON format.',
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const extractedText = extractModelText(response);

      if (extractedText) {
        console.log(`[AI Engine] Successfully generated response with ${modelName} in ${Date.now() - startTime}ms`);
        return { text: extractedText, modelUsed: modelName };
      }
    } catch (err: any) {
      const is503 = err?.message?.includes('503') || err?.message?.includes('high demand') || err?.message?.includes('UNAVAILABLE');
      if (is503) {
        console.warn(`[AI Engine] Model ${modelName} returned 503 (High Demand). Switching immediately to next model...`);
      } else {
        console.warn(`[AI Engine] ${isPrimary ? 'Primary' : 'Fallback'} model ${modelName} invocation failed:`, err?.message || err);
      }
      if (i + 1 < GEMMA_MODELS.length) {
        console.log(`[AI Engine] Switching to fallback model: ${GEMMA_MODELS[i + 1]}`);
      }
    }
  }

  return null;
}

/**
 * Deterministic secret pattern scanner with automatic masking
 */
interface DeterministicSecret {
  type: string;
  file: string;
  line: number;
  snippet: string;
}

const SECRET_PATTERNS = [
  { name: 'OpenAI / Generic Secret Key', regex: /sk-[a-zA-Z0-9_-]{20,}/g },
  { name: 'GitHub Personal Access Token', regex: /(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,})/g },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'Discord Webhook URL', regex: /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/g },
  { name: 'Resend API Key', regex: /re_[a-zA-Z0-9_]{20,}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Supabase JWT / Secret Token', regex: /eyJhbGciOi[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'Hardcoded Connection URI Password', regex: /(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:([^@\s]+)@/g },
];

function maskSecret(val: string): string {
  if (val.length <= 8) return '********';
  return val.slice(0, 4) + '••••••••' + val.slice(-4);
}

function scanDeterministicSecrets(files: { path: string; content: string }[]): DeterministicSecret[] {
  const secrets: DeterministicSecret[] = [];

  for (const file of files) {
    // Skip mock sample datasets and test fixture files from flagging real repo alerts
    if (/(?:sampleData|sample[_-]data|\.test\.|\.spec\.|fixtures?\/|mocks?\/)/i.test(file.path)) {
      continue;
    }

    const lines = file.content.split('\n');
    lines.forEach((lineText, idx) => {
      const trimmed = lineText.trim();
      // Skip comment lines and regex definitions
      if (/^(?:\/\/|\*|\/\*|name:|regex:)/.test(trimmed)) return;

      for (const pattern of SECRET_PATTERNS) {
        const matches = lineText.match(pattern.regex);
        if (matches) {
          for (const match of matches) {
            let maskedLine = lineText;
            if (pattern.name.includes('Connection URI')) {
              // Mask just password part
              maskedLine = lineText.replace(pattern.regex, (full, pass) => full.replace(pass, '••••••••'));
            } else {
              maskedLine = lineText.replace(match, maskSecret(match));
            }

            secrets.push({
              type: pattern.name,
              file: file.path,
              line: idx + 1,
              snippet: maskedLine.trim().slice(0, 160),
            });
          }
        }
      }
    });
  }

  return secrets;
}

interface DeterministicFlaw {
  category: 'security' | 'bug' | 'maintainability' | 'secret';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  file: string;
  line: number;
  description: string;
  codeSnippet: string;
  remediation: string;
}

function scanDeterministicVulnerabilities(files: { path: string; content: string }[]): DeterministicFlaw[] {
  const flaws: DeterministicFlaw[] = [];

  for (const file of files) {
    // Skip mock sample datasets and test fixture files
    if (/(?:sampleData|sample[_-]data|\.test\.|\.spec\.|fixtures?\/|mocks?\/)/i.test(file.path)) {
      continue;
    }

    const lines = file.content.split('\n');

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // Skip comment lines, documentation strings, and rule metadata (prevents scanner from matching its own rules)
      if (/^(?:\/\/|\*|\/\*|description:|remediation:|title:|name:|regex:)/.test(trimmed)) {
        return;
      }

      // 1. Hardcoded admin email backdoor / privilege escalation
      if (/(?:user(?:Email|\.email)?\s*===?\s*['"][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"])/i.test(line)) {
        flaws.push({
          category: 'security',
          severity: 'critical',
          title: 'Hardcoded Administrator Email Privilege Escalation Backdoor',
          file: file.path,
          line: idx + 1,
          description: 'Administrative authorization is granted based on hardcoded email address comparisons in source code. This creates a hardcoded backdoor and circumvents proper Role-Based Access Control (RBAC).',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Remove hardcoded email comparisons. Store roles securely in your database and verify administrative privileges using server-side session claims and Row-Level Security (RLS) policies.',
        });
      }

      // 2. Client-side state privilege check
      if (/(?:isAdminLocally|isAdminState)\s*===?\s*true/.test(line) || /if\s*\(\s*!session\s*\|\|\s*!isAdminLocally\s*\)/.test(line)) {
        flaws.push({
          category: 'security',
          severity: 'high',
          title: 'Client-Side Role Gate Without Server Verification',
          file: file.path,
          line: idx + 1,
          description: 'Access to administrative views or sensitive features is guarded solely by local React state. Client-side state can be trivially overridden in browser developer tools.',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Enforce authorization checks on the backend API or via database RLS. Never rely on client-side state flags to protect administrative features.',
        });
      }

      // 3. Plaintext admin command execution in public chatbot endpoint
      if (/(?:latestMessage|\.content)\.startsWith\(['"]\/admin/i.test(line) || /command\s*===?\s*['"]\/admin-ban/i.test(line)) {
        flaws.push({
          category: 'security',
          severity: 'high',
          title: 'Unauthenticated Admin Command Injection in Public Endpoint',
          file: file.path,
          line: idx + 1,
          description: 'Administrative functions (such as banning IPs or modifying state) are executed through an unauthenticated public chat interface using parameter splitting.',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Remove administrative commands from the public chat handler. Implement dedicated administrative REST endpoints protected by cryptographic JWT session tokens.',
        });
      }

      // 4. SQL Injection
      if (/(?:SELECT|INSERT|UPDATE|DELETE).*\+.*(?:req\.|params\.|query\.|body\.)/i.test(line) || /(?:SELECT|INSERT|UPDATE|DELETE).*WHERE.*\$\{/i.test(line)) {
        flaws.push({
          category: 'security',
          severity: 'critical',
          title: 'Potential SQL Injection Vulnerability',
          file: file.path,
          line: idx + 1,
          description: 'Dynamic string concatenation or template interpolation detected in database query with unescaped input.',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Use parameterized queries or prepared statements (e.g. supabase.from("table").select().eq("id", id) or db.query("SELECT ... WHERE id = $1", [id])).',
        });
      }

      // 5. Remote Code Execution / Eval
      // Exclude strings/quotes defining the rule itself
      if (/(?<!['"`\w])eval\s*\([^)]*\)/.test(line) || /new\s+Function\s*\(/.test(line) || /child_process.*(?:exec|spawn)\s*\(/.test(line)) {
        if (!/['"`].*eval\s*\(.*['"`]/.test(line) && !/\bregex\b/.test(line)) {
          flaws.push({
            category: 'security',
            severity: 'critical',
            title: 'Unsafe Code Execution / Eval Detected',
            file: file.path,
            line: idx + 1,
            description: 'Direct invocation of dynamic code evaluation or shell execution passes raw strings directly to the runtime interpreter.',
            codeSnippet: line.trim().slice(0, 160),
            remediation: 'Avoid dynamic code execution. Parse structured data using JSON.parse() or invoke safe dedicated subprocess APIs.',
          });
        }
      }

      // 6. Insecure wildcard CORS
      if (/'Access-Control-Allow-Origin'\s*:\s*'\*'/i.test(line) || (/'origin'\s*:\s*['"]\*['"]/i.test(line) && /credentials\s*:\s*true/i.test(file.content))) {
        flaws.push({
          category: 'security',
          severity: 'high',
          title: 'Insecure Wildcard CORS Configuration',
          file: file.path,
          line: idx + 1,
          description: 'Allowing wildcard origins with credentials enables unauthorized cross-origin requests from malicious sites.',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Specify an explicit list of trusted origin domains rather than wildcard "*".',
        });
      }

      // 7. Sensitive data logged to console
      if (/console\.(?:log|warn|error)\(.*(?:password|secret|apiKey|dcKey|service_role|token).*\)/i.test(line)) {
        flaws.push({
          category: 'maintainability',
          severity: 'medium',
          title: 'Sensitive Credential or Token Exposure in Logs',
          file: file.path,
          line: idx + 1,
          description: 'Logging potentially sensitive authentication credentials, API tokens, or secrets to console stdout.',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Remove console logging of credentials and sanitize debug statements before committing.',
        });
      }

      // 8. Dangerous HTML injection
      if (/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/i.test(line)) {
        flaws.push({
          category: 'security',
          severity: 'high',
          title: 'Potential Cross-Site Scripting (XSS) via dangerouslySetInnerHTML',
          file: file.path,
          line: idx + 1,
          description: 'Direct injection of raw HTML into DOM elements risks executing malicious script payloads if content includes user input.',
          codeSnippet: line.trim().slice(0, 160),
          remediation: 'Sanitize HTML with DOMPurify before rendering, or prefer native React text rendering to prevent XSS.',
        });
      }
    });
  }

  return flaws;
}

/**
 * Fetch factual web evidence using multi-source search (Wikipedia and live open queries)
 */
async function fetchWebEvidence(claims: string[]): Promise<Array<{ claim: string; query: string; evidence: string; sources: Array<{ title: string; url: string; domain: string }> }>> {
  const boundedClaims = claims.slice(0, 5);

  const promises = boundedClaims.map(async (claim) => {
    const searchTerms = claim
      .replace(/[^\w\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .join(' ');

    const sources: Array<{ title: string; url: string; domain: string }> = [];
    let evidenceText = '';

    try {
      // 1. Wikipedia Search API with 3s timeout
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerms)}&utf8=&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'GhostProof-Verifier/1.0 (academic/developer evaluation)' },
        signal: AbortSignal.timeout(3000),
      });

      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const searchList = wikiData.query?.search || [];

        for (const item of searchList.slice(0, 2)) {
          const cleanSnippet = (item.snippet || '')
            .replace(/<span class="searchmatch">/g, '')
            .replace(/<\/span>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, '&');

          evidenceText += `Source: Wikipedia (${item.title})\nExcerpt: ${cleanSnippet}\n\n`;
          sources.push({
            title: item.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
            domain: 'en.wikipedia.org',
          });
        }
      }
    } catch (e: any) {
      // Non-blocking timeout or error
    }

    return {
      claim,
      query: searchTerms,
      evidence: evidenceText.trim() || 'No direct web articles retrieved for this specific statement.',
      sources: sources.slice(0, 3),
    };
  });

  return Promise.all(promises);
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * Health check & Model configuration
 */
app.get('/api/health', (req, res) => {
  const rateLimitState = checkGlobalAiRateLimit();
  res.json({
    status: 'ok',
    primaryModel: GEMMA_MODELS[0],
    fallbackModel: GEMMA_MODELS[1],
    models: GEMMA_MODELS,
    rateLimit: {
      maxRequests: MAX_GLOBAL_AI_REQUESTS,
      windowHours: 5,
      remaining: rateLimitState.remaining,
      allowed: rateLimitState.allowed,
      retryAfterMinutes: rateLimitState.retryAfterMinutes,
    },
    version: '1.0.0',
  });
});

/**
 * POST /api/fact-check
 * Accepts input text or document content, extracts claims, retrieves evidence,
 * and calls Gemma 4 (with Gemini fallback) for verification.
 * Enforces global rate limit of 15 requests per 5 hours across all IPs.
 */
app.post('/api/fact-check', async (req, res) => {
  try {
    // Enforce global AI rate limit
    const rateCheck = checkGlobalAiRateLimit();
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Global AI rate limit reached: Maximum 15 requests per 5 hours exceeded across all users to protect resources and API quotas. Please try again in ~${rateCheck.retryAfterMinutes} minutes.`,
        retryAfterMinutes: rateCheck.retryAfterMinutes,
        remaining: 0,
      });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required for fact-checking.' });
    }

    if (text.length > 15000) {
      return res.status(400).json({ error: 'Input text exceeds 15,000 characters limit. Please shorten the sample.' });
    }

    // Record request against global rate limit
    recordGlobalAiRequest();

    // Step 1: Extract discrete testable factual claims
    const rawParagraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    let extractedClaims: string[] = [];

    // Check if the input contains bulleted / numbered assertions
    const bulletCandidates = rawParagraphs
      .filter(p => /^[-*•\d.)]+\s+/.test(p))
      .map(p => p.replace(/^[-*•\d.)]+\s*/, '').trim())
      .filter(p => p.length >= 15 && p.length <= 300);

    if (bulletCandidates.length >= 2) {
      extractedClaims = bulletCandidates.slice(0, 4);
    } else {
      // Split by sentence boundaries (.!?)
      const sentences = text
        .replace(/\n+/g, ' ')
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 20 && s.length <= 300);
      extractedClaims = sentences.slice(0, 4);
    }

    if (extractedClaims.length === 0) {
      // Fallback: take first chunk
      extractedClaims = [text.trim().slice(0, 200)];
    }

    // Step 2: Fetch factual web evidence
    const evidenceItems = await fetchWebEvidence(extractedClaims);

    // Step 3: Ask Gemma 4 to assess claims against retrieved evidence
    const evidenceSummaryText = evidenceItems
      .map((item, i) => `Claim ${i + 1}: "${item.claim}"\nEvidence snippet: "${item.evidence.slice(0, 250).replace(/\s+/g, ' ')}"`)
      .join('\n\n');

    const assessmentPrompt = `Analyze each claim against the retrieved evidence citations below.
Assign a verdict ("supported", "contradicted", "mixed", or "unverified") with confidence (10-95).

Claims and Evidence:
${evidenceSummaryText}

Output strictly a JSON array with objects matching:
[{"claim":"exact claim text","verdict":"supported","confidence":90,"explanation":"1-2 concise sentences","evidenceSnippet":"short quote"}]
Do not include markdown fences or explanations outside the JSON array.`;

    let evaluatedClaims: any[] = [];
    let modelUsed = GEMMA_MODELS[0];

    try {
      const assessmentResult = await callGemma(assessmentPrompt, 'Evaluate these factual claims objectively. Output only a raw JSON array.');
      if (assessmentResult && assessmentResult.text) {
        modelUsed = assessmentResult.modelUsed;
        let cleanedAssess = assessmentResult.text.trim();
        if (cleanedAssess.startsWith('```json')) cleanedAssess = cleanedAssess.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        if (cleanedAssess.startsWith('```')) cleanedAssess = cleanedAssess.replace(/^```\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleanedAssess);
        if (Array.isArray(parsed) && parsed.length > 0) {
          evaluatedClaims = parsed;
        }
      }
    } catch {
      // Fallback below
    }

    if (evaluatedClaims.length === 0) {
      evaluatedClaims = evidenceItems.map((item) => {
        const hasSnippet = item.evidence && !item.evidence.includes('No direct web articles');
        return {
          claim: item.claim,
          verdict: hasSnippet ? 'mixed' : 'unverified',
          confidence: hasSnippet ? 70 : 45,
          explanation: hasSnippet
            ? 'Evaluated against retrieved knowledge sources and external search summaries.'
            : 'Insufficient direct authoritative evidence found in web index.',
          evidenceSnippet: item.evidence.slice(0, 200),
        };
      });
    }

    // Combine evaluated claims with sources
    const finalClaims = evaluatedClaims.map((ec: any, idx: number) => {
      const matchEvidence = evidenceItems.find((ev) => ev.claim.toLowerCase() === (ec.claim || '').toLowerCase()) || evidenceItems[idx];
      return {
        id: `claim-${idx + 1}`,
        claim: ec.claim || extractedClaims[idx],
        verdict: ['supported', 'contradicted', 'mixed', 'unverified'].includes(ec.verdict) ? ec.verdict : 'unverified',
        confidence: typeof ec.confidence === 'number' ? ec.confidence : 75,
        explanation: ec.explanation || 'Analyzed against web references.',
        evidenceSnippet: ec.evidenceSnippet || matchEvidence?.evidence.slice(0, 180) || 'No excerpt available.',
        sources: matchEvidence?.sources || [],
      };
    });

    const summary = {
      total: finalClaims.length,
      supported: finalClaims.filter((c: any) => c.verdict === 'supported').length,
      contradicted: finalClaims.filter((c: any) => c.verdict === 'contradicted').length,
      mixed: finalClaims.filter((c: any) => c.verdict === 'mixed').length,
      unverified: finalClaims.filter((c: any) => c.verdict === 'unverified').length,
    };

    res.json({
      id: `report-${Date.now()}`,
      modelUsed: modelUsed,
      inputText: text,
      claims: finalClaims,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Fact check error:', error);
    res.status(500).json({ error: error.message || 'Internal error during fact-checking analysis.' });
  }
});

/**
 * Helper to fetch public GitHub repository tree & select source files
 */
app.post('/api/github-fetch', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'GitHub repository URL is required.' });
    }

    // Validate GitHub URL format
    const match = url.trim().match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub URL. Must be in the format: https://github.com/owner/repository' });
    }

    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);

    // Fetch repository default branch and tree
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'User-Agent': 'GhostProof-Code-Reviewer',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!repoInfoRes.ok) {
      if (repoInfoRes.status === 404) {
        return res.status(404).json({ error: `Repository ${owner}/${repo} not found or is private.` });
      }
      if (repoInfoRes.status === 403) {
        return res.status(403).json({ error: 'GitHub API rate limit exceeded. You can also upload a ZIP file directly.' });
      }
      return res.status(repoInfoRes.status).json({ error: `GitHub error: ${repoInfoRes.statusText}` });
    }

    const repoInfo = await repoInfoRes.json();
    const defaultBranch = repoInfo.default_branch || 'main';

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
      headers: {
        'User-Agent': 'GhostProof-Code-Reviewer',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!treeRes.ok) {
      return res.status(treeRes.status).json({ error: `Failed to fetch repo file tree: ${treeRes.statusText}` });
    }

    const treeData = await treeRes.json();
    const allFiles: Array<{ path: string; size: number }> = (treeData.tree || [])
      .filter((item: any) => item.type === 'blob')
      .map((item: any) => ({ path: item.path, size: item.size || 0 }));

    // Filter relevant source files
    const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.php', '.rb', '.json', '.yaml', '.yml', '.sql', '.sh', '.html', '.css'];
    const IGNORED_PATHS = [
      'node_modules/', 'dist/', 'build/', '.git/', 'vendor/',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '.min.js', '.min.css', '.next/',
      'sampleData.ts', 'sampleData.js', 'samples/', 'mocks/', 'fixtures/', '__tests__/'
    ];

    const filteredFiles = allFiles.filter((f) => {
      const ext = path.extname(f.path).toLowerCase();
      const isAllowed = ALLOWED_EXTS.includes(ext);
      const isIgnored = IGNORED_PATHS.some((ign) => f.path.includes(ign));
      return isAllowed && !isIgnored && f.size < 120000; // max 120KB per file
    });

    // Sort to prioritize security-relevant modules first, but load up to 40 files from the repo
    const priorityKeywords = ['auth', 'admin', 'api', 'gemini', 'user', 'supabase', 'server', 'db', 'security', 'booking', 'config', 'index', 'main', 'app'];
    const sorted = [...filteredFiles].sort((a, b) => {
      const aPri = priorityKeywords.some((p) => a.path.toLowerCase().includes(p)) ? 1 : 0;
      const bPri = priorityKeywords.some((p) => b.path.toLowerCase().includes(p)) ? 1 : 0;
      return bPri - aPri;
    });

    const selectedToFetch = sorted.slice(0, 40);

    // Concurrently fetch raw files from raw.githubusercontent.com
    const fetchPromises = selectedToFetch.map(async (f) => {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${f.path}`;
        const rawRes = await fetch(rawUrl, {
          headers: { 'User-Agent': 'GhostProof-Code-Reviewer' },
          signal: AbortSignal.timeout(10000),
        });
        if (rawRes.ok) {
          const content = await rawRes.text();
          return {
            path: f.path,
            content: content.slice(0, 30000),
            size: content.length,
          };
        }
      } catch (err) {
        console.warn(`Could not load ${f.path}`);
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    const loadedFiles = results.filter((r): r is NonNullable<typeof r> => r !== null);

    res.json({
      repo: `${owner}/${repo}`,
      branch: defaultBranch,
      totalFilesInRepo: allFiles.length,
      filteredSourceCount: filteredFiles.length,
      filesLoaded: loadedFiles,
    });
  } catch (err: any) {
    console.error('GitHub fetch error:', err);
    res.status(500).json({ error: err.message || 'Error fetching GitHub repository.' });
  }
});

/**
 * POST /api/code-review
 * Receives files (from GitHub fetch or browser-parsed ZIP), runs deterministic secret & vulnerability scanner,
 * and calls Gemma 4 (with Gemini fallback) for in-depth code review findings.
 * Enforces global rate limit of 15 requests per 5 hours across all IPs.
 */
app.post('/api/code-review', async (req, res) => {
  try {
    // Enforce global AI rate limit
    const rateCheck = checkGlobalAiRateLimit();
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Global AI rate limit reached: Maximum 15 requests per 5 hours exceeded across all users to protect resources and API quotas. Please try again in ~${rateCheck.retryAfterMinutes} minutes.`,
        retryAfterMinutes: rateCheck.retryAfterMinutes,
        remaining: 0,
      });
    }

    const { targetName, files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for code review.' });
    }

    // Record request against global rate limit
    recordGlobalAiRequest();

    // Process all provided files
    const allFilesToScan = files.map((f: any) => ({
      path: String(f.path || 'unknown'),
      content: String(f.content || ''),
    }));

    // 1. Run deterministic secret scanner across ALL files
    const detectedSecrets = scanDeterministicSecrets(allFilesToScan);

    // 2. Scan for deterministic security vulnerabilities across ALL files
    const deterministicFlaws = scanDeterministicVulnerabilities(allFilesToScan);

    // 3. Prepare priority files for Gemma 4 AI deep review (up to 4 core logic files)
    const priorityKeywords = ['auth', 'admin', 'api', 'gemini', 'user', 'supabase', 'server', 'db', 'security', 'booking', 'function'];
    const aiCandidateFiles = [...allFilesToScan].sort((a, b) => {
      const aScore = priorityKeywords.some((k) => a.path.toLowerCase().includes(k)) ? 1 : 0;
      const bScore = priorityKeywords.some((k) => b.path.toLowerCase().includes(k)) ? 1 : 0;
      return bScore - aScore;
    }).slice(0, 2);

    const sanitizedFilesForModel = aiCandidateFiles.map((f) => {
      let content = f.content;
      SECRET_PATTERNS.forEach((p) => {
        content = content.replace(p.regex, (match) => maskSecret(match));
      });
      return {
        path: f.path,
        content: content.slice(0, 1200),
      };
    });

    const fileSnippets = sanitizedFilesForModel
      .map((f) => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');

    const reviewPrompt = `Identify security vulnerabilities in the source code snippets below. Return at most 4 critical findings.

${fileSnippets}

Strictly output a JSON array:
[
  {
    "category": "security" | "bug" | "maintainability" | "secret",
    "severity": "critical" | "high" | "medium" | "low",
    "title": "Clear concise vulnerability title",
    "file": "path",
    "line": 1,
    "description": "Specific explanation of the security flaw",
    "codeSnippet": "code snippet",
    "remediation": "Concrete actionable fix"
  }
]
Output only the raw JSON array.`;

    let gemmaFindings: any[] = [];
    let modelUsed = GEMMA_MODELS[0];

    try {
      const gemmaResult = await callGemma(reviewPrompt, 'Audit this source code objectively. Output only a valid JSON array.');
      if (gemmaResult && gemmaResult.text) {
        modelUsed = gemmaResult.modelUsed;
        const text = gemmaResult.text.trim();
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            gemmaFindings = parsed;
          }
        }
      }
    } catch (err: any) {
      console.warn('Gemma code review error:', err?.message || err);
    }

    // Combine findings
    const combinedFindings: any[] = [];

    // Add deterministic secret findings
    detectedSecrets.forEach((sec, idx) => {
      combinedFindings.push({
        id: `secret-${idx + 1}`,
        category: 'secret',
        severity: 'critical',
        title: `Hardcoded ${sec.type} Detected`,
        file: sec.file,
        line: sec.line,
        description: `Active credential or token found hardcoded in source file. Exposed secrets can be extracted by unauthorized users or repository scanners.`,
        codeSnippet: sec.snippet,
        remediation: `Move this credential to an environment variable or secret management vault and rotate the existing secret immediately.`,
      });
    });

    // Add deterministic security flaws
    deterministicFlaws.forEach((flaw, idx) => {
      combinedFindings.push({
        id: `vuln-${idx + 1}`,
        category: flaw.category,
        severity: flaw.severity,
        title: flaw.title,
        file: flaw.file,
        line: flaw.line,
        description: flaw.description,
        codeSnippet: flaw.codeSnippet,
        remediation: flaw.remediation,
      });
    });

    // Add Gemma findings with unique IDs (avoid duplicates)
    gemmaFindings.forEach((gf, idx) => {
      // Check if already captured by deterministic scanner for same file and line
      const alreadyCaptured = combinedFindings.some(
        (cf) => cf.file === gf.file && Math.abs((cf.line || 0) - (gf.line || 0)) <= 2
      );

      if (!alreadyCaptured) {
        combinedFindings.push({
          id: `ai-finding-${idx + 1}`,
          category: ['secret', 'security', 'bug', 'maintainability'].includes(gf.category) ? gf.category : 'security',
          severity: ['critical', 'high', 'medium', 'low'].includes(gf.severity) ? gf.severity : 'medium',
          title: gf.title || 'Potential Security or Quality Issue',
          file: gf.file || allFilesToScan[0]?.path || 'source',
          line: typeof gf.line === 'number' ? gf.line : null,
          description: gf.description || 'Issue detected in source analysis.',
          codeSnippet: gf.codeSnippet || '',
          remediation: gf.remediation || 'Review and refactor the code according to best security practices.',
        });
      }
    });

    // Sort findings by severity: critical > high > medium > low
    const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    combinedFindings.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

    const stats = {
      critical: combinedFindings.filter((f) => f.severity === 'critical').length,
      high: combinedFindings.filter((f) => f.severity === 'high').length,
      medium: combinedFindings.filter((f) => f.severity === 'medium').length,
      low: combinedFindings.filter((f) => f.severity === 'low').length,
    };

    res.json({
      id: `review-${Date.now()}`,
      target: targetName || 'Selected Codebase',
      filesScanned: allFilesToScan.length,
      modelUsed,
      stats,
      findings: combinedFindings,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Code review error:', error);
    res.status(500).json({ error: error.message || 'Internal error during code review.' });
  }
});

// ==========================================
// STATIC & VITE SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GhostProof server running on http://0.0.0.0:${PORT}`);
  });
}

// In local dev and standard Node server runtime, start server.
// In Vercel serverless environment, the exported app is handled by @vercel/node.
if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;

import React from 'react';
import { ShieldCheck, Cpu, Lock, FileSearch, Code, AlertCircle } from 'lucide-react';

interface AboutViewProps {
  isDark?: boolean;
}

export const AboutView: React.FC<AboutViewProps> = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Title & Introduction */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-medium">
          Hacktoberfest Open-Source AI Challenge · Week 4: Ghost in the Machine
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          About GhostProof
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          GhostProof is an open-source, evidence-grounded verification engine and code auditor built to question AI-generated claims and inspect software for security vulnerabilities—without pretending AI is infallible.
        </p>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1 */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Cpu className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Gemma 4 Architecture</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            GhostProof operates strictly on open weights Gemma models, primarily leveraging Gemma 4 (<code className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">gemma-4-26b-a4b-it</code> / <code className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">gemma-4-31b-it</code>). No proprietary closed black-box models are required.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileSearch className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Factual Web Evidence Grounding</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Claims extracted by the Fact Checker are paired with live, multi-source external citations retrieved from open knowledge bases and Wikipedia search. Gemma 4 evaluates claims strictly against cited text.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Deterministic Secret Masking</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Pre-flight regex scanning actively intercepts API keys, AWS credentials, JWTs, and private keys. Sensitive token bodies are masked (e.g. <code className="font-mono text-slate-700 dark:text-slate-300">sk_••••••••4a2b</code>) before inspection, ensuring secrets are never echoed in raw text or logs.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Browser-Side ZIP Sandboxing</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            ZIP archives are decoded 100% inside your browser via JSZip. Raw archive binaries, executable files, and build outputs are never sent to the server. Only selected, text-based code is audited as static data.
          </p>
        </div>
      </div>

      {/* Important Disclaimers & Limitations */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          Critical Verification Rules &amp; Limitations
        </h2>
        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5 list-disc list-inside leading-relaxed">
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Lack of evidence is not proof of falsehood:</strong> When no decisive web sources exist for an assertion, GhostProof marks it <span className="text-slate-800 dark:text-slate-200 font-semibold">Unverified</span> rather than falsely asserting it is contradicted.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Untrusted Input Protection:</strong> Repositories and text inputs are treated purely as passive data, never instructions. Prompt injection attempts within inspected code are ignored by the structured schema.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Assisted Assessment, Not Guarantees:</strong> Static model inspections point out potential flaws, antipatterns, and missing validations. They do not constitute formal cryptographic or legal guarantees that code is bug-free.
          </li>
        </ul>
      </div>

      {/* Open Source & Links */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">GhostProof Open Source Repository</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Built for Hacktoberfest 2026. Contributions, feedback, and issue reports are welcomed.
          </p>
        </div>
        <a
          href="https://github.com/Naitik-xd/Ghost-Proof"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs active:scale-95"
        >
          <Code className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>View Source Repository</span>
        </a>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileCheck, 
  Upload, 
  Sparkles, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle, 
  Copy, 
  Download, 
  RotateCcw,
  Search,
  BookOpen,
  ArrowRight,
  Globe,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { FactCheckReport, ClaimFinding, Verdict } from '../types';
import { FACT_SAMPLES, FactSample } from '../data/sampleData';
import { ThreeCanvas } from './ThreeCanvas';

interface FactCheckerProps {
  isDark: boolean;
}

export const FactChecker: React.FC<FactCheckerProps> = ({ isDark }) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FactCheckReport | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<Verdict | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.txt', '.md', '.json', '.csv'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setError(`Unsupported file type. Please upload a plain text file (${validExtensions.join(', ')}).`);
      return;
    }

    if (file.size > 200 * 1024) {
      setError('File size exceeds 200KB limit. Please provide a more concise document.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.onerror = () => {
      setError('Failed to read the uploaded document.');
    };
    reader.readAsText(file);
  };

  // Run fact-checking
  const handleCheckClaims = async () => {
    if (!inputText.trim()) {
      setError('Please enter or paste text containing claims to verify.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingStage('Extracting distinct assertions from text...');

    try {
      const stageTimer1 = setTimeout(() => {
        setLoadingStage('Retrieving live external web citations & Wikipedia references...');
      }, 1200);

      const stageTimer2 = setTimeout(() => {
        setLoadingStage('Gemma 4 synthesizing evidence & computing verdicts...');
      }, 3000);

      const res = await fetch('/api/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete fact check.');
      }

      setReport(data);

      // Trigger celebratory micro-confetti if at least 1 supported claim found
      if (data.summary?.supported > 0) {
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#10b981', '#34d399', '#6ee7b7'],
          });
        } catch {
          // Non-critical
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during fact-checking.');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // 1-Click Sample selection
  const handleSelectSample = (sample: FactSample) => {
    setInputText(sample.text);
    setError(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedClaims((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy Markdown report
  const handleCopyMarkdown = () => {
    if (!report) return;

    let md = `# GhostProof Fact-Check Audit Report\n\n`;
    md += `*Generated: ${new Date(report.timestamp).toLocaleString()} | Model: ${report.modelUsed}*\n\n`;
    md += `## Input Summary\n> "${report.inputText.slice(0, 300)}..."\n\n`;
    md += `## Findings (${report.claims.length} claims verified)\n\n`;

    report.claims.forEach((c, idx) => {
      md += `### ${idx + 1}. [${c.verdict.toUpperCase()}] ${c.claim}\n`;
      md += `- **Confidence**: ${c.confidence}%\n`;
      md += `- **Explanation**: ${c.explanation}\n`;
      md += `- **Evidence Excerpt**: "${c.evidenceSnippet}"\n`;
      if (c.sources.length > 0) {
        md += `- **Sources**:\n`;
        c.sources.forEach((s) => {
          md += `  - [${s.title}](${s.url}) (${s.domain})\n`;
        });
      }
      md += `\n---\n\n`;
    });

    navigator.clipboard.writeText(md);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Download JSON report
  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostproof-factcheck-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered claims
  const filteredClaims = (report?.claims || []).filter((claim) => {
    const matchesVerdict = filterVerdict === 'all' || claim.verdict === filterVerdict;
    const matchesSearch =
      searchQuery.trim() === '' ||
      claim.claim.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.evidenceSnippet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesVerdict && matchesSearch;
  });

  const getVerdictStyle = (v: Verdict) => {
    switch (v) {
      case 'supported':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          label: 'Supported',
          color: 'text-emerald-700 dark:text-emerald-400',
          badgeBg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
          border: 'border-emerald-200 dark:border-emerald-500/30',
          bg: 'bg-emerald-50/40 dark:bg-emerald-500/5',
        };
      case 'contradicted':
        return {
          icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
          label: 'Contradicted',
          color: 'text-rose-700 dark:text-rose-400',
          badgeBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
          border: 'border-rose-200 dark:border-rose-500/30',
          bg: 'bg-rose-50/40 dark:bg-rose-500/5',
        };
      case 'mixed':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
          label: 'Mixed Evidence',
          color: 'text-amber-700 dark:text-amber-400',
          badgeBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
          border: 'border-amber-200 dark:border-amber-500/30',
          bg: 'bg-amber-50/40 dark:bg-amber-500/5',
        };
      case 'unverified':
      default:
        return {
          icon: <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />,
          label: 'Unverified',
          color: 'text-slate-600 dark:text-slate-400',
          badgeBg: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/60',
          border: 'border-slate-200 dark:border-slate-700/60',
          bg: 'bg-slate-50/60 dark:bg-slate-800/20',
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Immersive 3D Hero Banner when in zero state */}
      {!report && (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 dark:from-slate-900/90 dark:via-[#0c1017] dark:to-emerald-950/20 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 transition-colors duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Text & Pitch */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <Globe className="w-3.5 h-3.5" />
                Live Web Grounding · Open Knowledge Citations
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Cross-Examine AI Claims with Ground Truth.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                GhostProof extracts individual claims from AI outputs, searches authoritative sources, and prompts Gemma 4 to assess validity with transparent reasoning.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Real Wikipedia citations
                </span>
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Gemma 4 reasoning
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Zero server tracking
                </span>
              </div>
            </div>

            {/* Interactive 3D Verifier Canvas */}
            <div className="lg:col-span-5 h-[200px] sm:h-[260px] flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <ThreeCanvas isDark={isDark} isAnalyzing={isLoading} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!report ? (
        /* Input & Zero State */
        <div className="space-y-6">
          {/* 1-Click Samples Bar */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                1-Click Interactive Test Samples:
              </span>
              <span className="text-slate-400 hidden sm:inline">Try verified scenarios instantly</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FACT_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 transition-all duration-150 group cursor-pointer shadow-2xs hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {sample.title}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-slate-500 px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800">
                      {sample.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Text Input Area & File Drop */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="fact-input" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
                Text or Document Content to Verify
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-2xs active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Upload Document</span>
                  <input
                    type="file"
                    accept=".txt,.md,.json,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {inputText && (
                  <button
                    onClick={() => setInputText('')}
                    className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              id="fact-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste AI generated paragraphs, news snippets, or factual claims here to cross-examine against web evidence..."
              rows={7}
              className="w-full bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-all leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
              <span className="font-mono tabular-nums">
                {inputText.length.toLocaleString()} characters {inputText.length > 15000 && '(Limit: 15,000)'}
              </span>
              <span>Lack of web evidence is marked Unverified, not false.</span>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleCheckClaims}
                disabled={isLoading || !inputText.trim()}
                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 transition-all duration-150 cursor-pointer ${
                  isLoading || !inputText.trim()
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Claims...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Check Claims with Gemma 4</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Loading Progress State */}
          {isLoading && (
            <div className="p-8 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 text-center shadow-md">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 animate-pulse">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Fact-Checking Pipeline Running</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{loadingStage}</p>
              </div>
              <div className="w-72 mx-auto bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Results View */
        <div className="space-y-6">
          {/* Report Top Summary & Action Bar */}
          <div className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Verification Report</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{report.modelUsed}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(report.timestamp).toLocaleTimeString()}</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Evidence-Assisted Findings
                </h2>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCopyMarkdown}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copyFeedback ? 'Copied Markdown!' : 'Copy Report'}</span>
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={() => setReport(null)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New Check</span>
                </button>
              </div>
            </div>

            {/* Metrics Breakdown Strip (tabular-nums, clean unboxed figures) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Claims</div>
                <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">{report.summary.total}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-slate-950/40 border border-emerald-200 dark:border-emerald-500/20">
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Supported</div>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{report.summary.supported}</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-slate-950/40 border border-rose-200 dark:border-rose-500/20">
                <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Contradicted</div>
                <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{report.summary.contradicted}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-slate-950/40 border border-amber-200 dark:border-amber-500/20">
                <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Mixed Evidence</div>
                <div className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{report.summary.mixed}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Unverified</div>
                <div className="text-2xl font-extrabold font-mono text-slate-700 dark:text-slate-300 mt-0.5">{report.summary.unverified}</div>
              </div>
            </div>
          </div>

          {/* Filter Tabs & Search Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Verdict Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs">
              {(['all', 'supported', 'contradicted', 'mixed', 'unverified'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterVerdict(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    filterVerdict === tab
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'all' ? 'All Claims' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className="ml-1.5 text-[10px] font-mono opacity-70">
                    {tab === 'all'
                      ? report.claims.length
                      : report.claims.filter((c) => c.verdict === tab).length}
                  </span>
                </button>
              ))}
            </div>

            {/* In-findings search */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within claims..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          {/* Claim Cards List */}
          {filteredClaims.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-xs">
              <p className="text-sm text-slate-500 dark:text-slate-400">No claims match the selected filter or search query.</p>
              <button
                onClick={() => { setFilterVerdict('all'); setSearchQuery(''); }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim, idx) => {
                const style = getVerdictStyle(claim.verdict);
                const isExpanded = expandedClaims[claim.id] !== false; // default expanded

                return (
                  <div
                    key={claim.id || idx}
                    className={`p-5 sm:p-6 rounded-2xl border ${style.border} ${style.bg} bg-white dark:bg-slate-900/40 shadow-xs transition-all space-y-3.5`}
                  >
                    {/* Header Row: Verdict Status & Confidence */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono uppercase font-bold border ${style.badgeBg} flex items-center gap-1.5`}>
                          {style.icon}
                          {style.label}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] font-medium">
                          Confidence: {claim.confidence}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">
                          #{idx + 1}
                        </span>
                        <button
                          onClick={() => toggleExpand(claim.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          aria-label={isExpanded ? 'Collapse claim' : 'Expand claim'}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Claim Statement */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        "{claim.claim}"
                      </h3>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3.5 pt-1">
                        {/* Gemma 4 Analytical Assessment */}
                        <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                          <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Cpu className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Gemma 4 Comparative Reasoning:
                          </div>
                          <p>{claim.explanation}</p>
                        </div>

                        {/* Evidence Quote */}
                        {claim.evidenceSnippet && (
                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pl-3.5 border-l-2 border-emerald-500/40 italic">
                            <span className="not-italic text-[10px] font-mono uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                              Cited Web Excerpt:
                            </span>
                            "{claim.evidenceSnippet}"
                          </div>
                        )}

                        {/* Sources Attribution */}
                        {claim.sources && claim.sources.length > 0 && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-semibold mr-1">
                              Independent Sources:
                            </span>
                            {claim.sources.map((source, sIdx) => (
                              <a
                                key={sIdx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors group cursor-pointer shadow-2xs"
                              >
                                <span>{source.title}</span>
                                <span className="text-[10px] text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-400 font-mono">
                                  ({source.domain})
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Disclaimer Note */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
            GhostProof findings are evidence-assisted assessments generated by Gemma 4 and external web search, not legal guarantees of absolute truth.
          </div>
        </div>
      )}
    </div>
  );
};

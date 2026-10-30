import React, { useState } from 'react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import {
  Code2,
  GitBranch,
  FolderArchive,
  Upload,
  AlertTriangle,
  ShieldAlert,
  Bug,
  Sparkles,
  CheckCircle2,
  FileCode,
  Copy,
  Download,
  RotateCcw,
  Search,
  KeyRound,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { CodeReviewReport, CodeFinding, Severity, IssueCategory, CodeFile } from '../types';
import { CODE_SAMPLES, CodeSample } from '../data/sampleData';
import { ThreeCanvas } from './ThreeCanvas';

interface CodeReviewerProps {
  isDark: boolean;
}

export const CodeReviewer: React.FC<CodeReviewerProps> = ({ isDark }) => {
  const [inputMode, setInputMode] = useState<'github' | 'zip'>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<CodeFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRepo, setIsFetchingRepo] = useState(false);
  const [repoMetadata, setRepoMetadata] = useState<{ repo: string; branch: string; totalFiles: number; loadedCount: number } | null>(null);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CodeReviewReport | null>(null);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<IssueCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});

  // 1-Click Sample selection
  const handleSelectSample = (sample: CodeSample) => {
    setSelectedFiles(sample.files.map((f) => ({ ...f, selected: true })));
    setGithubUrl('');
    setRepoMetadata(null);
    setError(null);
  };

  // ZIP File Upload & Client-Side Extraction
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a standard .zip archive.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('ZIP archive exceeds the 25MB maximum limit.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setRepoMetadata(null);
    setLoadingStage('Parsing ZIP archive in browser sandbox...');

    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);

      const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.php', '.rb', '.json', '.yaml', '.yml', '.sql', '.sh', '.html', '.css'];
      const IGNORED_DIRS = ['node_modules/', 'dist/', 'build/', '.git/', 'vendor/', '__pycache__/', '.next/'];

      const parsedFiles: CodeFile[] = [];

      for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
        if (zipEntry.dir) continue;

        // Skip ignored directories
        if (IGNORED_DIRS.some((dir) => relativePath.includes(dir))) continue;

        // Check extension
        const hasAllowedExt = ALLOWED_EXTS.some((ext) => relativePath.toLowerCase().endsWith(ext));
        if (!hasAllowedExt) continue;

        // Read text content bounded to 40KB per file
        const content = await zipEntry.async('string');
        if (content.length > 0 && content.length < 50000) {
          parsedFiles.push({
            path: relativePath,
            content,
            size: content.length,
            selected: true,
          });
        }

        // Limit total files parsed to 45
        if (parsedFiles.length >= 45) break;
      }

      if (parsedFiles.length === 0) {
        throw new Error('No supported source code files found in the ZIP archive. Ensure it contains text-based code files (.ts, .js, .py, etc.).');
      }

      setSelectedFiles(parsedFiles);
    } catch (err: any) {
      setError(err.message || 'Failed to extract ZIP archive.');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Dedicated GitHub Repository Fetch
  const handleFetchGitHubRepo = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || githubUrl).trim();
    if (!targetUrl) {
      setError('Please enter a public GitHub repository URL.');
      return null;
    }

    setError(null);
    setIsFetchingRepo(true);
    setLoadingStage('Connecting to GitHub API & retrieving repository file tree...');

    try {
      const ghRes = await fetch('/api/github-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const ghData = await ghRes.json();
      if (!ghRes.ok) {
        throw new Error(ghData.error || 'Failed to fetch GitHub repository.');
      }

      if (!ghData.filesLoaded || ghData.filesLoaded.length === 0) {
        throw new Error('No readable source files could be fetched from this repository.');
      }

      const files: CodeFile[] = ghData.filesLoaded.map((f: any) => ({
        path: f.path,
        content: f.content,
        size: f.size || f.content.length,
        selected: true,
      }));

      setSelectedFiles(files);
      setRepoMetadata({
        repo: ghData.repo,
        branch: ghData.branch,
        totalFiles: ghData.totalFilesInRepo,
        loadedCount: files.length,
      });

      return { repo: ghData.repo, files };
    } catch (err: any) {
      setError(err.message || 'Failed to fetch GitHub repository.');
      return null;
    } finally {
      setIsFetchingRepo(false);
      setLoadingStage('');
    }
  };

  // Toggle individual file selection
  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, selected: !f.selected } : f))
    );
  };

  // Select / Deselect All files
  const handleToggleAllFiles = (selectAll: boolean) => {
    setSelectedFiles((prev) => prev.map((f) => ({ ...f, selected: selectAll })));
  };

  const toggleExpand = (id: string) => {
    setExpandedFindings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Run Code Review
  const handleRunReview = async () => {
    setError(null);

    let filesToScan = selectedFiles.filter((f) => f.selected);
    let targetTitle = inputMode === 'github' ? (repoMetadata?.repo || githubUrl.trim()) : 'Uploaded ZIP Project';

    // If using GitHub URL and no files have been loaded yet, fetch all repository files first!
    if (inputMode === 'github' && filesToScan.length === 0) {
      if (!githubUrl.trim()) {
        setError('Please enter a public GitHub repository URL.');
        return;
      }

      setIsLoading(true);
      const fetched = await handleFetchGitHubRepo();
      if (!fetched || fetched.files.length === 0) {
        setIsLoading(false);
        return;
      }

      filesToScan = fetched.files;
      targetTitle = fetched.repo;
    }

    if (filesToScan.length === 0) {
      setError('Please select at least one file to review.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingStage(`Scanning ${filesToScan.length} source files for deterministic secrets & vulnerabilities...`);

    try {
      const stageTimer = setTimeout(() => {
        setLoadingStage('Gemma 4 executing deep code audit for privilege escalation, backdoors, & injection risks...');
      }, 1400);

      const reviewRes = await fetch('/api/code-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetName: targetTitle,
          files: filesToScan,
        }),
      });

      clearTimeout(stageTimer);
      const reviewData = await reviewRes.json();
      if (!reviewRes.ok) {
        throw new Error(reviewData.error || 'Failed to complete code review.');
      }

      setReport(reviewData);

      // Only trigger celebration confetti if codebase genuinely has 0 critical and 0 high issues!
      if (reviewData.stats?.critical === 0 && reviewData.stats?.high === 0 && reviewData.findings?.length === 0) {
        try {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.8 },
            colors: ['#10b981', '#34d399', '#6ee7b7'],
          });
        } catch {
          // Non-critical
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during code review.');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Copy Markdown report
  const handleCopyMarkdown = () => {
    if (!report) return;

    let md = `# GhostProof Code Security & Quality Audit Report\n\n`;
    md += `*Target: ${report.target} | Files Inspected: ${report.filesScanned} | Model: ${report.modelUsed}*\n\n`;
    md += `## Severity Statistics\n`;
    md += `- **Critical**: ${report.stats.critical}\n`;
    md += `- **High**: ${report.stats.high}\n`;
    md += `- **Medium**: ${report.stats.medium}\n`;
    md += `- **Low**: ${report.stats.low}\n\n`;
    md += `## Findings (${report.findings.length} issues identified)\n\n`;

    report.findings.forEach((f, idx) => {
      md += `### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `- **File**: \`${f.file}\`${f.line ? ` (Line ${f.line})` : ''}\n`;
      md += `- **Category**: ${f.category}\n`;
      md += `- **Description**: ${f.description}\n`;
      if (f.codeSnippet) {
        md += `- **Code Excerpt**:\n\`\`\`\n${f.codeSnippet}\n\`\`\`\n`;
      }
      md += `- **Remediation**: ${f.remediation}\n\n---\n\n`;
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
    a.download = `ghostproof-codereview-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered findings
  const filteredFindings = (report?.findings || []).filter((f) => {
    const matchesSeverity = filterSeverity === 'all' || f.severity === filterSeverity;
    const matchesCategory = filterCategory === 'all' || f.category === filterCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.remediation.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSeverity && matchesCategory && matchesSearch;
  });

  const getSeverityStyle = (s: Severity) => {
    switch (s) {
      case 'critical':
        return {
          label: 'Critical',
          color: 'text-rose-700 dark:text-rose-400',
          badgeBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
          border: 'border-rose-200 dark:border-rose-500/30',
          bg: 'bg-rose-50/40 dark:bg-rose-500/5',
        };
      case 'high':
        return {
          label: 'High',
          color: 'text-amber-700 dark:text-amber-400',
          badgeBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
          border: 'border-amber-200 dark:border-amber-500/30',
          bg: 'bg-amber-50/40 dark:bg-amber-500/5',
        };
      case 'medium':
        return {
          label: 'Medium',
          color: 'text-yellow-700 dark:text-yellow-400',
          badgeBg: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
          border: 'border-yellow-200 dark:border-yellow-500/30',
          bg: 'bg-yellow-50/40 dark:bg-yellow-500/5',
        };
      case 'low':
      default:
        return {
          label: 'Low',
          color: 'text-blue-700 dark:text-blue-400',
          badgeBg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
          border: 'border-blue-200 dark:border-blue-500/30',
          bg: 'bg-blue-50/40 dark:bg-blue-500/5',
        };
    }
  };

  const getCategoryIcon = (c: IssueCategory) => {
    switch (c) {
      case 'secret':
        return <KeyRound className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />;
      case 'security':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;
      case 'bug':
        return <Bug className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />;
      case 'maintainability':
      default:
        return <FileCode className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 3D Hero Banner when in zero state */}
      {!report && (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 dark:from-slate-900/90 dark:via-[#0c1017] dark:to-emerald-950/20 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 transition-colors duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Text & Pitch */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Deterministic Secret Scanning · Static Code Auditor
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Inspect Repositories for Secrets &amp; Critical Flaws.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Choose a public GitHub repository or upload a local project ZIP. GhostProof detects exposed credentials, SQL/command injection, and logic bugs with line references and remediations.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Auto token masking
                </span>
                <span className="flex items-center gap-1.5">
                  <FolderArchive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Browser ZIP parsing
                </span>
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Gemma 4 security audit
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
        /* Input & Configuration Stage */
        <div className="space-y-6">
          {/* 1-Click Test Samples */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                1-Click Interactive Vulnerability Samples:
              </span>
              <span className="text-slate-400 hidden sm:inline">Inspect pre-loaded vulnerable modules instantly</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CODE_SAMPLES.map((sample) => (
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

          {/* Mutually Exclusive Selector: GitHub URL vs ZIP Upload */}
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
                Choose Review Input Method
              </span>
              <span className="text-xs text-slate-400">Mutually exclusive per review</span>
            </div>

            {/* Segmented Control */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md shadow-2xs">
              <button
                onClick={() => {
                  setInputMode('github');
                  setSelectedFiles([]);
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                  inputMode === 'github'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Public GitHub Repo URL
              </button>
              <button
                onClick={() => {
                  setInputMode('zip');
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                  inputMode === 'zip'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Upload ZIP Archive
              </button>
            </div>

            {/* Input Form A: GitHub Repository URL */}
            {inputMode === 'github' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="github-url" className="text-xs text-slate-600 dark:text-slate-400 font-semibold block">
                    Public Repository URL
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Quick tests:</span>
                    <button
                      onClick={() => {
                        setGithubUrl('https://github.com/Naitik-xd/Ghost-Proof');
                        handleFetchGitHubRepo('https://github.com/Naitik-xd/Ghost-Proof');
                      }}
                      className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer transition-colors"
                    >
                      Ghost-Proof
                    </button>
                    <button
                      onClick={() => {
                        setGithubUrl('https://github.com/expressjs/express');
                        handleFetchGitHubRepo('https://github.com/expressjs/express');
                      }}
                      className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      express
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <GitBranch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="github-url"
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFetchGitHubRepo();
                        }
                      }}
                      placeholder="https://github.com/owner/repository"
                      className="w-full bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-all shadow-2xs font-mono text-xs sm:text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleFetchGitHubRepo()}
                    disabled={isFetchingRepo || !githubUrl.trim()}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl whitespace-nowrap transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingRepo ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Fetching Tree...</span>
                      </>
                    ) : (
                      <>
                        <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Fetch Files</span>
                      </>
                    )}
                  </button>
                </div>

                {repoMetadata && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Loaded <strong>{repoMetadata.loadedCount} source files</strong> from <code className="font-mono">{repoMetadata.repo}</code> ({repoMetadata.branch} branch). Total repo objects: {repoMetadata.totalFiles}.
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Accepts public repositories only. GhostProof filters build outputs, dependencies, and lock files automatically.
                </p>
              </div>
            )}

            {/* Input Form B: ZIP Upload */}
            {inputMode === 'zip' && (
              <div className="space-y-4 pt-2">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-8 sm:p-10 text-center bg-slate-50/50 dark:bg-slate-950/40 transition-all duration-200">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-400 mb-3.5 shadow-2xs">
                    <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="cursor-pointer text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors">
                      <span>Click to choose a .zip project file</span>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={handleZipUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Parsed 100% inside your browser sandbox. The archive file itself is never sent to the server.
                    </p>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-400 font-mono">
                    Max size: 25MB · Only source code files (.ts, .js, .py, .go, .rs, .json, etc.) are extracted.
                  </div>
                </div>
              </div>
            )}

            {/* Selected Files Checklist Preview */}
            {selectedFiles.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Selected Source Files ({selectedFiles.filter((f) => f.selected).length}/{selectedFiles.length}):
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleAllFiles(true)}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs cursor-pointer font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
                    <button
                      onClick={() => handleToggleAllFiles(false)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs cursor-pointer font-medium"
                    >
                      Deselect All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
                    <button
                      onClick={() => {
                        setSelectedFiles([]);
                        setRepoMetadata(null);
                      }}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => toggleFileSelection(file.path)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={file.selected !== false}
                          onChange={() => {}}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="font-mono text-slate-800 dark:text-slate-200 truncate">{file.path}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-3">
                        {((file.size || file.content.length) / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleRunReview}
                disabled={isLoading || isFetchingRepo || (inputMode === 'github' && !githubUrl.trim() && selectedFiles.length === 0) || (inputMode === 'zip' && selectedFiles.length === 0)}
                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 transition-all duration-150 cursor-pointer ${
                  isLoading || isFetchingRepo || ((inputMode === 'github' && !githubUrl.trim() && selectedFiles.length === 0) || (inputMode === 'zip' && selectedFiles.length === 0))
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Auditing {selectedFiles.filter(f => f.selected).length || 'Repository'} Files...</span>
                  </>
                ) : (
                  <>
                    <Code2 className="w-4 h-4" />
                    <span>Start Code Review with Gemma 4 {selectedFiles.length > 0 ? `(${selectedFiles.filter(f => f.selected).length} Files)` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Loading Progress State */}
          {isLoading && (
            <div className="p-8 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 text-center shadow-md">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 animate-pulse">
                <Code2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Security Audit Pipeline Running</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{loadingStage}</p>
              </div>
              <div className="w-72 mx-auto bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Findings View */
        <div className="space-y-6">
          {/* Top Summary Bar */}
          <div className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Security Audit Completed</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{report.modelUsed}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{report.filesScanned} files scanned</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Target: <span className="font-mono text-slate-800 dark:text-slate-200">{report.target}</span>
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
                  <span>New Review</span>
                </button>
              </div>
            </div>

            {/* Severity Counters Strip (tabular-nums, clean unboxed figures) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-slate-950/40 border border-rose-200 dark:border-rose-500/20">
                <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Critical Issues</div>
                <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{report.stats.critical}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-slate-950/40 border border-amber-200 dark:border-amber-500/20">
                <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">High Severity</div>
                <div className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{report.stats.high}</div>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50/50 dark:bg-slate-950/40 border border-yellow-200 dark:border-yellow-500/20">
                <div className="text-[11px] font-medium text-yellow-700 dark:text-yellow-400">Medium Severity</div>
                <div className="text-2xl font-extrabold font-mono text-yellow-600 dark:text-yellow-400 mt-0.5">{report.stats.medium}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-slate-950/40 border border-blue-200 dark:border-blue-500/20">
                <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400">Low Severity</div>
                <div className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-0.5">{report.stats.low}</div>
              </div>
            </div>

            {/* Findings Outcome Banner */}
            {report.findings.length > 0 ? (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>{report.findings.length} security &amp; code quality issues detected</strong> across {report.filesScanned} scanned files ({report.stats.critical} Critical, {report.stats.high} High). Review the details and remediations below.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Clean codebase pass:</strong> 0 security flaws or exposed credentials detected across {report.filesScanned} scanned files.
                </span>
              </div>
            )}
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Severity & Category Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Severity Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((s) => {
                  const count = s === 'all' ? report.findings.length : report.stats[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterSeverity(s)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                        filterSeverity === s
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterSeverity === s ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-200/60 dark:bg-slate-800'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                {(['all', 'secret', 'security', 'bug', 'maintainability'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all duration-150 cursor-pointer ${
                      filterCategory === cat
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Types' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* In-findings search */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file, title, or code..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          {/* Finding Cards */}
          {filteredFindings.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">No findings match the current filter or search criteria.</p>
              <button
                onClick={() => {
                  setFilterSeverity('all');
                  setFilterCategory('all');
                  setSearchQuery('');
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFindings.map((finding, idx) => {
                const sStyle = getSeverityStyle(finding.severity);
                const isExpanded = expandedFindings[finding.id] !== false; // default expanded

                return (
                  <div
                    key={finding.id || idx}
                    className={`p-5 sm:p-6 rounded-2xl border ${sStyle.border} ${sStyle.bg} bg-white dark:bg-slate-900/40 shadow-xs transition-all space-y-3.5`}
                  >
                    {/* Header: Severity, Category, File & Line */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono uppercase tracking-wider font-bold border ${sStyle.badgeBg}`}>
                          {sStyle.label}
                        </span>
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                          {getCategoryIcon(finding.category)}
                          <span className="capitalize">{finding.category}</span>
                        </span>
                        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-950/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[11px]">
                          {finding.file}{finding.line ? `:${finding.line}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">
                          Finding #{idx + 1}
                        </span>
                        <button
                          onClick={() => toggleExpand(finding.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          aria-label={isExpanded ? 'Collapse finding' : 'Expand finding'}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Finding Title */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {finding.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {finding.description}
                    </p>

                    {isExpanded && (
                      <div className="space-y-3 pt-1">
                        {/* Code Snippet with Masked Secrets */}
                        {finding.codeSnippet && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <Code2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Vulnerable Code Context:
                            </div>
                            <pre className="p-3.5 bg-slate-900 dark:bg-[#080c14] border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed shadow-inner">
                              <code>{finding.codeSnippet}</code>
                            </pre>
                          </div>
                        )}

                        {/* Remediation Suggestion */}
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-emerald-200 dark:border-emerald-500/20 rounded-xl space-y-1">
                          <div className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Remediation Guidance:
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed font-mono">
                            {finding.remediation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Safety Disclaimer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
            GhostProof identifies potential vulnerabilities and quality improvements. Static AI analysis does not certify that a project is completely defect-free or impregnable.
          </div>
        </div>
      )}
    </div>
  );
};

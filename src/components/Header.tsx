import React from 'react';
import { ShieldCheck, FileCheck, Code2, Info, Github, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  activeTab: 'fact-checker' | 'code-reviewer' | 'about';
  setActiveTab: (tab: 'fact-checker' | 'code-reviewer' | 'about') => void;
  isDark: boolean;
  setIsDark: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isDark, setIsDark }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0c1017]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-6 py-3.5 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Wordmark */}
        <div
          onClick={() => setActiveTab('fact-checker')}
          className="flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0 group select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 group-hover:border-emerald-500/40 transition-all duration-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              GhostProof
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400/90 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                Gemma 4
              </span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            onClick={() => setActiveTab('fact-checker')}
            className={`flex items-center gap-2 py-1 transition-all duration-150 whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'fact-checker'
                ? 'border-emerald-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            AI Fact Checker
          </button>
          <button
            onClick={() => setActiveTab('code-reviewer')}
            className={`flex items-center gap-2 py-1 transition-all duration-150 whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'code-reviewer'
                ? 'border-emerald-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            AI Code Reviewer
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 py-1 transition-all duration-150 whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'about'
                ? 'border-emerald-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            About &amp; Disclosures
          </button>
        </nav>

        {/* Zone 3: Actions (Theme Toggle + GitHub) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Light / Dark Mode Toggler */}
          <button
            onClick={() => setIsDark((prev) => !prev)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-200 active:scale-95 cursor-pointer shadow-xs"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
            )}
          </button>

          {/* GitHub Open Source Link */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer shadow-xs active:scale-95"
            title="Open Source Hacktoberfest Project"
          >
            <Github className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Hacktoberfest</span>
          </a>
        </div>
      </div>
    </header>
  );
};

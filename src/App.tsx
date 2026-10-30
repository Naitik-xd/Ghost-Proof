/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FactChecker } from './components/FactChecker';
import { CodeReviewer } from './components/CodeReviewer';
import { AboutView } from './components/AboutView';
import { FileCheck, Code2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'fact-checker' | 'code-reviewer' | 'about'>('fact-checker');

  // Dark / Light mode state with localStorage persistence
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('ghostproof-theme');
    if (saved) return saved === 'dark';
    return true; // Default to sleek dark mode
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ghostproof-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ghostproof-theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c1017] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300 transition-colors duration-200">
      {/* Top Bar Contract Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        setIsDark={setIsDark}
      />

      {/* Main Viewport Content */}
      <main className="flex-1">
        {/* Editorial Sub-Header / Tool Selector Cards on Zero-State */}
        {activeTab !== 'about' && (
          <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/40 py-3.5 px-6 transition-colors duration-200 backdrop-blur-xs">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Tool:
                </span>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                  <button
                    onClick={() => setActiveTab('fact-checker')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                      activeTab === 'fact-checker'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    AI Fact Checker
                  </button>
                  <button
                    onClick={() => setActiveTab('code-reviewer')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                      activeTab === 'code-reviewer'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    AI Code Reviewer
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Priority: <strong className="text-slate-800 dark:text-slate-200 font-mono">Gemma 4</strong> <span className="text-[11px] text-slate-400">(Fallback: Gemini Flash)</span></span>
              </div>
            </div>
          </div>
        )}

        {/* View Routing */}
        {activeTab === 'fact-checker' && <FactChecker isDark={isDark} />}
        {activeTab === 'code-reviewer' && <CodeReviewer isDark={isDark} />}
        {activeTab === 'about' && <AboutView isDark={isDark} />}
      </main>

      {/* Quiet Technical Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/60 py-6 px-6 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-300">GhostProof</span>
            <span aria-hidden="true">·</span>
            <span>Hacktoberfest 2026 Open-Source AI Challenge</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">Gemma 4</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <button
              onClick={() => setActiveTab('fact-checker')}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Fact Checker
            </button>
            <button
              onClick={() => setActiveTab('code-reviewer')}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Code Reviewer
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              About &amp; Privacy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

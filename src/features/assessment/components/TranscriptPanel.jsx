import React, { useState } from 'react';
import { flagTranscript } from '../assessmentStore.js';

export default function TranscriptPanel({ clientId, sectionKey, section, setClients }) {
  const [copied, setCopied] = useState(false);

  if (!section?.transcript) return null;

  const isFlagged = !!section.transcriptFlagged;

  const handleFlag = () =>
    flagTranscript(setClients, clientId, sectionKey, !isFlagged);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(section.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden mb-3"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Flagged banner */}
      {isFlagged && (
        <div className="flex items-center gap-2 px-3 py-2"
          style={{
            background: 'rgba(251,191,36,0.10)',
            borderBottom: '1px solid rgba(251,191,36,0.30)',
          }}>
          <span className="text-sm">🚩</span>
          <p className="text-[11px] font-semibold" style={{ color: '#92400E' }}>
            FLAGGED — AI will prioritise your manual notes
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Transcript
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
          {section.transcript}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-stone-100">
        <button
          onClick={handleFlag}
          title="AI will prioritise your manual notes over this recording"
          className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2.5 py-1.5 transition-all ${
            isFlagged
              ? 'text-amber-700 bg-amber-50 border border-amber-200'
              : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent'
          }`}>
          <span>🚩</span>
          {isFlagged ? 'Unflag' : 'Flag transcript'}
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-700 rounded-lg px-2.5 py-1.5 hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all">
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              ✓ Copied
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              Copy transcript
            </>
          )}
        </button>
      </div>
    </div>
  );
}

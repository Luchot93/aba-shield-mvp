import React from 'react';
import { Ico } from '../../../components/icons.jsx';
import { SECTION_ORDER, SECTION_TITLES } from '../sectionConfig.js';

const DOT_COLORS = {
  empty:    'bg-white border-2 border-slate-300',
  partial:  'bg-amber-400 border-2 border-amber-400',
  complete: 'bg-emerald-500 border-2 border-emerald-500',
};

export default function SectionSidebar({ session, activeSection, onSelectSection }) {
  if (!session) return null;

  const sections = session.sections;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Segmented progress bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="flex gap-[3px]">
          {SECTION_ORDER.map((key) => {
            const state = sections[key]?.completionState ?? 'empty';
            const done  = state !== 'empty';
            return (
              <div
                key={key}
                className="flex-1 rounded-full transition-all duration-500"
                style={{ height: 4, background: done ? '#14B8A6' : '#E7E5E4' }}
              />
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-slate-400 text-right"
          style={{ fontFamily: 'DM Mono, monospace' }}>
          {SECTION_ORDER.filter(k => sections[k]?.completionState !== 'empty').length}/{SECTION_ORDER.length} sections
        </p>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto pb-2">
        {SECTION_ORDER.map((key, idx) => {
          const section = sections[key];
          const isActive = key === activeSection;
          const completionState = section?.completionState ?? 'empty';
          const hasTranscript = !!section?.transcript;
          const hasNotes = !!(section?.notes?.trim());

          return (
            <button
              key={key}
              onClick={() => onSelectSection(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-100 ${
                isActive
                  ? 'bg-teal-50 border-l-2 border-teal-500 text-teal-700 font-medium'
                  : 'border-l-2 border-transparent text-slate-600 hover:bg-stone-50 hover:text-slate-800'
              }`}>

              {/* Completion dot */}
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[completionState] ?? DOT_COLORS.empty}`}/>

              {/* Index */}
              <span className="text-[10px] text-slate-400 flex-shrink-0 w-4 tabular-nums">
                {idx + 1}
              </span>

              {/* Title */}
              <span className="flex-1 text-xs leading-tight truncate">
                {SECTION_TITLES[key]}
              </span>

              {/* Indicators */}
              <span className="flex items-center gap-1 flex-shrink-0">
                {hasTranscript && (
                  <span className="text-teal-500"><Ico.Mic /></span>
                )}
                {hasNotes && (
                  <span className="text-slate-400"><Ico.PenLine /></span>
                )}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}

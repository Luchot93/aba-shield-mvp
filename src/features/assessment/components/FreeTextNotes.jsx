import React, { useState } from 'react';
import { useAutoSave } from '../../../hooks/useAutoSave.js';
import { updateSectionNotes } from '../assessmentStore.js';

export default function FreeTextNotes({ clientId, sectionKey, section, setClients }) {
  const [value, setValue] = useState(section?.notes ?? '');
  const hasTranscript = section?.transcript != null;

  const { saveState } = useAutoSave(
    value,
    (v) => updateSectionNotes(setClients, clientId, sectionKey, v),
    800,
  );

  const handleChange = (e) => setValue(e.target.value);

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Notes label + save state */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
          Clinical Notes
        </label>
        <span className={`text-[10px] transition-opacity duration-300 ${
          saveState === 'idle' ? 'opacity-0' : 'opacity-100'
        } ${saveState === 'saved' ? 'text-teal-600' : 'text-slate-400'}`}
          style={{ fontFamily: 'DM Mono, monospace' }}>
          {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? '✓ Saved' : ''}
        </span>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        placeholder="Add clinical notes for this section…"
        rows={4}
        className="w-full px-3 py-2.5 text-[13px] text-slate-700 bg-stone-50 border border-stone-200 rounded-xl outline-none
          focus:border-teal-400 focus:ring-1 focus:ring-teal-100
          placeholder:text-slate-400 resize-y leading-relaxed"
        style={{
          minHeight: '6rem',
          fontFamily: 'DM Sans, sans-serif',
        }}
      />

      {/* AI source indicator — always visible so clinician knows notes feed the draft */}
      <div className="flex items-center gap-1.5 mt-2">
        {hasTranscript ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(20,184,166,0.10)', color: '#0D9488', border: '1px solid rgba(20,184,166,0.25)' }}>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Transcript + notes → AI draft
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(148,163,184,0.10)', color: '#64748B', border: '1px solid rgba(148,163,184,0.20)' }}>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Notes → AI draft
          </span>
        )}
      </div>
    </div>
  );
}

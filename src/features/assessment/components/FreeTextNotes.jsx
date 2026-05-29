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
      {/* Recording captured pill */}
      {hasTranscript && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2 text-[11px] font-semibold"
          style={{
            background: 'rgba(20,184,166,0.10)',
            color: '#0D9488',
            border: '1px solid rgba(20,184,166,0.25)',
          }}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
          </svg>
          Recording captured — AI will use both
        </div>
      )}

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
    </div>
  );
}

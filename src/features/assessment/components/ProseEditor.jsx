import React, { useState } from 'react';
import { useAutoSave } from '../../../hooks/useAutoSave.js';

export default function ProseEditor({ content, onChange, onClose, saveState: externalSaveState }) {
  const [value, setValue] = useState(content ?? '');

  const { saveState } = useAutoSave(value, onChange, 800);
  const effective = externalSaveState ?? saveState;

  const handleChange = (e) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <textarea
        autoFocus
        value={value}
        onChange={handleChange}
        className="w-full px-4 py-3 text-[14px] leading-relaxed text-slate-800 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 resize-y"
        style={{
          minHeight: 220,
          fontFamily: 'Georgia, "Times New Roman", serif',
          lineHeight: 1.75,
        }}
      />

      <div className="flex items-center justify-between">
        {/* Save state indicator */}
        <span className={`text-[11px] transition-opacity duration-300 ${
          effective === 'idle' ? 'opacity-0' : 'opacity-100'
        } ${effective === 'saved' ? 'text-teal-600' : 'text-slate-400'}`}
          style={{ fontFamily: 'DM Mono, monospace' }}>
          {effective === 'saving' ? 'saving…' : effective === 'saved' ? '✓ Saved' : ''}
        </span>

        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#0D9488' }}>
          Save &amp; Close
        </button>
      </div>
    </div>
  );
}

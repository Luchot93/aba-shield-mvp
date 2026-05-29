import React from 'react';

export default function RevertConfirm({ onConfirm, onCancel }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
        fontFamily: 'DM Sans, sans-serif',
      }}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#FBBF24" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <span className="text-[12px] flex-1" style={{ color: '#92400E' }}>
        This will discard your edits and restore the original AI draft.
      </span>
      <button
        onClick={onConfirm}
        className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline flex-shrink-0 transition-colors">
        Revert
      </button>
      <button
        onClick={onCancel}
        className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:underline flex-shrink-0 transition-colors">
        Cancel
      </button>
    </div>
  );
}

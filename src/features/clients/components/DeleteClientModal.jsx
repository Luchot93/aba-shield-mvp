import React, { useState } from 'react';
import { Ico } from '../../../components/icons.jsx';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock.js';

const CONFIRM_WORD = 'DELETE';

export default function DeleteClientModal({ client, onConfirm, onCancel }) {
  useBodyScrollLock();
  const [confirmText, setConfirmText] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]      = useState(null);

  const canDelete = confirmText === CONFIRM_WORD && !submitting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError('Failed to delete client. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(15,23,42,0.45)' }}
      onClick={submitting ? undefined : onCancel} data-testid="delete-client-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>

          <h2 className="text-[16px] font-bold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>
            Delete {client.name}?
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            This will permanently delete <span className="font-semibold text-slate-700">{client.name}</span> and
            all associated data — demographics, assessment records, documents, everything.
            {' '}<span className="font-semibold text-red-600">This cannot be undone.</span>
          </p>

          <label className="block mt-5">
            <span className="text-xs font-semibold text-slate-600">
              Type <span className="font-mono text-red-600">{CONFIRM_WORD}</span> to confirm
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setError(null); }}
              placeholder={CONFIRM_WORD}
              disabled={submitting}
              data-testid="delete-confirm-input"
              className="mt-1.5 w-full px-3 py-2 text-sm border border-stone-200 rounded-lg outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-white text-slate-800 disabled:bg-stone-50"
              autoFocus
            />
          </label>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-100" style={{ background:'#FAFAF8' }}>
          <button onClick={onCancel} disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-xl hover:bg-stone-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!canDelete} data-testid="delete-confirm-btn"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background:'#B91C1C' }}>
            {submitting && (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {submitting ? 'Deleting…' : 'Delete Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

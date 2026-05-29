import React, { useState } from 'react';
import { grantConsent } from '../assessmentStore.js';

const CONSENTS = [
  'I have informed the caregiver that this session will be audio recorded.',
  'The caregiver has given verbal consent for recording to be used for clinical documentation.',
  'I understand the recording will be processed by AI and reviewed by a BCBA before any clinical use.',
];

export default function ConsentGate({ clientId, setClients, onClose }) {
  const [checked, setChecked] = useState([false, false, false]);

  const allChecked = checked.every(Boolean);

  const toggle = (i) =>
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));

  const handleConfirm = () => {
    grantConsent(setClients, clientId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.50)' }}>
      <div className="bg-white rounded-2xl p-7 shadow-2xl w-full"
        style={{ maxWidth: '28rem', fontFamily: 'DM Sans, sans-serif' }}>

        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(20,184,166,0.12)' }}>
            <svg className="w-4 h-4" fill="none" stroke="#14B8A6" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">Recording Consent</h2>
        </div>

        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Before recording this session, confirm that consent has been obtained.
        </p>

        <div className="space-y-3 mb-6">
          {CONSENTS.map((text, i) => (
            <label key={i}
              className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                style={{ accentColor: '#14B8A6' }}
              />
              <span className={`text-[13px] leading-snug transition-colors ${
                checked[i] ? 'text-slate-700' : 'text-slate-500'
              }`}>
                {text}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-stone-200 text-slate-600 hover:bg-stone-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allChecked}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: '#0D9488' }}>
            I confirm — Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}

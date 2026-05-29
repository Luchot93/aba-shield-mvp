import React, { useState } from 'react';
import {
  updateIndicatorCount,
  addCustomIndicator,
  removeCustomIndicator,
  resetIndicator,
} from '../assessmentStore.js';

export default function BehavioralIndicators({ clientId, sectionKey, section, setClients }) {
  const [newLabel, setNewLabel]   = useState('');
  const [addingNew, setAddingNew] = useState(false);

  const indicators = section?.indicators ?? [];

  const handleDelta = (id, delta) =>
    updateIndicatorCount(setClients, clientId, sectionKey, id, delta);

  const handleReset = (id) =>
    resetIndicator(setClients, clientId, sectionKey, id);

  const handleRemove = (id) =>
    removeCustomIndicator(setClients, clientId, sectionKey, id);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addCustomIndicator(setClients, clientId, sectionKey, newLabel.trim());
    setNewLabel('');
    setAddingNew(false);
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Antecedent Tracking
        </p>
      </div>

      {/* Indicators grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {indicators.map(ind => (
          <div key={ind.id}
            className="flex flex-col gap-1.5 bg-stone-50 border border-stone-200 rounded-xl p-3">

            <div className="flex items-start justify-between gap-1">
              <span className="text-[11px] font-medium text-slate-700 leading-tight flex-1">
                {ind.label}
              </span>
              {ind.isCustom && (
                <button onClick={() => handleRemove(ind.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-xs">
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Minus */}
              <button
                onClick={() => handleDelta(ind.id, -1)}
                disabled={ind.count === 0}
                className="w-10 h-10 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-lg font-light text-slate-600 hover:border-red-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0">
                −
              </button>

              {/* Count */}
              <span className="flex-1 text-center text-xl font-bold text-slate-800"
                style={{ fontFamily: 'DM Mono, monospace' }}>
                {ind.count}
              </span>

              {/* Plus */}
              <button
                onClick={() => handleDelta(ind.id, +1)}
                className="w-10 h-10 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-lg font-light text-slate-600 hover:border-teal-300 hover:text-teal-600 transition-all flex-shrink-0">
                +
              </button>
            </div>

            {ind.count > 0 && (
              <button onClick={() => handleReset(ind.id)}
                className="text-[9px] font-semibold text-slate-400 hover:text-red-400 transition-colors self-center">
                Reset
              </button>
            )}
          </div>
        ))}

        {/* Add behavior button / input */}
        {addingNew ? (
          <div className="col-span-2 flex items-center gap-2 border border-dashed border-teal-300 rounded-xl p-3 bg-teal-50/40">
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingNew(false); }}
              placeholder="Behavior label…"
              className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
            />
            <button onClick={handleAdd}
              className="text-[11px] font-semibold text-teal-700 hover:text-teal-900">
              Add
            </button>
            <button onClick={() => setAddingNew(false)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="col-span-2 flex items-center gap-2 justify-center border border-dashed border-stone-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all">
            + Add behavior
          </button>
        )}
      </div>
    </div>
  );
}

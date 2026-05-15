import React from 'react';
import { SM } from '../constants/stages.js';

export default function StagePill({ stage }) {
  const m = SM[stage] || SM.intake;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${m.pill}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:m.dot }} />
      {m.label}
    </span>
  );
}

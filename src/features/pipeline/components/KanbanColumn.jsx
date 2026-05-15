import React from 'react';
import { KM } from '../../../constants/stages.js';
import KanbanCard from './KanbanCard.jsx';

export default function KanbanColumn({ stage, clients, staff, onAssignBCBA, onAssignRBT, onSelectClient, newClientId, recentlyMovedId, currentUser }) {
  const highlightId = newClientId || recentlyMovedId;
  const m = KM[stage];
  return (
    <div className="flex flex-col flex-shrink-0" style={{ width:'260px' }}>
      {/* Header */}
      <div className={`${m.hdr} rounded-t-lg px-3 py-2 flex items-center justify-between`}>
        <span className="text-xs font-semibold">{m.label}</span>
        <span className="text-xs font-bold bg-white/60 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {clients.length}
        </span>
      </div>

      {/* Card list */}
      <div className={`flex-1 overflow-y-auto rounded-b-lg ${m.colBg} p-2 space-y-2 border border-t-0 border-stone-200/70`}
           style={{ minHeight:'200px' }}>
        {clients.length === 0 && (
          <div data-testid={`empty-column-${stage}`} className="flex items-center justify-center h-20 text-xs text-slate-400 italic">No clients in this stage</div>
        )}
        {clients.map(c => (
          <div key={c.id} style={c.id === highlightId ? { animation:'fadeIn 0.3s ease' } : undefined}>
            <KanbanCard
              client={c}
              staff={staff}
              onAssignBCBA={onAssignBCBA}
              onAssignRBT={onAssignRBT}
              onSelectClient={onSelectClient}
              isNew={c.id === newClientId}
              currentUser={currentUser}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

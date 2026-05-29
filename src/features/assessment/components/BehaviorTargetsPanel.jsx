import React, { useRef } from 'react';
import { addBehaviorTarget } from '../assessmentStore.js';
import BehaviorTargetCard from './BehaviorTargetCard.jsx';

export default function BehaviorTargetsPanel({ clientId, session, setClients }) {
  const section        = session?.sections?.['behavior_targets'];
  const behaviorTargets = section?.behaviorTargets ?? [];
  const dragIndex      = useRef(null);

  const handleAdd        = () => addBehaviorTarget(setClients, clientId);
  const handleDragStart  = (i) => { dragIndex.current = i; };
  const handleDrop       = (i) => {
    if (dragIndex.current === null || dragIndex.current === i) return;
    // Reorder locally via setClients
    const goals = [...behaviorTargets];
    const [moved] = goals.splice(dragIndex.current, 1);
    goals.splice(i, 0, moved);
    dragIndex.current = null;
    // Persist reorder
    import('../assessmentStore.js').then(({ updateBehaviorTarget: _ }) => {
      // Apply reordered array directly
      setClients(prev => prev.map(c => {
        if (c.id !== clientId) return c;
        const sess = c.assessment_session;
        const sec  = sess.sections['behavior_targets'];
        const updatedSections = { ...sess.sections, behavior_targets: { ...sec, behaviorTargets: goals } };
        return { ...c, assessment_session: { ...sess, sections: updatedSections } };
      }));
    });
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Behavior Targets
          {behaviorTargets.length > 0 && (
            <span className="ml-2" style={{ color: '#F59E0B', fontFamily: 'DM Mono, monospace' }}>
              {behaviorTargets.length}
            </span>
          )}
        </p>
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50/40 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add behavior
        </button>
      </div>

      {/* Cards */}
      {behaviorTargets.length === 0 ? (
        <button onClick={handleAdd}
          className="w-full flex flex-col items-center gap-2 py-8 border-2 border-dashed border-stone-200 rounded-xl text-slate-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/40 transition-all">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          <span className="text-sm font-semibold">Add your first behavior target</span>
          <span className="text-xs">Each target becomes a reduction goal in the treatment plan</span>
        </button>
      ) : (
        <div className="space-y-2">
          {behaviorTargets.map((target, i) => (
            <div key={target.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(i)}>
              <BehaviorTargetCard
                clientId={clientId}
                target={target}
                index={i}
                setClients={setClients}
                onDragStart={() => handleDragStart(i)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

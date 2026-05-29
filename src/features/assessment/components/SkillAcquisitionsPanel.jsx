import React from 'react';
import { addSkillGoal, reorderSkillGoals } from '../assessmentStore.js';
import SkillGoalCard from './SkillGoalCard.jsx';

export default function SkillAcquisitionsPanel({ clientId, session, setClients }) {
  const section   = session?.sections?.['skill_acquisitions'];
  const skillGoals = section?.skillGoals ?? [];

  const handleAdd = () => addSkillGoal(setClients, clientId);

  // Simple drag-reorder via HTML5 drag-and-drop
  const dragIndex = React.useRef(null);

  const handleDragStart = (i) => { dragIndex.current = i; };
  const handleDrop = (i) => {
    if (dragIndex.current === null || dragIndex.current === i) return;
    reorderSkillGoals(setClients, clientId, dragIndex.current, i);
    dragIndex.current = null;
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Skill Goals
          {skillGoals.length > 0 && (
            <span className="ml-2 text-teal-600" style={{ fontFamily: 'DM Mono, monospace' }}>
              {skillGoals.length}
            </span>
          )}
        </p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50/40 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add goal
        </button>
      </div>

      {/* Goal cards */}
      {skillGoals.length === 0 ? (
        <button
          onClick={handleAdd}
          className="w-full flex flex-col items-center gap-2 py-8 border-2 border-dashed border-stone-200 rounded-xl text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/40 transition-all">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          <span className="text-sm font-semibold">Add your first skill goal</span>
          <span className="text-xs">Each goal becomes a treatment objective in the plan</span>
        </button>
      ) : (
        <div className="space-y-2">
          {skillGoals.map((goal, i) => (
            <div
              key={goal.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(i)}>
              <SkillGoalCard
                clientId={clientId}
                goal={goal}
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

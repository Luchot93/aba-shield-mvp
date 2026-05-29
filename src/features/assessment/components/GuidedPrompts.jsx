import React from 'react';
import { getSectionConfig } from '../sectionConfig.js';

export default function GuidedPrompts({ sectionKey }) {
  const config = getSectionConfig(sectionKey);
  if (!config || !config.promptGroups?.length) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 max-h-72 overflow-y-auto mb-3"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
        Guided Prompts
      </p>
      <div className="space-y-3">
        {config.promptGroups.map((group, gi) => (
          <div key={gi}>
            {group.isBcbaOnly ? (
              /* BCBA-only group — amber tint */
              <div className="rounded-md px-2.5 py-2"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.25)',
                }}>
                <p className="text-[9px] font-bold tracking-widest mb-1.5"
                  style={{ color: '#92400E' }}>
                  BCBA CLINICAL NOTES
                </p>
                <ul className="space-y-1">
                  {group.prompts.map((p, pi) => (
                    <li key={pi} className="flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0"
                        style={{ background: '#FBBF24' }}/>
                      <span className="text-[11px] leading-relaxed" style={{ color: '#78350F' }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              /* Standard group */
              <div>
                <p className="text-[10px] font-semibold text-slate-500 mb-1.5">{group.label}</p>
                <ul className="space-y-1">
                  {group.prompts.map((p, pi) => (
                    <li key={pi} className="flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0 bg-slate-300"/>
                      <span className="text-[11px] text-slate-600 leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  updateBehaviorTarget,
  removeBehaviorTarget,
  addBehaviorStoStep,
  updateBehaviorStoStep,
  removeBehaviorStoStep,
} from '../assessmentStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPOGRAPHY_OPTIONS = [
  'Open-hand hitting', 'Biting', 'Kicking', 'Object throwing', 'Scratching',
  'Head banging', 'Self-biting', 'Eye poking', 'Skin picking',
  'Crying/screaming', 'Drop/go limp', 'Verbal refusal', 'Physical resistance',
  'Property destruction', 'Elopement', 'Other',
];

const PRIMARY_TARGETS = ['Self', 'Parent', 'Sibling', 'Peers', 'Staff'];

const FUNCTIONS = ['Escape', 'Attention', 'Access', 'Automatic'];

const MEASUREMENT_SYSTEMS = [
  'Event Recording',
  'Duration Recording',
  'Interval Recording',
  'ABC (Antecedent-Behavior-Consequence)',
];

const INTENSITY_LEVELS = ['Mild', 'Moderate', 'Severe'];

// ─── Behavior name library ────────────────────────────────────────────────────

const BEHAVIOR_LIBRARY = [
  {
    name: 'Physical Aggression',
    operationalDefinition: 'Client makes forceful physical contact with another person. Includes open-hand hitting, closed-fist striking, kicking, biting, scratching, and pinching. Each discrete contact or attempt with clear physical force counts as one instance.',
  },
  {
    name: 'Head Banging (SIB)',
    operationalDefinition: 'Client forcefully contacts head against a hard surface (floor, wall, table, or caregiver body) with sufficient force to produce an audible sound. Each discrete contact counts as one instance.',
  },
  {
    name: 'Tantrum / Drop',
    operationalDefinition: 'Client cries or screams and drops to the floor, refusing to stand or follow direction. Episode begins when client drops to the floor and ends when client stands and resumes movement or task participation independently.',
  },
  {
    name: 'Elopement / Running Away',
    operationalDefinition: 'Client moves more than 10 feet away from the designated area or supervision zone without permission. Episode begins when client crosses the boundary and ends when client returns to or is returned to the designated area.',
  },
  {
    name: 'Biting (SIB)',
    operationalDefinition: 'Client places teeth on their own skin with sufficient pressure to leave a visible mark or indentation. Each discrete bite counts as one instance.',
  },
  {
    name: 'Skin Picking (SIB)',
    operationalDefinition: 'Client uses fingers or fingernails to pick, scratch, or dig at skin on any body part. Episode begins when contact with skin is initiated and ends when hands are removed from the skin surface for more than 5 consecutive seconds.',
  },
  {
    name: 'Eye Poking / Pressing (SIB)',
    operationalDefinition: 'Client inserts a finger or object into the eye socket or presses with force against the eyeball or eyelid. Each discrete contact or pressing episode counts as one instance.',
  },
  {
    name: 'Property Destruction',
    operationalDefinition: 'Client forcefully throws, breaks, tears, or damages objects in the environment. Includes sweeping items off surfaces, tearing materials, or smashing objects. Each discrete destructive act counts as one instance.',
  },
  {
    name: 'Object Throwing',
    operationalDefinition: 'Client throws or launches any object with sufficient force that it travels more than 12 inches from the point of release. Includes throwing toward or away from people. Each thrown object counts as one instance.',
  },
  {
    name: 'Screaming / Vocal Outburst',
    operationalDefinition: 'Client vocalizes at a volume clearly audible from at least 10 feet away in a typical indoor environment, without communicative intent. Episode begins with the onset of elevated vocalization and ends when volume returns to conversational level for more than 5 seconds.',
  },
  {
    name: 'Verbal Aggression',
    operationalDefinition: 'Client makes statements intended to threaten, demean, or intimidate another person (e.g., threats of physical harm, name-calling, explicit insults). Each discrete statement or phrase directed at a person counts as one instance.',
  },
  {
    name: 'Scratching / Clawing (SIB)',
    operationalDefinition: 'Client drags fingernails across own skin with sufficient force to leave a visible mark, redness, or broken skin. Each discrete scratching episode counts as one instance.',
  },
  {
    name: 'Pica',
    operationalDefinition: 'Client places a non-food item in the mouth with the apparent intent to ingest it (chewing or swallowing). Each discrete placement of a non-food item in the mouth counts as one instance.',
  },
  {
    name: 'Mouthing (Non-Nutritive)',
    operationalDefinition: 'Client places non-food objects, clothing, or body parts in the mouth and mouths or chews without apparent intent to ingest. Episode begins when object enters the mouth and ends when removed for more than 5 consecutive seconds.',
  },
  {
    name: 'Spitting',
    operationalDefinition: 'Client expels saliva, food, or liquid from the mouth in a directed manner toward a person or object. Each discrete spitting episode counts as one instance.',
  },
  {
    name: 'Hair Pulling (SIB)',
    operationalDefinition: 'Client grasps and pulls own hair with sufficient force to cause observable tension or hair removal. Each discrete grasping-and-pulling episode counts as one instance.',
  },
  {
    name: 'Face Slapping (SIB)',
    operationalDefinition: 'Client strikes own face (cheek, forehead, or side of head) with an open or closed hand with sufficient force to produce an audible sound. Each discrete contact counts as one instance.',
  },
  {
    name: 'Noncompliance / Task Refusal',
    operationalDefinition: 'Client fails to initiate the requested behavior within 10 seconds of a clearly delivered instruction, or stops the requested behavior before completion without permission. Each instruction not followed within the compliance window counts as one instance.',
  },
  {
    name: 'Self-Restraint',
    operationalDefinition: 'Client places hands under body, sits on hands, or tucks arms tightly against torso in a manner that prevents functional use of hands during a task or interaction. Episode begins when restraint posture is assumed and ends when hands are freely available for more than 10 consecutive seconds.',
  },
  {
    name: 'Stereotypy / Repetitive Motor Behavior',
    operationalDefinition: 'Client engages in repetitive, non-functional motor movements (e.g., hand flapping, body rocking, spinning, finger movements) that are not directed toward a task or social interaction. Episode begins at movement onset and ends when the movement stops for more than 5 consecutive seconds.',
  },
];

// ─── Behavior name autocomplete input ────────────────────────────────────────

function BehaviorNameInput({ value, onChange, onSelect }) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ top: 0, left: 0, width: 0 });
  const inputRef          = useRef(null);
  const dropdownRef       = useRef(null);

  const suggestions = (value ?? '').trim().length >= 1
    ? BEHAVIOR_LIBRARY.filter(b => b.name.toLowerCase().includes(value.toLowerCase()))
    : [];

  const updatePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  };

  const handleChange = (e) => {
    onChange(e);
    updatePos();
    setOpen(true);
  };

  const handleFocus = () => {
    updatePos();
    if ((value ?? '').trim()) setOpen(true);
  };

  const handlePickItem = (item) => {
    onSelect(item);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!inputRef.current?.contains(e.target)) setOpen(false); };
    const closeOnScroll = (e) => {
      // Don't close when scrolling inside the dropdown list itself
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  const dropdown = open && suggestions.length > 0 ? createPortal(
    <div
      ref={dropdownRef}
      onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-white rounded-xl border border-stone-200 shadow-2xl py-1 max-h-72 overflow-y-auto">
      {suggestions.map((item, i) => (
        <button key={item.name} type="button"
          onMouseDown={e => { e.preventDefault(); handlePickItem(item); }}
          className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50 transition-colors group"
          style={{ borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F4' : 'none' }}>
          <p className="text-[13px] font-semibold text-slate-700 group-hover:text-amber-800">
            {item.name}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.operationalDefinition}
          </p>
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder="e.g. Physical Aggression, Elopement, SIB — Head Banging"
        className="demo-input"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      />
      {dropdown}
    </>
  );
}

// ─── Inline unit select (portal) ──────────────────────────────────────────────

function UnitSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef          = useRef(null);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r        = btnRef.current.getBoundingClientRect();
      const dropH    = options.length * 32 + 8;
      const openUp   = window.innerHeight - r.bottom < dropH;
      setPos({ left: r.left, top: openUp ? r.top - dropH - 4 : r.bottom + 4 });
    }
    setOpen(o => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('scroll', close, true); };
  }, [open]);

  const menu = open ? createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{ position:'fixed', top: pos.top, left: pos.left, width: 140, zIndex: 9999 }}
      className="bg-white rounded-xl border border-stone-200 shadow-xl py-1">
      {options.map(opt => (
        <button key={opt} type="button"
          onMouseDown={e => { e.stopPropagation(); onChange(opt); setOpen(false); }}
          className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors ${
            value === opt ? 'text-teal-700 bg-teal-50' : 'text-slate-600 hover:bg-stone-50'}`}>
          {opt}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-teal-700 border-b-2 border-teal-300 bg-transparent mx-0.5 transition-colors hover:border-teal-500">
        {value}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {menu}
    </>
  );
}

// ─── Inline number input ──────────────────────────────────────────────────────

function InlineNum({ value, onChange, placeholder, width = '3.5rem' }) {
  return (
    <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={0}
      className="inline-block text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
      style={{ width, lineHeight: 1.5 }}
    />
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

const SL = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

// ─── BehaviorTargetCard ───────────────────────────────────────────────────────

export default function BehaviorTargetCard({ clientId, target, index, setClients, onDragStart }) {
  const [expanded, setExpanded] = useState(false);

  const set    = (field) => (val) => updateBehaviorTarget(setClients, clientId, target.id, { [field]: val });
  const setRaw = (field) => (e)   => updateBehaviorTarget(setClients, clientId, target.id, { [field]: e.target.value });

  const toggleArr = (field, item) => {
    const arr  = target[field] ?? [];
    const next = arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
    updateBehaviorTarget(setClients, clientId, target.id, { [field]: next });
  };

  const chipClass = (active) =>
    `px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
      active ? 'text-white border-teal-600' : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
    }`;

  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded(e => !e)}>

        {/* Drag handle */}
        <span draggable onDragStart={e => { e.stopPropagation(); onDragStart?.(); }}
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors"
          title="Drag to reorder">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </span>

        {/* Index badge */}
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: '#F59E0B' }}>
          {index + 1}
        </span>

        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
          {target.behaviorName || <span className="text-slate-400 font-normal">Untitled behavior</span>}
        </span>

        {/* Quick summary chips when collapsed */}
        {!expanded && target.hypothesizedFunction && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#92400E' }}>
            {target.hypothesizedFunction}
          </span>
        )}
        {!expanded && target.intensityRating && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            target.intensityRating === 'Severe'   ? 'bg-red-50 text-red-700' :
            target.intensityRating === 'Moderate' ? 'bg-amber-50 text-amber-700' :
            'bg-green-50 text-green-700'
          }`}>
            {target.intensityRating}
          </span>
        )}

        <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
        <button onClick={e => { e.stopPropagation(); removeBehaviorTarget(setClients, clientId, target.id); }}
          className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
          title="Remove behavior target">×</button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-5 pt-2 border-t border-stone-100 space-y-5">

          {/* Behavior name */}
          <div>
            <SL>Behavior Name</SL>
            <BehaviorNameInput
              value={target.behaviorName}
              onChange={setRaw('behaviorName')}
              onSelect={(item) => updateBehaviorTarget(setClients, clientId, target.id, {
                behaviorName: item.name,
                operationalDefinition: item.operationalDefinition,
              })}
            />
          </div>

          {/* Operational definition */}
          <div>
            <SL>Operational Definition</SL>
            <textarea value={target.operationalDefinition ?? ''} onChange={setRaw('operationalDefinition')}
              placeholder="Observable, measurable description of the behavior — what it looks, sounds, or feels like…"
              rows={3} className="demo-input resize-y leading-relaxed"
              style={{ fontFamily: 'DM Sans, sans-serif' }}/>
          </div>

          {/* Topography */}
          <div>
            <SL>Topography (select all that apply)</SL>
            <div className="flex flex-wrap gap-1.5">
              {TOPOGRAPHY_OPTIONS.map(t => (
                <button key={t} onClick={() => toggleArr('topography', t)}
                  className={chipClass((target.topography ?? []).includes(t))}
                  style={(target.topography ?? []).includes(t) ? { background: '#0D9488' } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency — inline sentence */}
          <div className="rounded-xl px-4 py-3.5 space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <SL>Frequency</SL>
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
              <span>Client engages in this behavior approximately</span>
              <InlineNum value={target.frequencyPerDay} onChange={set('frequencyPerDay')} placeholder="0" width="3.5rem"/>
              <span>times per</span>
              <UnitSelect value={target.frequencyUnit || 'day'} onChange={set('frequencyUnit')}
                options={['day','session','week']}/>
              <span>.</span>
            </p>
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
              <span>Each episode lasts approximately</span>
              <InlineNum value={target.durationSeconds} onChange={set('durationSeconds')} placeholder="0" width="3.5rem"/>
              <UnitSelect value={target.durationUnit || 'seconds'} onChange={set('durationUnit')}
                options={['seconds','minutes']}/>
              <span>.</span>
            </p>
          </div>

          {/* Intensity */}
          <div>
            <SL>Intensity Rating</SL>
            <div className="flex gap-2">
              {INTENSITY_LEVELS.map(lvl => {
                const active = target.intensityRating === lvl;
                const colors = lvl === 'Severe' ? { bg: '#DC2626', border: '#DC2626' }
                  : lvl === 'Moderate' ? { bg: '#D97706', border: '#D97706' }
                  : { bg: '#16A34A', border: '#16A34A' };
                return (
                  <button key={lvl} onClick={() => updateBehaviorTarget(setClients, clientId, target.id, { intensityRating: lvl })}
                    className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-all ${
                      active ? 'text-white' : 'text-slate-500 border-stone-200 bg-white hover:border-slate-300'
                    }`}
                    style={active ? { background: colors.bg, borderColor: colors.border } : {}}>
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Antecedents */}
          <div>
            <SL>Antecedents (triggers)</SL>
            <textarea value={target.antecedents ?? ''} onChange={setRaw('antecedents')}
              placeholder="Describe the conditions, events, or stimuli that precede this behavior…"
              rows={2} className="demo-input resize-y leading-relaxed"
              style={{ fontFamily: 'DM Sans, sans-serif' }}/>
          </div>

          {/* Primary targets */}
          <div>
            <SL>Who is primarily affected</SL>
            <div className="flex flex-wrap gap-1.5">
              {PRIMARY_TARGETS.map(t => (
                <button key={t} onClick={() => toggleArr('primaryTargets', t)}
                  className={chipClass((target.primaryTargets ?? []).includes(t))}
                  style={(target.primaryTargets ?? []).includes(t) ? { background: '#0D9488' } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Hypothesized function */}
          <div>
            <SL>Hypothesized Function</SL>
            <div className="flex gap-2 flex-wrap">
              {FUNCTIONS.map(fn => {
                const active = target.hypothesizedFunction === fn;
                return (
                  <button key={fn} onClick={() => updateBehaviorTarget(setClients, clientId, target.id, { hypothesizedFunction: fn })}
                    className={chipClass(active)}
                    style={active ? { background: '#0D9488' } : {}}>
                    {fn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Short-Term Objectives (STO steps) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <SL>Short-Term Objectives (STO)</SL>
              <button
                type="button"
                onClick={() => addBehaviorStoStep(setClients, clientId, target.id)}
                className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Add STO step
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Milestones that must be met before reaching the reduction goal
            </p>
            {(target.stoSteps ?? []).length === 0 ? (
              <p className="text-[11px] font-semibold text-amber-600">
                At least one short-term objective (STO) is required
              </p>
            ) : (
              <div className="space-y-2">
                {(target.stoSteps ?? []).map((step, si) => (
                  <div key={step.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-600 rounded-lg px-3 py-2"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <span className="text-[11px] font-bold text-teal-600 mr-0.5">STO {si + 1}</span>
                    <span>{target.behaviorName || 'Behavior'} will reduce to</span>
                    <InlineNum
                      value={step.targetFrequency}
                      onChange={v => updateBehaviorStoStep(setClients, clientId, target.id, step.id, 'targetFrequency', v)}
                      placeholder="0"
                      width="3rem"
                    />
                    <span>per {target.frequencyUnit || 'day'} for</span>
                    <InlineNum
                      value={step.durationWeeks}
                      onChange={v => updateBehaviorStoStep(setClients, clientId, target.id, step.id, 'durationWeeks', v)}
                      placeholder="4"
                      width="2.5rem"
                    />
                    <span>consecutive weeks.</span>
                    <button
                      type="button"
                      onClick={() => removeBehaviorStoStep(setClients, clientId, target.id, step.id)}
                      className="ml-auto text-slate-300 hover:text-red-400 transition-colors text-base leading-none"
                      title="Remove step">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Baseline → target sentence */}
          <div className="rounded-xl px-4 py-3.5" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <SL>Reduction Goal</SL>
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5 min-h-[2rem]">
              <span>Current baseline:</span>
              <span className="font-semibold text-slate-800 tabular-nums" style={{ minWidth: '2rem', display: 'inline-block', textAlign: 'center' }}>
                {target.baselineFrequency !== '' && target.baselineFrequency != null ? target.baselineFrequency : '?'}
              </span>
              <span>times per {target.frequencyUnit || 'day'}. Target: reduce to</span>
              <InlineNum value={target.targetFrequency} onChange={set('targetFrequency')} placeholder="0" width="3.5rem"/>
              <span>or fewer times per {target.frequencyUnit || 'day'}.</span>
            </p>
          </div>

          {/* Measurement system */}
          <div>
            <SL>Measurement System</SL>
            <div className="flex flex-wrap gap-1.5">
              {MEASUREMENT_SYSTEMS.map(m => (
                <button key={m} onClick={() => updateBehaviorTarget(setClients, clientId, target.id, { measurementSystem: m })}
                  className={chipClass(target.measurementSystem === m)}
                  style={target.measurementSystem === m ? { background: '#0D9488' } : {}}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Prior FBA / BIP */}
          <div>
            <SL>Prior Assessment &amp; Plans</SL>
            <div className="flex gap-4">
              {[['priorFBACompleted', 'FBA completed'], ['priorBIPCompleted', 'BIP in place']].map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={!!target[field]}
                    onChange={e => updateBehaviorTarget(setClients, clientId, target.id, { [field]: e.target.checked })}
                    className="w-3.5 h-3.5 accent-teal-600"/>
                  <span className="text-[12px] text-slate-600">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <SL>Additional Notes</SL>
            <textarea value={target.notes ?? ''} onChange={setRaw('notes')}
              placeholder="Any additional clinical observations, context, or caregiver reports…"
              rows={5} className="demo-input resize-y leading-relaxed"
              style={{ fontFamily: 'DM Sans, sans-serif' }}/>
          </div>

        </div>
      )}
    </div>
  );
}

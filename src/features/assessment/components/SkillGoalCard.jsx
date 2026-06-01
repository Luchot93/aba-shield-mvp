import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAutoSave } from '../../../hooks/useAutoSave.js';
import { updateSkillGoal, removeSkillGoal } from '../assessmentStore.js';

const DOMAINS = [
  'Communication',
  'Social',
  'Adaptive / Self-Help',
  'Academic',
  'Motor',
  'Play',
];

const DOMAIN_COLORS = {
  'Communication':      { bg: 'rgba(20,184,166,0.1)',  text: '#0D9488' },
  'Social':             { bg: 'rgba(139,92,246,0.1)',  text: '#7C3AED' },
  'Adaptive / Self-Help': { bg: 'rgba(245,158,11,0.1)', text: '#B45309' },
  'Academic':           { bg: 'rgba(59,130,246,0.1)',  text: '#1D4ED8' },
  'Motor':              { bg: 'rgba(236,72,153,0.1)',  text: '#BE185D' },
  'Play':               { bg: 'rgba(34,197,94,0.1)',   text: '#15803D' },
};

const TEACHING_STRATEGIES = [
  'Discrete Trial Training (DTT)',
  'Natural Environment Teaching (NET)',
  'Pivotal Response Training (PRT)',
  'Video Modeling',
  'Social Stories',
  'Peer-Mediated Instruction',
  'Task Analysis / Chaining',
  'Incidental Teaching',
  'Other',
];

const PROMPTING_LEVELS = [
  'Full Physical',
  'Partial Physical',
  'Model',
  'Gestural',
  'Positional',
  'Verbal',
  'Independent',
];

// ─── Skill acquisition library ────────────────────────────────────────────────

const SKILL_LIBRARY = [
  // Communication & Language
  {
    name: 'Mand Training (Functional Requesting)',
    operationalDefinition: 'Client independently requests a preferred item, activity, or action using a context-appropriate communication modality (verbal utterance, PECS card exchange, or AAC symbol activation) within 10 seconds of access opportunity, without physical or gestural prompting.',
  },
  {
    name: 'Receptive Object Identification',
    operationalDefinition: 'Client selects the correct object or picture from an array of 3 when given the verbal label within 5 seconds, without additional prompting beyond the initial instruction.',
  },
  {
    name: 'Expressive Labeling / Tacting',
    operationalDefinition: 'Client independently vocalizes or selects the correct label for a presented object, picture, or action within 5 seconds of the verbal prompt "What is this?" without additional cues.',
  },
  {
    name: 'Intraverbal Responding',
    operationalDefinition: 'Client provides a contextually appropriate verbal response to a conversational prompt, question, or fill-in statement within 5 seconds, without echoic or visual prompts.',
  },
  {
    name: 'Vocal Imitation (Echoic Training)',
    operationalDefinition: 'Client vocalizes an immediate and recognizable approximation of a modeled sound, syllable, or word within 5 seconds of the model, without additional prompting.',
  },
  {
    name: 'Motor Imitation',
    operationalDefinition: 'Client imitates a gross or fine motor action modeled by the therapist within 5 seconds of the cue "do this," without physical or gestural prompting beyond the model itself.',
  },
  {
    name: 'PECS Exchange (Phases I–IV)',
    operationalDefinition: 'Client independently retrieves the appropriate PECS card and exchanges it with a communication partner to request a preferred item, without physical prompting, across the current training phase criteria.',
  },
  {
    name: 'AAC Device Use',
    operationalDefinition: 'Client independently navigates to and activates the appropriate AAC symbol or page to communicate a request, comment, or response within 10 seconds of a communicative opportunity, without physical prompting.',
  },
  {
    name: 'Social Greetings',
    operationalDefinition: 'Client independently initiates or responds to a contextually appropriate greeting (e.g., "hi," wave, or name acknowledgment) within 5 seconds of a social opportunity or greeting from another person, without verbal or gestural prompting.',
  },
  // Social Skills
  {
    name: 'Joint Attention',
    operationalDefinition: 'Client coordinates gaze between an object or event and a communication partner by following a point or gaze shift, or by initiating a point or show to direct another\'s attention, within 3 seconds of the social bid.',
  },
  {
    name: 'Peer Interaction Initiation',
    operationalDefinition: 'Client independently initiates a non-scripted, contextually appropriate social interaction with a same-age peer (e.g., commenting, requesting to join, offering a compliment) at least 2 times per 30-minute structured opportunity, without adult prompting.',
  },
  {
    name: 'Turn-Taking',
    operationalDefinition: 'Client waits for their turn during a structured activity or game, takes their turn when indicated, and returns control to the partner without adult prompting, across 3 or more consecutive exchanges.',
  },
  {
    name: 'Emotion Identification',
    operationalDefinition: 'Client correctly identifies and labels a basic emotion (happy, sad, angry, scared, surprised) depicted in a photograph or presented in a role-play scenario within 5 seconds, without prompting beyond the initial instruction.',
  },
  {
    name: 'Perspective Taking',
    operationalDefinition: 'Client correctly identifies what another person knows, thinks, or feels in a structured scenario that differs from the client\'s own knowledge or experience, within 10 seconds and without prompting beyond the initial question.',
  },
  // Adaptive / Self-Help
  {
    name: 'Functional Help-Seeking',
    operationalDefinition: 'Client independently vocalizes a contextually appropriate help-seeking statement ("I need help," "Can you help me?") within 10 seconds of encountering a task difficulty or blocked access, without adult prompting.',
  },
  {
    name: 'Break Requesting',
    operationalDefinition: 'Client independently requests a break using a designated communication response (verbal request, card exchange, or AAC symbol) during a non-preferred task, before engaging in challenging behavior, without prompting.',
  },
  {
    name: 'Transition Compliance',
    operationalDefinition: 'Client transitions from a preferred to a non-preferred activity within 60 seconds of a transition cue (verbal + visual), without engaging in challenging behavior, when a advance warning and First-Then visual are provided.',
  },
  {
    name: 'Hand Washing',
    operationalDefinition: 'Client independently completes all steps of the hand-washing sequence (turn on water, wet hands, apply soap, scrub 10 seconds, rinse, turn off water, dry hands) in correct order within 2 minutes, without verbal or gestural prompting beyond the initial cue.',
  },
  {
    name: 'Tooth Brushing',
    operationalDefinition: 'Client independently completes all steps of the tooth-brushing sequence (wet brush, apply toothpaste, brush all surfaces 2 minutes, rinse, rinse brush) in correct order without verbal or gestural prompting beyond the initial cue to brush teeth.',
  },
  {
    name: 'Independent Dressing',
    operationalDefinition: 'Client independently puts on and fastens all required clothing items (shirt, pants, socks, shoes) in correct order within the time limit specified in the task analysis, without verbal or physical prompting beyond the initial instruction.',
  },
  {
    name: 'Utensil Use (Fork / Spoon)',
    operationalDefinition: 'Client independently uses a fork or spoon to scoop or spear food and bring it to the mouth without spilling across 80% of bites during a meal, without physical or gestural prompting.',
  },
  {
    name: 'Toilet Training',
    operationalDefinition: 'Client independently initiates toileting (walks to bathroom, manages clothing, uses toilet, flushes, washes hands) without urinary or bowel accidents, across all scheduled and unscheduled opportunities within the training day.',
  },
  // Academic / Cognitive
  {
    name: 'Matching Identical Objects',
    operationalDefinition: 'Client places an object onto its identical match from a field of 3 when instructed "match" within 5 seconds, without prompting beyond the instruction.',
  },
  {
    name: 'Sorting by Category',
    operationalDefinition: 'Client sorts a set of 6–9 items into 2–3 designated category groups by placing each item in the correct location within 10 seconds per item, without prompting beyond the initial sorting instruction.',
  },
  {
    name: 'Number Identification (1–10)',
    operationalDefinition: 'Client selects the correct numeral from an array of 3 when given the verbal label, or vocalizes the correct numeral when presented with a written number, within 5 seconds and without prompting.',
  },
  {
    name: 'Letter Identification',
    operationalDefinition: 'Client selects the correct uppercase or lowercase letter from an array of 3 when given the verbal letter name, within 5 seconds and without prompting beyond the initial instruction.',
  },
  {
    name: 'Counting Objects (1–10)',
    operationalDefinition: 'Client touches each object once in a set of 1–10 items while vocalizing sequential number words and states the final count when asked "how many?" without skipping or double-counting, without prompting.',
  },
  // Daily Living
  {
    name: 'Morning Routine Completion',
    operationalDefinition: 'Client completes all steps of the morning routine in correct sequence within the target time using a visual schedule, with no more than 1 verbal prompt total per routine.',
  },
  {
    name: 'Following Multi-Step Instructions',
    operationalDefinition: 'Client completes a 2–3 step instruction delivered in a single statement (e.g., "Get your backpack, put on your shoes, and wait by the door") in the correct sequence within 60 seconds, without repetition or additional prompting.',
  },
];

// ─── Skill name autocomplete input ───────────────────────────────────────────

function SkillNameInput({ value, onChange, onSelect }) {
  const [open, setOpen]     = useState(false);
  const [pos,  setPos]      = useState({ top: 0, left: 0, width: 0 });
  const inputRef            = useRef(null);
  const dropdownRef         = useRef(null);

  const suggestions = (value ?? '').trim().length >= 1
    ? SKILL_LIBRARY.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
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
          className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 transition-colors group"
          style={{ borderBottom: i < suggestions.length - 1 ? '1px solid #F5F5F4' : 'none' }}>
          <p className="text-[13px] font-semibold text-slate-700 group-hover:text-teal-700">
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
        placeholder="e.g. Mands for preferred items using 1–2 word utterances"
        className="demo-input"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      />
      {dropdown}
    </>
  );
}

// ─── Inline number input ──────────────────────────────────────────────────────

function InlineNum({ value, onChange, placeholder, width = '3.5rem' }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      min={0}
      max={9999}
      className="inline-block text-center text-[14px] font-semibold text-teal-700 bg-transparent border-b-2 border-teal-300 focus:border-teal-500 outline-none transition-colors mx-0.5"
      style={{ width, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}
    />
  );
}

// ─── Inline prompt chip selector ─────────────────────────────────────────────

function InlinePromptPick({ value, onChange, options = PROMPTING_LEVELS }) {
  const [open, setOpen]     = useState(false);
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 160, openUp: false });
  const btnRef              = useRef(null);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);   // capture scroll anywhere
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!btnRef.current) { setOpen(o => !o); return; }

    const r = btnRef.current.getBoundingClientRect();
    const dropH = options.length * 34 + 8; // estimated height
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < dropH;

    setPos({
      left:   r.left,
      width:  Math.max(r.width, 160),
      top:    openUp ? r.top - dropH - 4 : r.bottom + 4,
      openUp,
    });
    setOpen(o => !o);
  };

  const menu = open ? createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top:      pos.top,
        left:     pos.left,
        width:    160,
        zIndex:   9999,
      }}
      className="bg-white rounded-xl border border-stone-200 shadow-xl py-1">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onMouseDown={e => { e.stopPropagation(); onChange(opt); setOpen(false); }}
          className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors ${
            value === opt ? 'text-teal-700 bg-teal-50' : 'text-slate-600 hover:bg-stone-50'
          }`}>
          {opt}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <span className="relative inline-block mx-0.5">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[13px] font-semibold transition-all"
        style={{
          background:  value ? 'rgba(20,184,166,0.12)' : 'rgba(148,163,184,0.12)',
          color:       value ? '#0D9488' : '#94A3B8',
          borderBottom: '2px solid',
          borderColor: value ? '#14B8A6' : '#CBD5E1',
        }}>
        {value || 'select'}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {menu}
    </span>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
    {children}
  </p>
);

// ─── SkillGoalCard ────────────────────────────────────────────────────────────

export default function SkillGoalCard({ clientId, goal, index, setClients, onDragStart }) {
  const [expanded, setExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState(null);

  const { saveState: defSaveState } = useAutoSave(
    goal.operationalDefinition,
    (v) => updateSkillGoal(setClients, clientId, goal.id, { operationalDefinition: v }),
    800,
  );

  const set = (field) => (e) =>
    updateSkillGoal(setClients, clientId, goal.id, { [field]: e.target.value });

  const setVal = (field) => (val) =>
    updateSkillGoal(setClients, clientId, goal.id, { [field]: val });

  const toggleStrategy = (s) => {
    const current = goal.teachingStrategies ?? [];
    const next = current.includes(s)
      ? current.filter(x => x !== s)
      : [...current, s];
    updateSkillGoal(setClients, clientId, goal.id, { teachingStrategies: next });
  };

  const targetSkillRef = useRef(goal.targetSkill);
  const defRef = useRef(goal.operationalDefinition);

  const handleTargetSkillChange = (e) => {
    const val = e.target.value;
    targetSkillRef.current = val;
    updateSkillGoal(setClients, clientId, goal.id, { targetSkill: val });

    clearTimeout(handleTargetSkillChange._timer);
    handleTargetSkillChange._timer = setTimeout(async () => {
      if (!val.trim() || defRef.current?.trim()) return;
      setAiLoading(true);
      setAiError(null);
      updateSkillGoal(setClients, clientId, goal.id, { definitionIsLoading: true });
      try {
        // Route through the Vite dev-server proxy (/api/generate-definition).
        // In production this becomes your backend endpoint.
        // The Anthropic API key lives in .env.local (server-side only) and is
        // never exposed to the browser bundle.
        const res = await fetch('/api/generate-definition', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ skillName: val }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Server error');
        const text = data.text ?? '';
        if (!defRef.current?.trim() && text) {
          defRef.current = text;
          updateSkillGoal(setClients, clientId, goal.id, {
            operationalDefinition: text,
            definitionIsAiGenerated: true,
            definitionIsLoading: false,
          });
        }
      } catch (err) {
        setAiError('Could not generate definition. Enter manually.');
      } finally {
        setAiLoading(false);
        updateSkillGoal(setClients, clientId, goal.id, { definitionIsLoading: false });
      }
    }, 1500);
  };

  const handleDefChange = (e) => {
    defRef.current = e.target.value;
    updateSkillGoal(setClients, clientId, goal.id, {
      operationalDefinition: e.target.value,
      definitionIsAiGenerated: false,
    });
  };

  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded(e => !e)}>

        {/* Drag handle — only this element is draggable */}
        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); onDragStart?.(); }}
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors"
          title="Drag to reorder">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </span>

        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: '#14B8A6' }}>
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
          {goal.targetSkill || <span className="text-slate-400 font-normal">Untitled goal</span>}
        </span>
        {goal.domain && !expanded && (
          <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md"
            style={{ background: DOMAIN_COLORS[goal.domain]?.bg ?? 'rgba(20,184,166,0.1)', color: DOMAIN_COLORS[goal.domain]?.text ?? '#0D9488' }}>
            {goal.domain}
          </span>
        )}
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
        <button
          onClick={e => { e.stopPropagation(); removeSkillGoal(setClients, clientId, goal.id); }}
          className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
          title="Remove goal">
          ×
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-5 pt-2 border-t border-stone-100 space-y-5">

          {/* Target Skill */}
          <div>
            <SectionLabel>Target Skill</SectionLabel>
            <SkillNameInput
              value={goal.targetSkill}
              onChange={handleTargetSkillChange}
              onSelect={(item) => {
                defRef.current = item.operationalDefinition;
                updateSkillGoal(setClients, clientId, goal.id, {
                  targetSkill: item.name,
                  operationalDefinition: item.operationalDefinition,
                  definitionIsAiGenerated: false,
                });
              }}
            />
          </div>

          {/* Domain Category */}
          <div>
            <SectionLabel>Domain</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {DOMAINS.map(d => {
                const active = goal.domain === d;
                const colors = DOMAIN_COLORS[d];
                return (
                  <button key={d} type="button"
                    onClick={() => updateSkillGoal(setClients, clientId, goal.id, { domain: active ? '' : d })}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                      active ? 'border-transparent' : 'border-stone-200 bg-white text-slate-500 hover:border-teal-300'
                    }`}
                    style={active ? { background: colors.bg, color: colors.text, borderColor: 'transparent' } : {}}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Operational Definition */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <SectionLabel>Operational Definition</SectionLabel>
              <div className="flex items-center gap-2">
                {goal.definitionIsAiGenerated && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: 'rgba(20,184,166,0.1)', color: '#0D9488' }}>
                    AI generated
                  </span>
                )}
                <span className={`text-[10px] transition-opacity ${
                  defSaveState === 'idle' ? 'opacity-0' : 'opacity-100'
                } ${defSaveState === 'saved' ? 'text-teal-600' : 'text-slate-400'}`}
                  style={{ fontFamily: 'DM Mono, monospace' }}>
                  {defSaveState === 'saving' ? 'saving…' : defSaveState === 'saved' ? '✓ Saved' : ''}
                </span>
              </div>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <svg className="w-3.5 h-3.5 animate-spin text-teal-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span className="text-xs text-slate-500">Generating definition…</span>
              </div>
            ) : (
              <textarea
                value={goal.operationalDefinition ?? ''}
                onChange={handleDefChange}
                placeholder="Observable, measurable description of the target behavior…"
                rows={3}
                className="demo-input resize-y leading-relaxed"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              />
            )}
            {aiError && <p className="text-xs text-red-500 mt-1">{aiError}</p>}
          </div>

          {/* Teaching Strategies */}
          <div>
            <SectionLabel>Teaching Strategies</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {TEACHING_STRATEGIES.map(s => {
                const selected = (goal.teachingStrategies ?? []).includes(s);
                return (
                  <button key={s} onClick={() => toggleStrategy(s)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                      selected
                        ? 'text-white border-teal-600'
                        : 'text-slate-500 border-stone-200 bg-white hover:border-teal-300'
                    }`}
                    style={selected ? { background: '#0D9488' } : {}}>
                    {s}
                  </button>
                );
              })}
            </div>
            {(goal.teachingStrategies ?? []).includes('Other') && (
              <input
                className="demo-input mt-2"
                value={goal.teachingStrategiesOther ?? ''}
                onChange={set('teachingStrategiesOther')}
                placeholder="Describe other strategy…"
              />
            )}
          </div>

          {/* ── Baseline Performance — inline sentence ──────────────────── */}
          <div className="rounded-xl px-4 py-3.5" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <SectionLabel>Baseline Performance</SectionLabel>
            <p className="text-[14px] leading-[2.2] text-slate-600 flex flex-wrap items-baseline">
              <span>Client currently demonstrates approximately</span>
              <InlineNum
                value={goal.baselinePercent}
                onChange={set('baselinePercent')}
                placeholder="0"
                width="3.5rem"
              />
              <span>% correct responding across</span>
              <InlineNum
                value={goal.baselineOpportunities}
                onChange={set('baselineOpportunities')}
                placeholder="0"
                width="3.5rem"
              />
              <span>opportunities/trials with</span>
              <InlinePromptPick
                value={goal.baselinePromptingLevel}
                onChange={setVal('baselinePromptingLevel')}
              />
              <span>level of prompting.</span>
            </p>
          </div>

          {/* ── Mastery Criteria — inline sentence ─────────────────────── */}
          <div className="rounded-xl px-4 py-3.5" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <SectionLabel>Mastery Criteria</SectionLabel>
            <p className="text-[14px] leading-[2.2] text-slate-600 flex flex-wrap items-baseline">
              <span>Client will demonstrate</span>
              <InlineNum
                value={goal.masteryCriteriaPercent}
                onChange={set('masteryCriteriaPercent')}
                placeholder="80"
                width="3.5rem"
              />
              <span>% accuracy across</span>
              <InlineNum
                value={goal.masteryCriteriaSessions}
                onChange={set('masteryCriteriaSessions')}
                placeholder="3"
                width="3rem"
              />
              <span>consecutive sessions across</span>
              <InlineNum
                value={goal.masteryCriteriaSettings}
                onChange={set('masteryCriteriaSettings')}
                placeholder="2"
                width="3rem"
              />
              <span>people/settings with</span>
              <InlinePromptPick
                value={goal.masteryCriteriaPromptingLevel}
                onChange={setVal('masteryCriteriaPromptingLevel')}
              />
              <span>level of prompting.</span>
            </p>
          </div>

          {/* ── Short-Term Objective (STO) ──────────────────────────────── */}
          <div className="rounded-xl px-4 py-3.5 space-y-2.5" style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.18)' }}>
            <SectionLabel>Short-Term Objective (STO)</SectionLabel>
            {/* Row 1 — percent */}
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5">
              <span>Client will demonstrate</span>
              <InlineNum
                value={goal.stoPercent}
                onChange={val => updateSkillGoal(setClients, clientId, goal.id, { stoPercent: val })}
                placeholder="80"
                width="3.5rem"
              />
              <span>% accuracy on:</span>
            </p>
            {/* Row 2 — full-width description */}
            <input
              type="text"
              value={goal.stoSkillDescription ?? ''}
              onChange={e => updateSkillGoal(setClients, clientId, goal.id, { stoSkillDescription: e.target.value })}
              placeholder="skill or step description…"
              className="w-full text-[13px] font-medium text-teal-700 bg-white/60 border border-teal-200 rounded-lg px-3 py-1.5 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100 transition-all placeholder:text-teal-300"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
            {/* Row 3 — weeks */}
            <p className="text-[14px] text-slate-600 flex flex-wrap items-center gap-x-1.5">
              <span>within</span>
              <InlineNum
                value={goal.stoWeeks}
                onChange={val => updateSkillGoal(setClients, clientId, goal.id, { stoWeeks: val })}
                placeholder="12"
                width="3rem"
              />
              <span>weeks of program start.</span>
            </p>
          </div>

          {/* Generalization */}
          <div>
            <SectionLabel>Generalization &amp; Maintenance</SectionLabel>
            <textarea
              value={goal.generalizationNotes ?? ''}
              onChange={set('generalizationNotes')}
              placeholder="Describe planned generalization strategies across people, settings, and materials…"
              rows={5}
              className="demo-input resize-y leading-relaxed"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>

        </div>
      )}
    </div>
  );
}

import React from 'react';
import { SECTION_TITLES } from '../sectionConfig.js';
import ConflictFlag from './ConflictFlag.jsx';
import GuidedPrompts from './GuidedPrompts.jsx';
import RecordButton from './RecordButton.jsx';
import TranscriptPanel from './TranscriptPanel.jsx';
import FreeTextNotes from './FreeTextNotes.jsx';
import BehavioralIndicators from './BehavioralIndicators.jsx';
import DemographicsForm from './DemographicsForm.jsx';
import SkillAcquisitionsPanel from './SkillAcquisitionsPanel.jsx';
import BehaviorTargetsPanel from './BehaviorTargetsPanel.jsx';
import CommunicationForm from './CommunicationForm.jsx';
import MedicalNecessityForm from './MedicalNecessityForm.jsx';
import SafetyForm from './SafetyForm.jsx';
import CrisisForm from './CrisisForm.jsx';
import CaregiverTrainingForm from './CaregiverTrainingForm.jsx';

// Left-border color by completionState (collapsed) or active (expanded)
const COLLAPSED_BORDER = {
  empty:    '#E7E5E4',
  partial:  '#FBBF24',
  complete: '#34D399',
};

const DOT_COLORS = {
  empty:    'bg-white border-2 border-slate-300',
  partial:  'bg-amber-400 border-2 border-amber-400',
  complete: 'bg-emerald-500 border-2 border-emerald-500',
};

export default function SectionCard({
  clientId,
  client,
  sectionKey,
  sectionIndex,
  session,
  setClients,
  currentUser,
  isExpanded,
  onToggle,
  transcriptVisible,
  onTranscriptToggle,
  onRecordStart,
  addNotif,
}) {
  const section = session?.sections?.[sectionKey];
  if (!section) return null;

  const completionState = section.completionState ?? 'empty';
  const hasTranscript   = !!section.transcript;

  const borderColor = isExpanded
    ? undefined
    : COLLAPSED_BORDER[completionState] ?? COLLAPSED_BORDER.empty;

  const isDemographics      = sectionKey === 'demographics';
  const isSkillAcquisitions = sectionKey === 'skill_acquisitions';
  const isBehaviorTargets   = sectionKey === 'behavior_targets';
  const isCommunication      = sectionKey === 'communication';
  const isMedicalNecessity   = sectionKey === 'medical_necessity';
  const isSafety             = sectionKey === 'safety';
  const isCrisisPlan         = sectionKey === 'crisis_plan';
  const isCaregiverTraining  = sectionKey === 'caregiver_training';
  const hasBehaviorPanel     = isBehaviorTargets;

  return (
    <div
      className={`rounded-xl border bg-white ${
        isExpanded
          ? 'border-teal-200 border-l-2'
          : 'border-stone-200 cursor-pointer'
      }`}
      style={
        isExpanded
          ? {
              background: 'rgba(20,184,166,0.04)',
              borderLeftColor: '#14B8A6',
              fontFamily: 'DM Sans, sans-serif',
            }
          : {
              borderLeftColor: borderColor,
              borderLeftWidth: '3px',
              fontFamily: 'DM Sans, sans-serif',
            }
      }
      onClick={!isExpanded ? onToggle : undefined}>

      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isExpanded ? 'cursor-pointer' : ''}`}
        onClick={isExpanded ? onToggle : undefined}>

        {/* Number badge */}
        {sectionIndex != null && (
          <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
            style={{ background: isExpanded ? 'rgba(20,184,166,0.12)' : '#F1F5F9', color: isExpanded ? '#0D9488' : '#64748B' }}>
            {sectionIndex}
          </span>
        )}

        {/* Dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[completionState] ?? DOT_COLORS.empty}`}/>

        {/* Title */}
        <span className={`flex-1 text-sm font-semibold ${isExpanded ? 'text-teal-700' : 'text-slate-700'}`}>
          {SECTION_TITLES[sectionKey] ?? sectionKey}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasTranscript && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(20,184,166,0.1)', color: '#0D9488' }}>
              🎙 Transcript
            </span>
          )}
          {section.notes?.trim() && !isExpanded && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-slate-500">
              Notes
            </span>
          )}
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-teal-100/60">

          {/* Conflict flag */}
          <ConflictFlag section={section} />

          {/* Section-specific content */}
          {isDemographics ? (
            <DemographicsForm
              clientId={clientId}
              client={client}
              session={session}
              setClients={setClients}
            />
          ) : isCommunication ? (
            <>
              {/* 1. Guide the interview */}
              <GuidedPrompts sectionKey={sectionKey} />
              {/* 2. Capture it */}
              <div className="mb-3">
                <RecordButton clientId={clientId} sectionKey={sectionKey} session={session}
                  setClients={setClients} addNotif={addNotif} onConsentNeeded={onRecordStart}/>
              </div>
              {hasTranscript && (
                <div className="mb-3">
                  <button onClick={onTranscriptToggle}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 mb-2 transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${transcriptVisible ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {transcriptVisible ? 'Hide transcript' : 'Show transcript'}
                  </button>
                  {transcriptVisible && (
                    <TranscriptPanel clientId={clientId} sectionKey={sectionKey}
                      section={section} setClients={setClients}/>
                  )}
                </div>
              )}
              {/* 3. Document structured data */}
              <div className="border-t border-teal-100/60 my-4"/>
              <CommunicationForm clientId={clientId} session={session} setClients={setClients}/>
              {/* 4. Additional notes */}
              <div className="border-t border-teal-100/60 my-4"/>
              <FreeTextNotes clientId={clientId} sectionKey={sectionKey}
                section={section} setClients={setClients}/>
            </>
          ) : isSafety ? (
            <>
              <GuidedPrompts sectionKey={sectionKey} />
              <div className="mb-3">
                <RecordButton clientId={clientId} sectionKey={sectionKey} session={session}
                  setClients={setClients} addNotif={addNotif} onConsentNeeded={onRecordStart}/>
              </div>
              {hasTranscript && (
                <div className="mb-3">
                  <button onClick={onTranscriptToggle}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 mb-2 transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${transcriptVisible ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {transcriptVisible ? 'Hide transcript' : 'Show transcript'}
                  </button>
                  {transcriptVisible && (
                    <TranscriptPanel clientId={clientId} sectionKey={sectionKey}
                      section={section} setClients={setClients}/>
                  )}
                </div>
              )}
              <div className="border-t border-teal-100/60 my-4"/>
              <SafetyForm clientId={clientId} session={session} setClients={setClients}/>
              <div className="border-t border-teal-100/60 my-4"/>
              <FreeTextNotes clientId={clientId} sectionKey={sectionKey}
                section={section} setClients={setClients}/>
            </>
          ) : isMedicalNecessity ? (
            <>
              <GuidedPrompts sectionKey={sectionKey} />
              <div className="mb-3">
                <RecordButton clientId={clientId} sectionKey={sectionKey} session={session}
                  setClients={setClients} addNotif={addNotif} onConsentNeeded={onRecordStart}/>
              </div>
              {hasTranscript && (
                <div className="mb-3">
                  <button onClick={onTranscriptToggle}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 mb-2 transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${transcriptVisible ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {transcriptVisible ? 'Hide transcript' : 'Show transcript'}
                  </button>
                  {transcriptVisible && (
                    <TranscriptPanel clientId={clientId} sectionKey={sectionKey}
                      section={section} setClients={setClients}/>
                  )}
                </div>
              )}
              <div className="border-t border-teal-100/60 my-4"/>
              <MedicalNecessityForm clientId={clientId} session={session} setClients={setClients}/>
              <div className="border-t border-teal-100/60 my-4"/>
              <FreeTextNotes clientId={clientId} sectionKey={sectionKey}
                section={section}
                setClients={setClients}
              />
            </>
          ) : isCrisisPlan ? (
            <>
              <GuidedPrompts sectionKey={sectionKey} />
              <div className="mb-3">
                <RecordButton clientId={clientId} sectionKey={sectionKey} session={session}
                  setClients={setClients} addNotif={addNotif} onConsentNeeded={onRecordStart}/>
              </div>
              {hasTranscript && (
                <div className="mb-3">
                  <button onClick={onTranscriptToggle}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 mb-2 transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${transcriptVisible ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {transcriptVisible ? 'Hide transcript' : 'Show transcript'}
                  </button>
                  {transcriptVisible && (
                    <TranscriptPanel clientId={clientId} sectionKey={sectionKey}
                      section={section} setClients={setClients}/>
                  )}
                </div>
              )}
              <div className="border-t border-teal-100/60 my-4"/>
              <CrisisForm clientId={clientId} session={session} setClients={setClients}/>
              <div className="border-t border-teal-100/60 my-4"/>
              <FreeTextNotes clientId={clientId} sectionKey={sectionKey}
                section={section} setClients={setClients}/>
            </>
          ) : isSkillAcquisitions ? (
            <SkillAcquisitionsPanel
              clientId={clientId}
              session={session}
              setClients={setClients}
            />
          ) : hasBehaviorPanel ? (
            <BehaviorTargetsPanel
              clientId={clientId}
              session={session}
              setClients={setClients}
            />
          ) : isCaregiverTraining ? (
            <>
              <GuidedPrompts sectionKey={sectionKey} />
              <div className="border-t border-teal-100/60 my-4"/>
              <CaregiverTrainingForm clientId={clientId} session={session} setClients={setClients}/>
              <div className="border-t border-teal-100/60 my-4"/>
              <div className="mb-3">
                <RecordButton
                  clientId={clientId}
                  sectionKey={sectionKey}
                  session={session}
                  setClients={setClients}
                  addNotif={addNotif}
                  onConsentNeeded={onRecordStart}
                />
              </div>
              {hasTranscript && (
                <div className="mb-3">
                  <button
                    onClick={onTranscriptToggle}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 mb-2 transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${transcriptVisible ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {transcriptVisible ? 'Hide transcript' : 'Show transcript'}
                  </button>
                  {transcriptVisible && (
                    <TranscriptPanel
                      clientId={clientId}
                      sectionKey={sectionKey}
                      section={section}
                      setClients={setClients}
                    />
                  )}
                </div>
              )}
              <FreeTextNotes clientId={clientId} sectionKey={sectionKey}
                section={section} setClients={setClients}/>
            </>
          ) : (
            <>
              {/* Guided prompts */}
              <GuidedPrompts sectionKey={sectionKey} />

              {/* Record button */}
              <div className="mb-3">
                <RecordButton
                  clientId={clientId}
                  sectionKey={sectionKey}
                  session={session}
                  setClients={setClients}
                  addNotif={addNotif}
                  onConsentNeeded={onRecordStart}
                />
              </div>

              {/* Transcript (toggle) */}
              {hasTranscript && (
                <div className="mb-3">
                  <button
                    onClick={onTranscriptToggle}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-800 mb-2 transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${transcriptVisible ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                    {transcriptVisible ? 'Hide transcript' : 'Show transcript'}
                  </button>
                  {transcriptVisible && (
                    <TranscriptPanel
                      clientId={clientId}
                      sectionKey={sectionKey}
                      section={section}
                      setClients={setClients}
                    />
                  )}
                </div>
              )}

              {/* Behavioral indicators — antecedent tally counters for generic sections */}
              {(section?.indicators ?? []).length > 0 && (
                <div className="mb-3">
                  <BehavioralIndicators
                    clientId={clientId}
                    sectionKey={sectionKey}
                    section={section}
                    setClients={setClients}
                  />
                </div>
              )}

              {/* Free-text notes */}
              <FreeTextNotes
                clientId={clientId}
                sectionKey={sectionKey}
                section={section}
                setClients={setClients}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

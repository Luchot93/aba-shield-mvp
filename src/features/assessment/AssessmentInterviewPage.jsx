import React, { useState, useCallback, useEffect } from 'react';
import { SECTION_ORDER } from './sectionConfig.js';
import SectionSidebar from './components/SectionSidebar.jsx';
import SectionCard from './components/SectionCard.jsx';
import ConsentGate from './components/ConsentGate.jsx';

export default function AssessmentInterviewPage({
  clientId,
  clients,
  setClients,
  currentUser,
  addNotif,
  onBack,
  hideTopBar = false,
  targetSection = null,
  onTargetSectionHandled,
}) {
  const client  = clients.find(c => c.id === clientId);
  const session = client?.assessment_session;

  // Desktop: multiple sections open; mobile (<1024px): one at a time
  const [expandedSections,  setExpandedSections]  = useState(['demographics']);
  const [transcriptVisible, setTranscriptVisible] = useState({});
  const [activeSection,     setActiveSection]     = useState('demographics');
  const [consentPending,    setConsentPending]    = useState(false);
  const [consentSectionKey, setConsentSectionKey] = useState(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // Jump to a specific section when arriving from the checklist
  useEffect(() => {
    if (!targetSection) return;
    // Close everything else, open only the target — prevents needing to scroll past other open sections
    setActiveSection(targetSection);
    setExpandedSections([targetSection]);
    // Scroll after React has re-rendered the collapsed state
    setTimeout(() => {
      document.getElementById(`section-card-${targetSection}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    onTargetSectionHandled?.();
  }, [targetSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSection = useCallback((key) => {
    setActiveSection(key);
    if (isMobile) {
      // One open at a time on mobile
      setExpandedSections([key]);
    } else {
      setExpandedSections(prev =>
        prev.includes(key) ? prev : [...prev, key]
      );
    }
    // Scroll to card
    setTimeout(() => {
      document.getElementById(`section-card-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [isMobile]);

  const handleToggle = useCallback((key) => {
    setActiveSection(key);
    if (isMobile) {
      setExpandedSections(prev =>
        prev.includes(key) ? [] : [key]
      );
    } else {
      setExpandedSections(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  }, [isMobile]);

  const handleTranscriptToggle = useCallback((key) => {
    setTranscriptVisible(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Record start: check consent first
  const handleRecordStart = useCallback((sectionKey) => {
    if (!session?.consentGranted) {
      setConsentSectionKey(sectionKey);
      setConsentPending(true);
    }
  }, [session?.consentGranted]);

  const handleConsentClose = () => {
    setConsentPending(false);
    setConsentSectionKey(null);
  };

  if (!client || !session) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400"
        style={{ fontFamily: 'DM Sans, sans-serif' }}>
        No assessment session found for this client.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-stone-50 overflow-hidden ${hideTopBar ? 'h-full' : 'fixed top-14 inset-x-0 bottom-0 z-10'}`}
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top bar — hidden when embedded inside AssessmentFeature */}
      {!hideTopBar && (
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-3 bg-white border-b border-stone-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Assessments
        </button>

        <div className="h-4 w-px bg-stone-200"/>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-800 truncate">
            {session.clientName}
          </span>
          <span className="ml-2 text-xs text-slate-400">
            {session.assessmentType ?? 'Initial'} Assessment
          </span>
        </div>

        {/* Session status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.consentGranted && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(20,184,166,0.1)', color: '#0D9488' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Consent obtained
            </span>
          )}
          <span className="text-[11px] font-semibold text-slate-400"
            style={{ fontFamily: 'DM Mono, monospace' }}>
            {session.sectionsApproved ?? 0}/{session.totalInterviewSections ?? 10} approved
          </span>
        </div>
      </div>
      )}

      {/* Body: sidebar + cards */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — fixed 240px */}
        <div className="hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-stone-200 overflow-hidden"
          style={{ width: 272 }}>
          <SectionSidebar
            session={session}
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
          />
        </div>

        {/* Section cards — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <div className="max-w-2xl mx-auto space-y-3">
            {SECTION_ORDER.map((key, idx) => (
              <div key={key} id={`section-card-${key}`}>
                <SectionCard
                  clientId={clientId}
                  client={client}
                  sectionKey={key}
                  sectionIndex={idx + 1}
                  session={session}
                  setClients={setClients}
                  currentUser={currentUser}
                  isExpanded={expandedSections.includes(key)}
                  onToggle={() => handleToggle(key)}
                  transcriptVisible={!!transcriptVisible[key]}
                  onTranscriptToggle={() => handleTranscriptToggle(key)}
                  onRecordStart={handleRecordStart}
                  addNotif={addNotif}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Consent gate overlay */}
      {consentPending && (
        <ConsentGate
          clientId={clientId}
          setClients={setClients}
          onClose={handleConsentClose}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import RevertConfirm from './RevertConfirm.jsx';
import { setApprovalState, revertToAiOriginal } from '../assessmentStore.js';

export default function ActionRow({ clientId, sectionKey, section, setClients }) {
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  const approvalState = section?.approvalState ?? 'pending';
  const hasAiOriginal = !!(section?.aiOriginalContent);

  // Structured sections are approvable when they have any data, even without draftContent
  const hasCaregiverContent = sectionKey === 'caregiver_training' && !!(
    (section?.caregiverBaselines?.premack_baseline       != null && section?.caregiverBaselines?.premack_baseline       !== '') ||
    (section?.caregiverBaselines?.reinforcement_baseline != null && section?.caregiverBaselines?.reinforcement_baseline !== '') ||
    section?.trainingFormat?.length > 0 ||
    section?.trainingBarriers?.trim() ||
    section?.caregiverStrengths?.trim()
  );

  const hasSkillGoals     = sectionKey === 'skill_acquisitions' && (section?.skillGoals?.length > 0);
  const hasBehaviorTargets= sectionKey === 'behavior_targets'   && (section?.behaviorTargets?.length > 0);

  const hasContent = !!(section?.draftContent?.trim()) || hasCaregiverContent || hasSkillGoals || hasBehaviorTargets;
  const isApproved    = approvalState === 'approved';
  const isSkipped     = approvalState === 'skipped';

  // Show Revert whenever an AI original exists and the current content differs from it
  const canRevert = hasAiOriginal && section?.draftContent !== section?.aiOriginalContent;

  const approve  = () => setApprovalState(setClients, clientId, sectionKey, 'approved');
  const unapprove= () => setApprovalState(setClients, clientId, sectionKey, 'pending');
  const skip     = () => setApprovalState(setClients, clientId, sectionKey, 'skipped');
  const unskip   = () => setApprovalState(setClients, clientId, sectionKey, 'pending');

  const handleRevert = () => {
    revertToAiOriginal(setClients, clientId, sectionKey);
    setShowRevertConfirm(false);
  };

  return (
    <div className="flex flex-col gap-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {showRevertConfirm && (
        <RevertConfirm
          onConfirm={handleRevert}
          onCancel={() => setShowRevertConfirm(false)}
        />
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {/* Revert to AI — whenever current content differs from the AI original */}
        {canRevert && !showRevertConfirm && (
          <button
            onClick={() => setShowRevertConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-500 bg-white hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Revert to AI
          </button>
        )}

        {/* Skip / Un-skip — always available when not yet approved */}
        {!isApproved && (
          isSkipped ? (
            <button onClick={unskip}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-slate-600 bg-stone-100 hover:bg-stone-200 transition-all">
              Un-skip
            </button>
          ) : (
            <button onClick={skip}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-500 bg-white hover:border-stone-300 hover:bg-stone-50 transition-all">
              Skip
            </button>
          )
        )}

        <div className="flex-1"/>

        {/* Un-approve */}
        {isApproved && (
          <button onClick={unapprove}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 text-slate-500 bg-white hover:border-stone-300 transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Un-approve
          </button>
        )}

        {/* Approve */}
        {!isApproved && !isSkipped && hasContent && (
          <button onClick={approve}
            data-testid={`approve-section-${sectionKey}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white hover:opacity-90 transition-opacity"
            style={{ background: '#0D9488' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Approve
          </button>
        )}
      </div>
    </div>
  );
}

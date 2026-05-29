const AlertTriangle = () => (
  <svg width={13} height={13} fill="none" stroke="#FBBF24" strokeWidth={2} viewBox="0 0 24 24"
    style={{ flexShrink: 0, marginTop: 1 }}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
  </svg>
);

export const ConflictFlag = ({ section }) => {
  if (!section?.hasConflict) return null;
  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5"
      style={{
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
      }}
    >
      <AlertTriangle />
      <p className="text-[12px]" style={{ color: '#92400E' }}>
        This section contains data that may conflict with the transcript. Review carefully.
      </p>
    </div>
  );
};

export default ConflictFlag;

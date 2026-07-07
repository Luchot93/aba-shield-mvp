import React, { useState, useRef, useEffect } from 'react';
import { setTranscript, setRecordingState, setRecordingDuration } from '../assessmentStore.js';
import { FLAGS } from '../../../constants/featureFlags.js';

// ─── Transcribe via server proxy ─────────────────────────────────────────────
// In mock mode (DEV_MOCK_TRANSCRIPTION=true in .env.local):
//   → server returns a fake clinical transcript after ~1.8s, zero API cost
// In real mode (DEV_MOCK_TRANSCRIPTION=false):
//   → server uploads audio to AssemblyAI, polls, returns text
//   → hard minute cap enforced server-side; key never reaches the browser
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeAudio(audioBlob, durationSeconds) {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'content-type': audioBlob.type || 'audio/webm',
      'x-recording-seconds': String(Math.ceil(durationSeconds)),
    },
    body: audioBlob,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Server error ${res.status}`);
  }

  return data.text;
}

// ─── Component ────────────────────────────────────────────────────────────────

// Flag gate lives in a hook-free wrapper so the implementation (which uses
// hooks) is only ever mounted when voice capture is enabled — keeps hook order
// stable and avoids ever calling /api/transcribe when the feature is off.
export default function RecordButton(props) {
  if (!FLAGS.VOICE_CAPTURE) return null;
  return <RecordButtonImpl {...props} />;
}

function RecordButtonImpl({
  clientId,
  sectionKey,
  session,
  setClients,
  addNotif,
  onConsentNeeded,
}) {
  const section      = session?.sections?.[sectionKey];
  const recordingState = section?.recordingState ?? 'idle';

  const [elapsed,  setElapsed]  = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const elapsedRef       = useRef(0); // stable ref for onstop closure

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current  = [];
      elapsedRef.current = 0;

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        setRecordingState(setClients, clientId, sectionKey, 'saving');
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const text = await transcribeAudio(blob, elapsedRef.current);
          setTranscript(setClients, clientId, sectionKey, text);
        } catch (err) {
          setErrorMsg(err.message);
          setRecordingState(setClients, clientId, sectionKey, 'idle');
        }
      };

      mr.start();
      setElapsed(0);
      setRecordingState(setClients, clientId, sectionKey, 'recording');

      timerRef.current = setInterval(() => {
        setElapsed(s => {
          const next = s + 1;
          elapsedRef.current = next;
          setRecordingDuration(setClients, clientId, sectionKey, next);
          return next;
        });
      }, 1000);
    } catch {
      setErrorMsg('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleClick = () => {
    if (recordingState === 'recording') { stopRecording(); return; }
    if (!session?.consentGranted)       { onConsentNeeded(sectionKey); return; }
    startRecording();
  };

  const formatTime = s => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const isSaving    = recordingState === 'saving';
  const isRecording = recordingState === 'recording';
  const isDone      = recordingState === 'transcript_ready';

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleClick}
        disabled={isSaving}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
          disabled:opacity-50 disabled:cursor-not-allowed ${
          isRecording
            ? 'text-white'
            : isDone
            ? 'border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'
            : 'border border-stone-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700'
        }`}
        style={isRecording ? { background: '#DC2626' } : {}}>

        {isSaving ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Processing…
          </>
        ) : isRecording ? (
          <>
            <span className="w-2 h-2 rounded-sm bg-white flex-shrink-0"/>
            Stop · {formatTime(elapsed)}
          </>
        ) : isDone ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Transcript ready · Re-record
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
            </svg>
            Record interview
          </>
        )}
      </button>

      {isRecording && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
          <span className="text-xs text-slate-500">Recording in progress — mock mode active</span>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-red-600 max-w-xs leading-snug">{errorMsg}</p>
      )}
    </div>
  );
}

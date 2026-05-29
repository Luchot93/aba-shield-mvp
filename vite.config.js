import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ─── Collect streaming request body into a Buffer ────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── Transcription proxy plugin ──────────────────────────────────────────────
//
// POST /api/transcribe
//   Request:  audio blob in body + X-Recording-Seconds header (integer)
//   Response: { text: string } | { error: string }
//
// DEV_MOCK_TRANSCRIPTION=true  → returns a realistic fake transcript instantly (no API call)
// DEV_MOCK_TRANSCRIPTION=false → uses AssemblyAI async REST API with a hard minute cap
//
// The API key (ASSEMBLYAI_API_KEY) never leaves the server process.
// ─────────────────────────────────────────────────────────────────────────────

let totalSecondsUsed = 0; // resets every time the dev server restarts

const MOCK_TRANSCRIPTS = [
  "Caregiver reports that the client has been engaging in frequent tantrum behavior at home, primarily during transitions between preferred and non-preferred activities. Duration typically ranges from five to fifteen minutes. Self-injurious behavior in the form of head-hitting has been observed approximately three times per week.",
  "Client demonstrates limited expressive language, primarily using single words and some two-word combinations to request preferred items. Receptive language appears stronger; client follows one and two-step instructions consistently with familiar caregivers. AAC device has been trialed but compliance is inconsistent.",
  "Caregiver describes significant feeding challenges. Client currently accepts fewer than ten foods, all of which are crunchy in texture. Mealtimes are described as highly stressful. Client has never been evaluated by a feeding specialist. Family is open to a referral.",
  "Client is fully toilet trained for urination but continues to have bowel-related accidents approximately once per week. Caregiver reports client resists sitting on the toilet for extended periods. No sensory equipment has been trialed. Client is able to manage clothing independently.",
  "School reports that the client is performing below grade level in reading and math. Client is currently in a self-contained classroom with six students and two paraprofessionals. An IEP is in place with goals targeting communication, social skills, and academic readiness. Most recent evaluation was conducted eighteen months ago.",
];

const assemblyTranscribePlugin = () => ({
  name: 'assembly-transcribe',
  configureServer(server) {
    server.middlewares.use('/api/transcribe', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const isMock     = process.env.DEV_MOCK_TRANSCRIPTION !== 'false';
      const maxSeconds = (parseInt(process.env.MAX_TRANSCRIPTION_MINUTES) || 5) * 60;
      const recSeconds = parseInt(req.headers['x-recording-seconds'] || '0', 10);

      // ── MOCK MODE ────────────────────────────────────────────────────────────
      if (isMock) {
        // Simulate a short processing delay so the UI states feel real
        await new Promise(r => setTimeout(r, 1800));
        const text = MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
        res.end(JSON.stringify({ text, mock: true }));
        return;
      }

      // ── REAL MODE — hard minute cap ──────────────────────────────────────────
      const apiKey = process.env.ASSEMBLYAI_API_KEY;
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'ASSEMBLYAI_API_KEY not set in .env.local' }));
        return;
      }

      if (totalSecondsUsed + recSeconds > maxSeconds) {
        const usedMin  = (totalSecondsUsed  / 60).toFixed(1);
        const limitMin = (maxSeconds        / 60).toFixed(0);
        res.statusCode = 429;
        res.end(JSON.stringify({
          error: `Dev transcription cap reached (${usedMin}/${limitMin} min used). Restart the dev server to reset, or raise MAX_TRANSCRIPTION_MINUTES in .env.local.`,
        }));
        return;
      }

      try {
        const audioBuffer = await readBody(req);

        // 1. Upload audio
        const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: {
            authorization: apiKey,
            'content-type': 'application/octet-stream',
          },
          body: audioBuffer,
        });
        if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
        const { upload_url } = await uploadRes.json();

        // 2. Request transcript
        const txRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: { authorization: apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ audio_url: upload_url }),
        });
        if (!txRes.ok) throw new Error(`Transcript request failed: ${txRes.status}`);
        const { id } = await txRes.json();

        // 3. Poll (max 120s)
        let text = null;
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const poll   = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
            headers: { authorization: apiKey },
          });
          const result = await poll.json();
          if (result.status === 'completed') { text = result.text; break; }
          if (result.status === 'error')     throw new Error(result.error);
        }
        if (!text) throw new Error('Transcription timed out after 120s');

        // 4. Commit usage only on success
        totalSecondsUsed += recSeconds;
        console.log(`[AssemblyAI] Transcribed ${recSeconds}s — total used: ${(totalSecondsUsed / 60).toFixed(1)}/${(maxSeconds / 60).toFixed(0)} min`);

        res.end(JSON.stringify({ text }));
      } catch (err) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), assemblyTranscribePlugin()],
  base: '/ABA_Shield_V0/',
});

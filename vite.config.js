import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite only exposes .env.local values to client code via import.meta.env.
// The dev-server middleware below (assemblyTranscribePlugin, anthropicPlugin)
// runs in Node and reads process.env directly, so .env.local must be loaded
// into process.env here too — otherwise VITE_DEMO_MODE, ANTHROPIC_API_KEY, etc.
// are always undefined server-side regardless of what .env.local says.
const fileEnv = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

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

// ─── Anthropic Claude proxy plugin ──────────────────────────────────────────
//
// POST /api/generate
//   Request:  { sectionKey, sectionPrompt, clientName, sectionTitle }
//   Response: { content: string } | { error: string }
//
// POST /api/generate-definition
//   Request:  { skillName: string }
//   Response: { text: string } | { error: string }
//
// VITE_DEMO_MODE=true  → returns fast mock responses, zero API cost
// VITE_DEMO_MODE=false → uses Claude API (requires ANTHROPIC_API_KEY in .env.local)
//
// DEV_MOCK_GENERATE=true → (only reachable once VITE_DEMO_MODE=false) short-circuits
//   /api/generate with canned per-section content instead of calling Anthropic —
//   for exercising the full generateDraft() → patchSection → persist wiring without
//   spending API credits or requiring a real ANTHROPIC_API_KEY.
//
// The API key (ANTHROPIC_API_KEY) never leaves the server process — no VITE_ prefix,
// so it is never injected into the browser bundle.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_DEFINITIONS = {
  default: 'The target skill is operationally defined as the learner independently completing the specified task across three consecutive probe sessions with no more than one gestural prompt, as measured by direct observation using a task-analysis data sheet.',
};

const anthropicPlugin = () => ({
  name: 'anthropic-generate',
  configureServer(server) {

    // ── /api/generate-definition ─────────────────────────────────────────────
    server.middlewares.use('/api/generate-definition', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const isDemoMode = process.env.VITE_DEMO_MODE !== 'false';

      // ── DEMO MODE ───────────────────────────────────────────────────────────
      if (isDemoMode) {
        await new Promise(r => setTimeout(r, 600)); // feel like real latency
        const body = JSON.parse((await readBody(req)).toString());
        const skill = body.skillName || '';
        const text  = DEMO_DEFINITIONS[skill] ?? DEMO_DEFINITIONS.default;
        res.end(JSON.stringify({ text, demo: true }));
        return;
      }

      // ── REAL MODE ───────────────────────────────────────────────────────────
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env.local' }));
        return;
      }

      try {
        const { skillName } = JSON.parse((await readBody(req)).toString());

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 300,
            system: 'You are a Board Certified Behavior Analyst writing precise operational definitions for ABA skill acquisition programs. Write in third person. Be clinical, measurable, and concise.',
            messages: [
              {
                role: 'user',
                content: `Write an operational definition for this ABA target skill: "${skillName}". The definition must describe exactly what the learner does that counts as the behavior, how it is measured, and the criteria for mastery. 2–3 sentences maximum.`,
              },
            ],
          }),
        });

        if (!claudeRes.ok) {
          const err = await claudeRes.text();
          throw new Error(`Anthropic API error ${claudeRes.status}: ${err}`);
        }

        const data = await claudeRes.json();
        const text = data.content?.[0]?.text ?? '';
        res.end(JSON.stringify({ text }));
      } catch (err) {
        console.error('[Anthropic /api/generate-definition]', err.message);
        res.statusCode = 502;
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // ── /api/generate ────────────────────────────────────────────────────────
    server.middlewares.use('/api/generate', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const isDemoMode = process.env.VITE_DEMO_MODE !== 'false';

      // ── DEMO MODE — this endpoint should not be called in demo mode,
      //    but guard here so a stale call never silently fails
      if (isDemoMode) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'VITE_DEMO_MODE=true — /api/generate is not available in demo mode. Set VITE_DEMO_MODE=false to enable real AI generation.' }));
        return;
      }

      // ── DEV MOCK — bypass Anthropic entirely to test the wiring for free ──────
      if (process.env.DEV_MOCK_GENERATE === 'true') {
        const { sectionKey, sectionTitle } = JSON.parse((await readBody(req)).toString());
        await new Promise(r => setTimeout(r, 500)); // feel like real latency
        const content = `[DEV MOCK DRAFT — ${sectionTitle}] This is a placeholder clinical narrative generated by DEV_MOCK_GENERATE instead of the Anthropic API, used to verify the generation pipeline end to end.`;
        console.log(`[DEV_MOCK_GENERATE] ${sectionKey} — ${content.length} chars`);
        res.end(JSON.stringify({ content, mock: true }));
        return;
      }

      // ── REAL MODE ───────────────────────────────────────────────────────────
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env.local' }));
        return;
      }

      try {
        const { sectionKey, sectionPrompt, clientName, sectionTitle } = JSON.parse((await readBody(req)).toString());

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: [
              'You are a licensed Board Certified Behavior Analyst (BCBA) writing a formal, billable ABA assessment report.',
              'Write in professional clinical prose. Third person. Past tense for history; present tense for current status.',
              'Use specific observable behavioral language. No filler phrases. No hedging.',
              'Format as flowing paragraphs — no bullet points, no headers, no markdown.',
              'Each section should be 150–400 words unless the data warrants more.',
            ].join(' '),
            messages: [
              {
                role: 'user',
                content: [
                  `Client: ${clientName}`,
                  `Section: ${sectionTitle}`,
                  '',
                  'Write the clinical narrative for this section based on the following structured intake data:',
                  '',
                  sectionPrompt,
                ].join('\n'),
              },
            ],
          }),
        });

        if (!claudeRes.ok) {
          const err = await claudeRes.text();
          throw new Error(`Anthropic API error ${claudeRes.status}: ${err}`);
        }

        const data    = await claudeRes.json();
        const content = data.content?.[0]?.text ?? '';
        console.log(`[Anthropic /api/generate] ${sectionKey} — ${content.length} chars`);
        res.end(JSON.stringify({ content }));
      } catch (err) {
        console.error('[Anthropic /api/generate]', err.message);
        res.statusCode = 502;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), assemblyTranscribePlugin(), anthropicPlugin()],
  base: '/aba-shield-mvp/',
  server: { port: 5175 },
});

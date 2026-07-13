import { verifyAuth } from './_lib/verifyAuth.js';
import { checkRateLimit } from './_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (!user) {
    console.error(`[Anthropic /api/generate] auth rejected: ${authError}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ok = await checkRateLimit(supabase, user.id, 'generate', 30);
  if (!ok) {
    console.warn(`[Anthropic /api/generate] rate limit reached for user ${user.id}`);
    return res.status(429).json({ error: 'Rate limit reached. Please wait a few minutes and try again.' });
  }

  const { sectionKey, sectionPrompt, clientName, sectionTitle } = req.body;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: 'You are a licensed BCBA writing a clinical Initial Behavioral Assessment for health insurance submission. Use formal clinical language. Be specific, evidence-based, and complete. Output only the section content — no disclaimers, no meta-commentary, no markdown formatting.',
        messages: [{ role: 'user', content: sectionPrompt }],
      }),
    });
  } catch (err) {
    console.error(`[Anthropic /api/generate] ${sectionKey} — network error:`, err);
    return res.status(502).json({ error: 'Draft generation failed. Please try again.' });
  }

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message ?? `Anthropic API returned ${response.status}`;
    console.error(`[Anthropic /api/generate] ${sectionKey} — ${response.status}: ${errMsg}`);
    return res.status(502).json({ error: 'Draft generation failed. Please try again.' });
  }

  const content = data.content?.[0]?.text ?? '';
  console.log(`[Anthropic /api/generate] ${sectionKey} — ${content.length} chars`);
  res.status(200).json({ content });
}

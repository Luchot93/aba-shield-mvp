import { verifyAuth } from './_lib/verifyAuth.js';
import { checkRateLimit } from './_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (!user) {
    console.error(`[Anthropic /api/generate-definition] auth rejected: ${authError}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ok = await checkRateLimit(supabase, user.id, 'generate-definition', 60);
  if (!ok) {
    console.warn(`[Anthropic /api/generate-definition] rate limit reached for user ${user.id}`);
    return res.status(429).json({ error: 'Rate limit reached. Please wait a few minutes and try again.' });
  }

  const { skillName } = req.body;

  if (!skillName || !String(skillName).trim()) {
    return res.status(400).json({ error: 'skillName is required' });
  }

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
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: 'You are a Board Certified Behavior Analyst writing precise operational definitions for ABA skill acquisition programs. Write in third person. Be clinical, measurable, and concise.',
        messages: [{
          role: 'user',
          content: `Write an operational definition for this ABA target skill: "${skillName}". The definition must describe exactly what the learner does that counts as the behavior, how it is measured, and the criteria for mastery. 2–3 sentences maximum.`,
        }],
      }),
    });
  } catch (err) {
    console.error(`[Anthropic /api/generate-definition] "${skillName}" — network error:`, err);
    return res.status(502).json({ error: 'Definition generation failed. Please try again.' });
  }

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message ?? `Anthropic API returned ${response.status}`;
    console.error(`[Anthropic /api/generate-definition] "${skillName}" — ${response.status}: ${errMsg}`);
    return res.status(502).json({ error: 'Definition generation failed. Please try again.' });
  }

  const text = data.content?.[0]?.text ?? '';
  console.log(`[Anthropic /api/generate-definition] "${skillName}" — ${text.length} chars`);
  res.status(200).json({ text });
}

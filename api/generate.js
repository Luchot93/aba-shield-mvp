export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
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
    return res.status(502).json({ error: `Network error contacting Anthropic: ${err.message}` });
  }

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message ?? `Anthropic API returned ${response.status}`;
    console.error(`[Anthropic /api/generate] ${sectionKey} — ${response.status}: ${errMsg}`);
    return res.status(response.status).json({ error: errMsg });
  }

  const content = data.content?.[0]?.text ?? '';
  console.log(`[Anthropic /api/generate] ${sectionKey} — ${content.length} chars`);
  res.status(200).json({ content });
}

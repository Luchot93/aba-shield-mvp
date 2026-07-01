export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { sectionKey, sectionPrompt, clientName, sectionTitle } = req.body;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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

  const data = await response.json();
  const content = data.content?.[0]?.text ?? '';
  console.log(`[Anthropic /api/generate] ${sectionKey} — ${content.length} chars`);
  res.status(200).json({ content });
}

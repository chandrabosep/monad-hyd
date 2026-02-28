import OpenAI from "openai";

const GROQ_MODEL = "openai/gpt-oss-20b";

const client = new OpenAI({
	apiKey: process.env.GROQ_API_KEY,
	baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `You convert social media posts into clear yes/no prediction questions for a betting pool.

Rules:
- Output ONLY the question, nothing else. No quotes, no preamble, no explanation.
- The question must be answerable with Yes or No.
- Use FUTURE tense: "Will X happen?" not "Did X happen?" or "Is X true?". Predictions are about future outcomes.
- Keep it under 150 characters.
- Be specific and unambiguous. ALWAYS extract the actual topic/subject from the post.
- If the post is already a yes/no question, rewrite in future tense and clean it up (remove @mentions).
- NEVER output a generic "Will this happen?" - always use the real content. Examples:
  - "BTC to 100k" → "Will BTC reach $100k?"
  - "eth gonna moon" → "Will ETH price moon?"
  - "thinking about buying" → "Will I buy?"
- Only if the post is literally just "hey", "lol", or emoji with no content, output: "Will this happen?"
- Remove all @mentions from the output.`;

/**
 * Uses Groq AI to convert tweet text into a yes/no prediction question.
 * Falls back to a simple parse if GROQ_API_KEY is not set or AI fails.
 */
export async function tweetToQuestion(tweetText: string): Promise<string> {
	const text = tweetText.replace(/@\w+/g, "").trim();
	if (!text || text.length < 2) return "Will this happen?";

	const apiKey = process.env.GROQ_API_KEY;
	if (!apiKey) {
		return fallbackParse(text);
	}

	try {
		const completion = await client.chat.completions.create({
			model: GROQ_MODEL,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: text },
			],
			max_tokens: 100,
			temperature: 0.3,
		});

		const raw =
			completion.choices?.[0]?.message?.content?.trim() ?? "";
		const question = raw || fallbackParse(text);
		if (!question || question === "Will this happen?") {
			// Prefer actual tweet content over generic fallback
			const fromTweet = fallbackParse(text);
			if (fromTweet && fromTweet !== "Will this happen?") return fromTweet;
		}
		return (question || fallbackParse(text)).slice(0, 200);
	} catch (e) {
		console.error("[tweet-to-question] Groq API error:", e);
		return fallbackParse(text);
	}
}

function fallbackParse(text: string): string {
	const q = text.replace(/\s+/g, " ").trim();
	if (!q) return "Will this happen?";
	// Use actual tweet content - wrap short/incomplete phrases as "Will X happen?"
	if (q.length < 20 || (!q.endsWith("?") && !/\b(will|did|is|can|would)\b/i.test(q))) {
		const phrase = q.slice(0, 180).replace(/\?+$/, "").trim();
		if (phrase) return `Will ${phrase} happen?`;
	}
	if (q.endsWith("?")) return q.slice(0, 200);
	return q.slice(0, 197) + "?";
}

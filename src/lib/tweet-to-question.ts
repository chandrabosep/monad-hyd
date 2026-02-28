import OpenAI from "openai";

const GROQ_MODEL = "llama-3.3-70b-versatile";

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
- PRESERVE the EXACT names, tickers, tokens, and subjects from the post — do NOT substitute or invent alternatives.
- Be specific and unambiguous. ALWAYS extract the actual topic/subject from the post.
- If the post is already a yes/no question, rewrite in future tense and clean it up (remove @mentions).
- NEVER hallucinate or replace names. If the post says "Vitalik" use "Vitalik". If it says "MON" use "MON".
- NEVER output a generic "Will this happen?" - always use the real content. Examples:
  - "BTC to 100k" → "Will BTC reach $100k?"
  - "eth gonna moon" → "Will ETH price moon?"
  - "will vitalik beat mon" → "Will Vitalik beat MON?"
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

const OPTIONS_SYSTEM_PROMPT = `You format yes/no prediction questions into two clear options.

Output EXACTLY two lines in this format:
A) Yes, [restate the positive outcome - concise, under 80 chars]
B) No, [restate the negative outcome - concise, under 80 chars]

Example:
Question: Will a new stealth game be announced for the Switch 2 within one month of its release?
A) Yes, a new stealth game will be announced
B) No, no new stealth game will be announced

Output ONLY the two lines (A) and B)), nothing else. No quotes, no preamble.`;

/**
 * Converts a yes/no question into A) and B) option text for the reply.
 * Uses Groq when available; falls back to simple heuristic.
 */
export async function questionToOptions(
	question: string,
): Promise<{ optionA: string; optionB: string }> {
	const q = question.trim();
	if (!q) return { optionA: "Yes", optionB: "No" };

	const apiKey = process.env.GROQ_API_KEY;
	if (apiKey) {
		try {
			const completion = await client.chat.completions.create({
				model: GROQ_MODEL,
				messages: [
					{ role: "system", content: OPTIONS_SYSTEM_PROMPT },
					{ role: "user", content: `Question: ${q}` },
				],
				max_tokens: 120,
				temperature: 0.2,
			});
			const raw = completion.choices?.[0]?.message?.content?.trim() ?? "";
			const parsed = parseOptionsFromResponse(raw);
			if (parsed) return parsed;
		} catch (e) {
			console.error("[tweet-to-question] options Groq error:", e);
		}
	}

	return fallbackOptions(q);
}

function parseOptionsFromResponse(
	raw: string,
): { optionA: string; optionB: string } | null {
	const aMatch = raw.match(/A\)\s*(.+?)(?=\n|B\)|$)/is);
	const bMatch = raw.match(/B\)\s*(.+?)(?=\n|$)/is);
	if (aMatch && bMatch) {
		return {
			optionA: aMatch[1].trim().slice(0, 100),
			optionB: bMatch[1].trim().slice(0, 100),
		};
	}
	return null;
}

function fallbackOptions(question: string): { optionA: string; optionB: string } {
	const q = question.replace(/\?+$/, "").trim();
	// "Will X happen?" -> Yes: X will happen, No: no X
	const willMatch = q.match(/^Will\s+(.+)$/i);
	if (willMatch) {
		let rest = willMatch[1]
			.replace(/\bbe\b/g, "will be")
			.replace(/\bhave\b/g, "will have")
			.trim();
		const cap = rest.charAt(0).toUpperCase() + rest.slice(1);
		// "a new X" -> "no new X" for option B
		const forNo = rest.replace(/^(a|an)\s+/i, "no ");
		return {
			optionA: `Yes, ${cap}`,
			optionB: `No, ${forNo.charAt(0).toLowerCase() + forNo.slice(1)}`,
		};
	}
	return { optionA: "Yes", optionB: "No" };
}

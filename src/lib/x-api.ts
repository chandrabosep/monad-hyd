/**
 * X API (api.x.com/2) integration.
 * Read operations: Bearer token + fetch to https://api.x.com/2 (per official docs).
 * Write operations: OAuth 1.0a via twitter-api-v2 (user context required for posting).
 * @see https://docs.x.com/x-api/getting-started/make-your-first-request
 */

const X_API_BASE = "https://api.x.com/2";

/** Bearer token from Developer Console - used for read-only endpoints */
function getBearerToken(): string | null {
	return (
		process.env.X_API_BEARER_TOKEN ||
		process.env.BEARER_TOKEN ||
		process.env.bearer_token ||
		null
	);
}

const apiKey = process.env.X_API_KEY ?? process.env.consumer_key;
const apiSecret = process.env.X_API_SECRET ?? process.env.consumer_secret;
const accessToken = process.env.X_ACCESS_TOKEN;
const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

/** Response shape for a single tweet/post from X API v2 */
export interface XTweet {
	id: string;
	text?: string;
	author_id?: string;
	created_at?: string;
	public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number };
}

/** Response shape for X API v2 list of tweets */
export interface XTweetsResponse {
	data?: XTweet[];
	meta?: { next_token?: string; result_count?: number; newest_id?: string; oldest_id?: string };
	errors?: Array<{ message: string; parameter?: string }>;
}

/**
 * Make an authenticated GET request to the X API v2.
 * Uses Bearer token as per https://docs.x.com/x-api/getting-started/make-your-first-request
 */
export async function xApiGet<T = unknown>(
	path: string,
	params?: Record<string, string | number | undefined>,
): Promise<T> {
	const token = getBearerToken();
	if (!token) {
		throw new Error("X API Bearer token not configured (set X_API_BEARER_TOKEN or BEARER_TOKEN)");
	}
	const url = new URL(path.startsWith("http") ? path : `${X_API_BASE}${path}`);
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
		});
	}
	const res = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`X API ${res.status}: ${body || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

/**
 * Get user by username (read-only, Bearer token).
 * GET /2/users/by/username/:username
 */
export async function getXUserByUsername(username: string): Promise<{ data?: { id: string; name?: string; username?: string } }> {
	return xApiGet(`/users/by/username/${encodeURIComponent(username)}`);
}

/**
 * Get a single post/tweet by ID (read-only, Bearer token).
 * GET /2/tweets/:id?tweet.fields=created_at,public_metrics
 */
export async function getXTweet(tweetId: string, fields?: string[]): Promise<XTweetsResponse> {
	const tweetFields = fields?.length ? fields.join(",") : "created_at,author_id,text,public_metrics";
	return xApiGet(`/tweets/${tweetId}`, { "tweet.fields": tweetFields });
}

/**
 * Get mentions for a user (read-only, Bearer token).
 * GET /2/users/:id/mentions
 * Used for cron: find new @mentions and create pools.
 */
export async function getXUserMentions(
	userId: string,
	opts?: { max_results?: number; since_id?: string },
): Promise<XTweetsResponse> {
	const params: Record<string, string | number> = {
		"tweet.fields": "created_at,author_id,text",
		expansions: "author_id",
		max_results: opts?.max_results ?? 20,
	};
	if (opts?.since_id) params.since_id = opts.since_id;
	return xApiGet(`/users/${encodeURIComponent(userId)}/mentions`, params);
}

/** Whether read-only (Bearer) X API is configured */
export function isXReadConfigured(): boolean {
	return !!getBearerToken();
}

/** Read-only client for fetching mentions (Bearer token). Uses native fetch to api.x.com/2. */
export function getReadOnlyClient(): { getMentions: typeof getXUserMentions; getTweet: typeof getXTweet } | null {
	if (!getBearerToken()) return null;
	return {
		getMentions: getXUserMentions,
		getTweet: getXTweet,
	};
}

/** User-context client for posting replies (OAuth 1.0a) - requires twitter-api-v2 */
export function getWriteClient(): import("twitter-api-v2").TwitterApi | null {
	if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
	// Lazy load to avoid requiring twitter-api-v2 when only using read-only
	const { TwitterApi } = require("twitter-api-v2");
	return new TwitterApi({
		appKey: apiKey,
		appSecret: apiSecret,
		accessToken,
		accessSecret: accessTokenSecret,
	});
}

/** Whether write (post/reply) is configured - needs OAuth 1.0a credentials */
export function isXConfigured(): boolean {
	return !!(apiKey && apiSecret && accessToken && accessTokenSecret);
}

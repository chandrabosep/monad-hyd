import { NextResponse } from "next/server";
import { getWriteClient } from "@/lib/x-api";

/**
 * GET /api/x/verify
 * Verifies OAuth write credentials by fetching the authenticated user.
 * Use this to debug 401 errors - the response shows the exact X API error.
 */
export async function GET() {
	const client = getWriteClient();
	if (!client) {
		return NextResponse.json(
			{
				ok: false,
				error: "OAuth not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.",
			},
			{ status: 503 },
		);
	}

	try {
		const me = await client.v2.me();
		return NextResponse.json({
			ok: true,
			user: {
				id: me.data.id,
				username: me.data.username,
				name: me.data.name,
			},
			message: "OAuth credentials valid. This account will post replies.",
		});
	} catch (e: unknown) {
		const err = e as { data?: { detail?: string }; code?: number };
		const detail = err?.data?.detail ?? (typeof err?.data === "string" ? err.data : JSON.stringify(err?.data ?? err));
		console.error("[api/x/verify] error:", e);
		return NextResponse.json(
			{
				ok: false,
				error: "OAuth verification failed",
				code: err?.code,
				detail: detail || String(e),
				hint: "Use OAuth 1.0a Access Token and Secret (Keys and tokens > Access Token and Secret), NOT OAuth 2.0. Regenerate if needed.",
			},
			{ status: 401 },
		);
	}
}

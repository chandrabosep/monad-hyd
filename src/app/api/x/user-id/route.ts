import { NextResponse } from "next/server";
import { getXUserByUsername } from "@/lib/x-api";

/**
 * GET /api/x/user-id?username=Chandra_Bose31
 * Returns the numeric user ID for an X username. Use this for X_BOT_USER_ID.
 * Requires: X_API_BEARER_TOKEN
 */
export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const username = searchParams.get("username")?.replace("@", "");
	if (!username) {
		return NextResponse.json(
			{ error: "Missing ?username=..." },
			{ status: 400 },
		);
	}
	try {
		const res = await getXUserByUsername(username);
		const id = res.data?.id;
		if (!id) {
			return NextResponse.json(
				{ error: "User not found", username },
				{ status: 404 },
			);
		}
		return NextResponse.json({ username, id });
	} catch (e) {
		console.error("[api/x/user-id] error:", e);
		return NextResponse.json(
			{ error: String(e) },
			{ status: 500 },
		);
	}
}

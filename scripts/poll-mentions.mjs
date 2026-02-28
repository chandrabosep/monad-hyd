#!/usr/bin/env node
/**
 * Local dev / demo poller for /api/x/mentions.
 * Reads CRON_INTERVAL_MINUTES from .env and hits the endpoint on that interval.
 * Passes CRON_SECRET as Bearer token when configured.
 *
 * Usage:  node scripts/poll-mentions.mjs
 *   or via npm:  npm run sync
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "";
const INTERVAL_MINUTES = Math.max(
	1,
	parseInt(process.env.CRON_INTERVAL_MINUTES || "5", 10),
);
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const ENDPOINT = `${APP_URL}/api/x/mentions`;

const headers = {
	"Content-Type": "application/json",
	...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
};

async function sync() {
	const start = Date.now();
	try {
		const res = await fetch(ENDPOINT, { headers });
		const body = await res.json().catch(() => ({}));
		const elapsed = Date.now() - start;
		if (res.ok) {
			console.log(
				`[poll-mentions] ${new Date().toISOString()}  fetched=${body.fetched ?? "?"} processed=${body.processed ?? "?"} (${elapsed}ms)`,
			);
		} else {
			console.error(
				`[poll-mentions] ${new Date().toISOString()}  HTTP ${res.status}  ${body.error ?? ""}  (${elapsed}ms)`,
			);
		}
	} catch (err) {
		const elapsed = Date.now() - start;
		console.error(
			`[poll-mentions] ${new Date().toISOString()}  fetch failed: ${err.message}  (${elapsed}ms)`,
		);
	}
}

console.log(
	`[poll-mentions] starting — polling ${ENDPOINT} every ${INTERVAL_MINUTES} min`,
);

// Run once immediately, then on interval
sync();
setInterval(sync, INTERVAL_MS);

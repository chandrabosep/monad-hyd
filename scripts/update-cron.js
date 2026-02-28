#!/usr/bin/env node
/**
 * Updates vercel.json cron schedule from CRON_INTERVAL_MINUTES env var.
 * Run before build. Vercel cron uses 5-field format (no seconds); min interval is 1 minute.
 */
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const interval = Math.max(1, parseInt(process.env.CRON_INTERVAL_MINUTES || "1", 10));
const schedule = interval === 1 ? "* * * * *" : `*/${interval} * * * *`;

const config = {
	crons: [{ path: "/api/x/mentions", schedule }],
};

const outPath = path.join(__dirname, "..", "vercel.json");
fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + "\n");
console.log(`[update-cron] vercel.json updated: schedule=${schedule} (every ${interval} min)`);

#!/usr/bin/env node
/**
 * OAuth 1.0a token generator for X API
 * Run: node scripts/get-oauth-tokens.mjs
 *
 * This opens a browser for you to authorize the app as @Chandra_Bose31.
 * After authorizing, paste the PIN back to get your Access Token and Secret.
 *
 * Requires: X_API_KEY and X_API_SECRET in .env (Consumer Keys from Developer Portal)
 */

import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";
import { createInterface } from "readline";

const apiKey = process.env.X_API_KEY ?? process.env.consumer_key;
const apiSecret = process.env.X_API_SECRET ?? process.env.consumer_secret;

if (!apiKey || !apiSecret) {
  console.error("Missing X_API_KEY and X_API_SECRET in .env");
  console.error("Get these from X Developer Portal > Keys and tokens > Consumer Keys (NOT OAuth 2.0)");
  process.exit(1);
}

const requestClient = new TwitterApi({ appKey: apiKey, appSecret: apiSecret });

console.log("\n=== X OAuth 1.0a Token Generator ===\n");
console.log("1. Open the URL below in your browser");
console.log("2. Sign in as @Chandra_Bose31 (the account that will post replies)");
console.log("3. Approve the app and copy the PIN shown\n");

let url, oauth_token, oauth_token_secret;
try {
  const link = await requestClient.generateAuthLink("oob");
  url = link.url;
  oauth_token = link.oauth_token;
  oauth_token_secret = link.oauth_token_secret;
} catch (err) {
  console.error("\n--- Request token failed (401) ---");
  console.error("Your API Key/Secret (Consumer Keys) are invalid or wrong type.");
  console.error("1. Use API Key + API Key Secret from 'Consumer Keys' (NOT OAuth 2.0 Client ID/Secret)");
  console.error("2. Add callback URL 'oob' in app Settings > Callback URI");
  console.error("3. See docs/X_API_SETUP.md for full guide");
  process.exit(1);
}

console.log("Open this URL in your browser:\n");
console.log(url);
console.log("\n");
try {
  const { exec } = await import("child_process");
  const { platform } = await import("os");
  const cmd = platform() === "win32" ? "start" : platform() === "darwin" ? "open" : "xdg-open";
  exec(`${cmd} "${url}"`);
} catch {
  // ignore - user can open manually
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pin = await new Promise((resolve) => rl.question("Enter the PIN from the page: ", resolve));
rl.close();

// Must use request tokens for the login exchange
const tempClient = new TwitterApi({
  appKey: apiKey,
  appSecret: apiSecret,
  accessToken: oauth_token,
  accessSecret: oauth_token_secret,
});

const { accessToken, accessSecret } = await tempClient.login(pin);

console.log("\n=== Add these to your .env ===\n");
console.log(`X_ACCESS_TOKEN="${accessToken}"`);
console.log(`X_ACCESS_TOKEN_SECRET="${accessSecret}"`);
console.log("\nThen run: curl http://localhost:3000/api/x/verify\n");

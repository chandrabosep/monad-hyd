# X API Setup for Posting Replies

If you get **401 Unauthorized** or **"Request token failed"**, follow these steps.

## 0. Verify Credentials

After updating `.env`, **restart the dev server** (env vars load at startup). Then:

```bash
curl http://localhost:3000/api/x/verify
```

- **Success** (`ok: true`): OAuth is valid; this account will post replies.
- **401 / fail**: Credentials are wrong. Fix keys and tokens, restart, try again.

## 1. Use the Correct Keys

In [X Developer Portal](https://developer.x.com/) → Your App → **Keys and tokens**:

| Use this | NOT this |
|----------|----------|
| **Consumer Keys** → API Key, API Key Secret | OAuth 2.0 → Client ID, Client Secret |
| Section: "Consumer Keys" or "API Key and Secret" | Section: "OAuth 2.0 Keys" |

- `X_API_KEY` = **API Key** (from Consumer Keys)
- `X_API_SECRET` = **API Key Secret** (from Consumer Keys)

OAuth 2.0 Client ID/Secret will NOT work for posting tweets.

## 2. Add Callback URL for PIN Mode

For `npm run x:token` to work, add the callback URL:

1. Go to your app → **Settings** (or **User authentication settings**)
2. Under **Callback URI / Redirect URL**, add: `oob`
3. Save

## 3. App Permissions

- Set **App permissions** to **Read and write**
- If you change this, regenerate the Access Token

## 4. Regenerate if Needed

If keys were regenerated, old tokens are invalid. Regenerate:
- **Consumer Keys** (API Key/Secret) if request token fails
- **Access Token and Secret** after running `npm run x:token` successfully

## 5. Run Token Generator

```bash
npm run x:token
```

This opens a browser. Sign in as @Chandra_Bose31, approve, enter the PIN. Copy the output to `.env`.

## 6. Restart After Changing .env

Next.js loads env vars at startup. After editing `.env`, restart:

```bash
# Ctrl+C to stop, then:
npm run dev
```

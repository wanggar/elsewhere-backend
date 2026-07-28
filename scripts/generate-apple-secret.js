/**
 * Generates the Apple client secret JWT required by Supabase.
 *
 * USAGE:
 *   1. Fill in the four variables below
 *   2. Run:  node scripts/generate-apple-secret.js
 *   3. Copy the printed JWT into Supabase → Authentication → Apple → Secret Key
 *
 * The secret expires in 6 months. Re-run this script to renew it.
 */

const crypto = require("crypto");

// ── Fill these in ─────────────────────────────────────────────────────────────

const TEAM_ID   = "XXXXXXXXXX";   // 10-char Team ID from developer.apple.com → Account → Membership
const KEY_ID    = "XXXXXXXXXX";   // 10-char Key ID shown when you created the .p8 key
const BUNDLE_ID = "com.elizabeth.elsewhere"; // Your App's Bundle ID

// Paste the full contents of your .p8 file here, including the header/footer lines.
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
PASTE_YOUR_P8_CONTENTS_HERE
-----END PRIVATE KEY-----`;

// ── Script (do not edit below this line) ─────────────────────────────────────

function base64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

const now = Math.floor(Date.now() / 1000);
const exp = now + 15_777_000; // 6 months in seconds

const header  = base64url(JSON.stringify({ alg: "ES256", kid: KEY_ID }));
const payload = base64url(JSON.stringify({
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: BUNDLE_ID,
}));

const signingInput = `${header}.${payload}`;

const sign = crypto.createSign("SHA256");
sign.update(signingInput);
// dsaEncoding: "ieee-p1363" produces raw R||S bytes (required for JWT ES256)
const sigDer = sign.sign({ key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" });

const jwt = `${signingInput}.${base64url(sigDer)}`;

const expiresDate = new Date(exp * 1000).toLocaleDateString("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

console.log("\n─────────────────────────────────────────────────────");
console.log("  Apple Client Secret JWT");
console.log("─────────────────────────────────────────────────────");
console.log(jwt);
console.log("─────────────────────────────────────────────────────");
console.log(`  Expires: ${expiresDate}`);
console.log("  Paste this into Supabase → Authentication → Apple → Secret Key (for OAuth)");
console.log("─────────────────────────────────────────────────────\n");

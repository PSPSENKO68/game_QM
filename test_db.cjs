const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
const matchUrl = content.match(/VITE_SUPABASE_URL\s*=\s*['"]?([^'"\n]+)['"]?/);
const matchKey = content.match(/VITE_SUPABASE_ANON_KEY\s*=\s*['"]?([^'"\n]+)['"]?/);

if (!matchUrl || !matchKey) {
  console.log("Could not parse supabase credentials from .env");
  process.exit(1);
}
const url = matchUrl[1];
const key = matchKey[1];

async function run() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 1. Try to upsert
  console.log("Upserting randomize_questions...");
  let res = await fetch(`${url}/rest/v1/settings`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ key: 'randomize_questions', value: 'ON' })
  });
  console.log("Upsert status:", res.status);
  console.log("Upsert body:", await res.text());

  // 2. Try to get
  res = await fetch(`${url}/rest/v1/settings?key=eq.randomize_questions`, { headers });
  console.log("Get status:", res.status);
  console.log("Get body:", await res.text());
}
run();

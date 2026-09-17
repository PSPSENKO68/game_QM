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
  };

  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${url}/rest/v1/steal_history?select=*`, { headers });
  const data = await res.json();
  console.log('Steal History Data:', JSON.stringify(data, null, 2));
}

run();

const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
const matchUrl = content.match(/VITE_SUPABASE_URL\s*=\s*['"]?([^'"\n]+)['"]?/);
const matchKey = content.match(/VITE_SUPABASE_ANON_KEY\s*=\s*['"]?([^'"\n]+)['"]?/);

const url = matchUrl[1];
const key = matchKey[1];

async function run() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${url}/rest/v1/quizzes?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();

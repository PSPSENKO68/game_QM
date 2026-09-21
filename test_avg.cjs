const fs = require('fs');
const content = fs.readFileSync('check_admin.js', 'utf8');
const matchUrl = content.match(/const supabaseUrl = process\.env\.VITE_SUPABASE_URL || ['"]([^'"]+)['"]/);
const matchKey = content.match(/const supabaseKey = process\.env\.VITE_SUPABASE_ANON_KEY || ['"]([^'"]+)['"]/);

const authContent = fs.readFileSync('auth.js', 'utf8');
// just get any url from auth.js if we can't find it
const mUrl = authContent.match(/https:\/\/[^'"]+/);
const url = mUrl ? mUrl[0] : (matchUrl ? matchUrl[1] : null);

// We need the apikey. Let's find it in check_admin.js or auth.js
const mKey = authContent.match(/eyJhb[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);
const key = mKey ? mKey[0] : null;

async function run() {
  const fetch = (await import('node-fetch')).default;
  
  // Get all quizzes
  let res = await fetch(`${url}/rest/v1/quizzes?select=id,title`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const quizzes = await res.json();
  const q2 = quizzes.find(q => q.title.includes('Chặng 2') || q.title.includes('TĂNG TỐC'));
  if (!q2) {
     console.log("Not found Chặng 2"); return;
  }
  
  // Get all plays for Chặng 2
  res = await fetch(`${url}/rest/v1/play_history?select=user_id,score&quiz_id=eq.${q2.id}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const plays = await res.json();
  
  let totalScorePlays = 0;
  let userBest = {};
  
  plays.forEach(p => {
    let s = parseInt(p.score) || 0;
    totalScorePlays += s;
    if (!userBest[p.user_id] || s > userBest[p.user_id]) {
      userBest[p.user_id] = s;
    }
  });
  
  let totalBestScore = 0;
  let participants = Object.keys(userBest).length;
  for (let u in userBest) {
    totalBestScore += userBest[u];
  }
  
  console.log("Quiz ID:", q2.id);
  console.log("Total Plays:", plays.length);
  console.log("Participants:", participants);
  console.log("Avg per play:", plays.length > 0 ? totalScorePlays / plays.length : 0);
  console.log("Avg of best scores:", participants > 0 ? totalBestScore / participants : 0);
}
run();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = require('dotenv').config({ path: '/Users/user/Downloads/game_QM/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: users } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  const { data: plays } = await supabase.from('play_history').select('*');
  const { data: steals } = await supabase.from('steal_history').select('*');

  console.log(`Total users: ${users.length}`);
  const guests = users.filter(u => u.phone_number.startsWith('GUEST_'));
  console.log(`Total GUEST accounts created via quickLogin: ${guests.length}`);
  
  // Find accounts that have been stolen from a lot
  const defCounts = {};
  steals.forEach(s => {
    defCounts[s.defender_id] = (defCounts[s.defender_id] || 0) + 1;
  });
  
  const heavilyStolen = Object.entries(defCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
  console.log("Top targets for stealing:");
  for (const [id, count] of heavilyStolen) {
    const u = users.find(u => u.id === id);
    console.log(`- ${u?.full_name} (${u?.phone_number}): Stolen from ${count} times`);
  }
}
check();

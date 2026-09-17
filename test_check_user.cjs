const db = require('./test_db.js');

async function test() {
  const result = await db.supabase
    .from('users')
    .select('id, full_name')
    .ilike('full_name', '%LIÊM%');
    
  if (result.data && result.data.length > 0) {
    const userId = result.data[0].id;
    console.log("User ID:", userId);
    
    const plays = await db.supabase
      .from('play_history')
      .select('time_spent, score, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false });
      
    console.log("Plays:", plays.data);
  } else {
    console.log("User not found");
  }
}
test();

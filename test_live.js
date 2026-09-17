import { db } from './supabase.js';

async function test() {
  console.log("=== NORMAL LEADERBOARD ===");
  const lb = await db.getLeaderboard();
  lb.slice(0, 3).forEach((u, i) => {
    console.log(`#${i+1}: ${u.full_name} | Score: ${u.total_score} | Best Time: ${u.best_time} | Best Correct: ${u.best_correct}`);
  });
  
  console.log("\n=== STREAK LEADERBOARD ===");
  const slb = await db.getStreakLeaderboard();
  slb.slice(0, 3).forEach((u, i) => {
    console.log(`#${i+1}: ${u.user?.full_name} | Total Correct: ${u.totalCorrect} | Total Time: ${u.totalTime} | Max Streak: ${u.maxStreakDay}`);
  });
  
  process.exit(0);
}

test();

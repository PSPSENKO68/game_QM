import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env file
const envFile = fs.readFileSync('.env', 'utf8');
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_ANON_KEY = line.split('=')[1].trim();
});

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: plays, error } = await supabase.from('play_history').select('user_id, time_spent').order('played_at', { ascending: false }).limit(10);
  console.log('Recent play history:', plays);
}
test();

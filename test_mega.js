import { supabase } from './supabase_client_node.js';

async function test() {
  const { data: users, error } = await supabase.from('users').select('mega_code').not('mega_code', 'is', null);
  console.log('Total mega codes currently used:', users ? users.length : 0);
  process.exit(0);
}
test();

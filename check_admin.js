import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYXlwaGF0emhnd213ZGh1YnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxNTg0NiwiZXhwIjoyMTAxNTkxODQ2fQ.i-wKtg0dupaaAE87EHoVADGxaD_Y7Wvm3eMQRq6Unpc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
  const { data, error } = await supabase
    .rpc('get_policies'); // or just standard query

  const { data: pData, error: pError } = await supabase
    .from('users')
    .select('*')
    .eq('employee_code', 'ADMIN999');
    
  console.log("Can query with service role? ", !!pData);

  // query with anon key
  const anonSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: aData, error: aError } = await anonSupabase
    .from('users')
    .select('*')
    .eq('employee_code', 'ADMIN999')
    .single();

  console.log("Anon query error:", aError);
  console.log("Anon query data:", aData);
}

checkAdmin();

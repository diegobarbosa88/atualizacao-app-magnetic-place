import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data } = await supabase.from('schedules').select('*').limit(1);
  console.log('Sample Schedule keys:', Object.keys(data[0] || {}));
}

checkSchema();

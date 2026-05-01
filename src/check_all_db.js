import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllSchedules() {
  try {
    const { data: schedules } = await supabase.from('schedules').select('*');
    const { data: personal } = await supabase.from('personalschedules').select('*');
    
    console.log('--- GLOBAL SCHEDULES ---');
    schedules?.forEach(s => console.log(`- ${s.id}: ${s.name}`));
    
    console.log('\n--- PERSONAL SCHEDULES ---');
    personal?.forEach(s => console.log(`- ${s.id}: ${s.name} (Worker: ${s.workerId})`));
  } catch (err) {
    console.log(err);
  }
}

checkAllSchedules();

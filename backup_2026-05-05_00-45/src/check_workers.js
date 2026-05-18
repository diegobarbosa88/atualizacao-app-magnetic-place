import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorkersSchedules() {
  try {
    const { data: workers } = await supabase.from('workers').select('name, defaultScheduleId');
    const { data: schedules } = await supabase.from('schedules').select('id, name');
    
    console.log('Workers and their Default Schedules:');
    workers.forEach(w => {
      const s = schedules.find(s => s.id === w.defaultScheduleId);
      console.log(`- ${w.name}: ${w.defaultScheduleId} (${s ? s.name : 'MISSING'})`);
    });
  } catch (err) {
    console.log(err);
  }
}

checkWorkersSchedules();

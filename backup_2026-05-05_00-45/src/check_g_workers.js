import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGrandesWorkers() {
  try {
    const { data: clients } = await supabase.from('clients').select('*');
    const target = clients.find(c => c.name.includes('GRANDES'));
    if (!target) return;

    const { data: workers } = await supabase.from('workers').select('*');
    const assigned = workers.filter(w => w.assignedClients?.includes(target.id));
    
    console.log(`Workers assigned to ${target.name}:`);
    assigned.forEach(w => console.log(`- ${w.name} (Schedule: ${w.defaultScheduleId})`));
  } catch (err) {
    console.log(err);
  }
}

checkGrandesWorkers();

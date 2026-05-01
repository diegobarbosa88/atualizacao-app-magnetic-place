import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectWorkerLogs() {
  try {
    const workers = [
      { name: 'JANICASSIO', sid: 's1776008697548' },
      { name: 'JEAN', sid: 's1776008862550' },
      { name: 'VOLODYMYR', sid: 's1776008063149' }
    ];

    const { data: dbWorkers } = await supabase.from('workers').select('*');
    const { data: logs } = await supabase.from('logs').select('*').order('date', { ascending: false }).limit(200);

    workers.forEach(target => {
      const w = dbWorkers.find(x => x.name.includes(target.name));
      if (!w) return;
      
      const wLogs = logs.filter(l => l.workerId === w.id);
      console.log(`\nLogs for ${w.name} (Schedule: ${target.sid}):`);
      wLogs.slice(0, 5).forEach(l => {
        console.log(`  Date: ${l.date}, Time: ${l.startTime}-${l.endTime}, Break: ${l.breakStart}-${l.breakEnd}`);
      });
    });

  } catch (err) {
    console.log(err);
  }
}

inspectWorkerLogs();

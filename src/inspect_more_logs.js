import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMoreWorkerLogs() {
  try {
    const names = ['ANTONIO AUGUSTO', 'CASSIO COSTA', 'ANDRE MARCOS', 'RAFAEL MARQUES'];
    const { data: dbWorkers } = await supabase.from('workers').select('*');
    const { data: logs } = await supabase.from('logs').select('*').order('date', { ascending: false }).limit(500);

    names.forEach(name => {
      const w = dbWorkers.find(x => x.name.includes(name));
      if (!w) return;
      
      const wLogs = logs.filter(l => l.workerId === w.id);
      console.log(`\nLogs for ${w.name}:`);
      wLogs.slice(0, 5).forEach(l => {
        console.log(`  Date: ${l.date}, Time: ${l.startTime}-${l.endTime}, Break: ${l.breakStart}-${l.breakEnd}`);
      });
    });

  } catch (err) {
    console.log(err);
  }
}

inspectMoreWorkerLogs();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findGrandesLogs() {
  try {
    const { data: clients } = await supabase.from('clients').select('*');
    const target = clients.find(c => c.name.includes('GRANDES'));
    if (!target) {
      console.log('Client GRANDES not found');
      return;
    }
    console.log('Searching logs for:', target.name, '(', target.id, ')');
    const { data: logs, error } = await supabase.from('logs').select('*').eq('clientId', target.id).order('date', { ascending: false }).limit(20);
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log('Logs found:', logs.length);
    logs.forEach(l => {
      console.log(`- Date: ${l.date}, Time: ${l.startTime}-${l.endTime}, Break: ${l.breakStart}-${l.breakEnd}`);
    });
  } catch (err) {
    console.error('Catch error:', err);
  }
}

findGrandesLogs();

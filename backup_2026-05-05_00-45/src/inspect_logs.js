import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLogs() {
  try {
    const { data: logs, error: logsErr } = await supabase.from('logs').select('*').limit(100);
    const { data: clients, error: clientsErr } = await supabase.from('clients').select('*');
    
    if (logsErr || clientsErr) {
      console.error('Error fetching data:', logsErr || clientsErr);
      return;
    }

    const missingClients = clients.filter(c => 
      c.name.includes('KORTABERRI') || 
      c.name.includes('CALCOSA') || 
      c.name.includes('GRANDES')
    );

    console.log('Missing Clients found:', missingClients.length);
    missingClients.forEach(c => console.log(`- ${c.id}: ${c.name}`));

    missingClients.forEach(client => {
      const clientLogs = logs.filter(l => l.clientId === client.id);
      if (clientLogs.length > 0) {
        console.log(`\nLogs for ${client.name}:`);
        clientLogs.forEach(l => {
          console.log(`  Date: ${l.date}, Time: ${l.startTime}-${l.endTime}, Break: ${l.breakStart}-${l.breakEnd}`);
        });
      } else {
        console.log(`\nNo logs found recently for ${client.name}`);
      }
    });
  } catch (err) {
    console.error('Catch error:', err);
  }
}

inspectLogs();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreSchedules() {
  try {
    const schedulesToRestore = [
      {
        id: 's1776008697548',
        name: 'KORTABERRI',
        startTime: '08:00',
        endTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00'
      },
      {
        id: 's1776008862550',
        name: 'CALCOSA',
        startTime: '06:00',
        endTime: '16:00',
        breakStart: '',
        breakEnd: ''
      },
      {
        id: 's1776008063149',
        name: 'GRANDES MECANIZADOS',
        startTime: '08:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00'
      }
    ];

    for (const s of schedulesToRestore) {
      console.log(`Restoring ${s.name}...`);
      const { error } = await supabase.from('schedules').upsert(s);
      if (error) console.error(`Error restoring ${s.name}:`, error);
      else console.log(`${s.name} restored successfully.`);
    }
  } catch (err) {
    console.log(err);
  }
}

restoreSchedules();

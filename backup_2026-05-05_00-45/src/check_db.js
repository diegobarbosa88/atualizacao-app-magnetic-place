import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchedules() {
  try {
    const { data, error } = await supabase.from('schedules').select('*');
    if (error) {
      console.error('Error fetching schedules:', error);
      return;
    }
    console.log('Total schedules found:', data.length);
    data.forEach(s => {
      console.log(`- ID: ${s.id}, Name: ${s.name}`);
    });
  } catch (err) {
    console.error('Catch error:', err);
  }
}

checkSchedules();

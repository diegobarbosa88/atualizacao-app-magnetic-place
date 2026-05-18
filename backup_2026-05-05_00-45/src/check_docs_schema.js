
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Checking columns for table: documents');
  const { data, error } = await supabase.from('documents').select('*').limit(1);
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Columns found:', Object.keys(data[0] || {}));
  }
}

checkColumns();

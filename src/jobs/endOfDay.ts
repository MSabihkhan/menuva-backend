import { supabaseAdmin } from '../config/supabase';

export async function runEndOfDay() {
  console.log('Starting endOfDay job...');
  try {
    const { data, error } = await supabaseAdmin.rpc('run_end_of_day');
    if (error) {
      console.error('Failed to run endOfDay job:', error);
      process.exit(1);
    }
    console.log('Successfully completed endOfDay job.', data);
  } catch (err) {
    console.error('Error in endOfDay job:', err);
    process.exit(1);
  }
}

// If invoked directly
if (require.main === module) {
  runEndOfDay().then(() => process.exit(0));
}

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

function die(msg: string) {
  console.error(msg);
  process.exit(1);
}

if (process.env.NODE_ENV !== 'test') die('refusing: NODE_ENV must be "test"');
if (!process.env.SUPABASE_URL || !process.env.TEST_SUPABASE_PROJECT_REF || !process.env.SUPABASE_URL.includes(process.env.TEST_SUPABASE_PROJECT_REF)) {
  die('refusing: SUPABASE_URL is not the test project');
}
if (process.env.PROD_SUPABASE_PROJECT_REF && process.env.PROD_SUPABASE_PROJECT_REF === process.env.TEST_SUPABASE_PROJECT_REF) {
  die('refusing: PROD and TEST supabase project refs are the same');
}

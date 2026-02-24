import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xktdlavpetbsscmsrvhz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_59D8H7TOef7uMYR09SEv-Q_mCeIAYlx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

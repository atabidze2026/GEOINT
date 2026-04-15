import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.GEO_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.GEO_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are missing. Falling back to local mode.');
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

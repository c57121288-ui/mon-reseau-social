import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gokgwghadyxklhdgfzby.supabase.co';   // ← ta Project URL
const SUPABASE_KEY = 'sb_publishable_qj18RT-DfTVtO--ZAMPCAQ_cwHgLKM-';                        // ← ton anon public key

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
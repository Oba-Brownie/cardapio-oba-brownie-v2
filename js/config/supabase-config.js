// ARQUIVO: js/config/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- PREENCHA COM SEUS DADOS DO SUPABASE ---
const SUPABASE_URL = 'https://seqgdhbwtrvfyeafdtns.supabase.co'; // Ex: https://xyz.supabase.co
const SUPABASE_KEY = 'sb_publishable_hkFs4WdA0goNR5NF-I52yg_l79yzo_j'; // Começa com eyJhbGc...

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
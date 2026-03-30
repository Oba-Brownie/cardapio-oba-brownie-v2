/* ================================================= */
/* FICHEIRO: js/config/supabase-config.js            */
/* Inicialização do cliente Supabase                 */
/* ================================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

//const SUPABASE_URL = 'https://seqgdhbwtrvfyeafdtns.supabase.co';
const SUPABASE_URL = 'https://diyskqeunfunotqfmncq.supabase.co'; //temporário

//const SUPABASE_KEY = 'sb_publishable_hkFs4WdA0goNR5NF-I52yg_l79yzo_j';
const SUPABASE_KEY = 'sb_publishable_b61ljD76N2EDivYWew0IJg_6hbpAf2L'; //temporário

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

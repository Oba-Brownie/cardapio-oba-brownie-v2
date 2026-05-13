/* ================================================= */
/* FICHEIRO: js/config/supabase-config.js            */
/* Inicialização do cliente Supabase                 */
/* ================================================= */

import { LOCAL_TEST_MODE, createBlockedSupabaseClient } from '../modules/local_test_mode.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://diyskqeunfunotqfmncq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_b61ljD76N2EDivYWew0IJg_6hbpAf2L';

let supabaseClient;

if (LOCAL_TEST_MODE) {
    supabaseClient = createBlockedSupabaseClient();
} else {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const supabase = supabaseClient;

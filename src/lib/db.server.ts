/**
 * Re-export du client admin Supabase pour les server functions.
 * Centralise l'import pour éviter de coller `client.server` partout.
 */
export { supabaseAdmin as db } from "@/integrations/supabase/client.server";

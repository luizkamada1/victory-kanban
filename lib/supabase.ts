import { createClient } from "@supabase/supabase-js";

// Usa a service role key só no servidor (rotas /api). Nunca expor no client.
export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) {
    throw new Error(
      "Faltam variáveis de ambiente SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

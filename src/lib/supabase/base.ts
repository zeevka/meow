import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

let serverClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBaseClient() {
  if (!serverClient) {
    serverClient = createClient(
      env.supabaseUrl,
      env.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return serverClient;
}

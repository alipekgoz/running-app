declare const process: {
  env: Record<string, string | undefined>;
};

function normalizeEnvValue(value: string | undefined): string | null {
  const trimmedValue = value?.trim() ?? '';

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export const SUPABASE_URL = normalizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = normalizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export function getSupabaseConfigStatus(): {
  hasAnonKey: boolean;
  hasUrl: boolean;
  isConfigured: boolean;
} {
  return {
    hasAnonKey: SUPABASE_ANON_KEY !== null,
    hasUrl: SUPABASE_URL !== null,
    isConfigured: SUPABASE_URL !== null && SUPABASE_ANON_KEY !== null,
  };
}

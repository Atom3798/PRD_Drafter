import { z } from 'zod'

/**
 * Validated access to the three public env vars.
 *
 * Everything here ships to the browser. If you are about to add a variable,
 * ask whether you would be comfortable posting its value publicly - because
 * that is what a VITE_ prefix does. AI provider keys and the Supabase service
 * role key belong in backend/.env and nowhere else.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('must be a full URL, e.g. https://x.supabase.co'),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, 'looks too short to be a real key'),
  VITE_API_BASE_URL: z.string().url('must be a full URL, e.g. http://localhost:8000'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  throw new Error(
    `Frontend configuration error.\n\n${problems}\n\n` +
      `Fix: copy frontend/.env.example to frontend/.env and fill in the values,\n` +
      `then restart the dev server (Vite only reads .env at startup).\n`,
  )
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  apiBaseUrl: parsed.data.VITE_API_BASE_URL.replace(/\/$/, ''),
} as const

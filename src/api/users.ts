// Server-side API route
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const { email, password, full_name, role, phone } = await req.json()
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY! // Use service role key, not anon key
  )

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, phone }
  })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ user: data.user })
} 
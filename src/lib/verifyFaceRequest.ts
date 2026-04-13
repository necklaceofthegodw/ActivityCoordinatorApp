import { supabase } from './supabase'

type VerifyFacePayload =
  | { action: 'verify'; selfie: string }
  | { action: 'validate-avatar'; avatarUrl: string }

export async function requestVerifyFace(payload: VerifyFacePayload): Promise<Response> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-face`
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  async function send(accessToken: string): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    })
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return new Response(JSON.stringify({ error: 'Missing session' }), { status: 401 })

  let res = await send(session.access_token)
  if (res.status !== 401) return res

  await supabase.auth.refreshSession()
  const { data: { session: refreshedSession } } = await supabase.auth.getSession()
  if (!refreshedSession) return res

  res = await send(refreshedSession.access_token)
  return res
}

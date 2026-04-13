import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
} from 'npm:@aws-sdk/client-rekognition@3'

const SIMILARITY_THRESHOLD = Number(Deno.env.get('FACE_SIMILARITY_THRESHOLD') ?? '85')
const MAX_DAILY_ATTEMPTS = 3
const MAX_SELFIE_BASE64_LENGTH = 4 * 1024 * 1024 // ~3 MB image after base64 overhead

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getRekognitionClient(): RekognitionClient {
  return new RekognitionClient({
    region: Deno.env.get('AWS_REGION') ?? 'eu-central-1',
    credentials: {
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
    },
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    return await handleRequest(req)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('verify-face unhandled error:', message)
    return json({ error: 'Internal server error', detail: message }, 500)
  }
})

async function handleRequest(req: Request): Promise<Response> {

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify JWT and extract user id
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized', detail: 'Missing Authorization header' }, 401)

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!bearerMatch) return json({ error: 'Unauthorized', detail: 'Invalid Authorization format' }, 401)

  const accessToken = bearerMatch[1].trim()

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    accessToken,
  )

  if (authError || !user) {
    console.error('verify-face auth failed:', authError?.message ?? 'Unknown auth error')
    return json({ error: 'Unauthorized', detail: authError?.message ?? 'User not found' }, 401)
  }

  let body: { action: string; selfie?: string; avatarUrl?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // Validate action field
  if (body.action !== 'validate-avatar' && body.action !== 'verify') {
    return json({ error: 'Unknown action' }, 400)
  }

  const rekognition = getRekognitionClient()

  // ── action: validate-avatar ──────────────────────────────────────────────
  if (body.action === 'validate-avatar') {
    let avatarUrl: string | null = body.avatarUrl ?? null

    if (!avatarUrl) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
      avatarUrl = profile?.avatar_url ?? null
    }

    if (!avatarUrl) return json({ faceDetected: false, reason: 'no_avatar' })

    try {
      const avatarRes = await fetch(avatarUrl)
      if (!avatarRes.ok) return json({ faceDetected: false, reason: 'fetch_error' })
      const avatarBytes = new Uint8Array(await avatarRes.arrayBuffer())

      const result = await rekognition.send(new DetectFacesCommand({
        Image: { Bytes: avatarBytes },
      }))

      const hasFace = (result.FaceDetails?.length ?? 0) > 0
      return json({ faceDetected: hasFace })
    } catch {
      return json({ error: 'AWS unavailable' }, 503)
    }
  }

  // ── action: verify ───────────────────────────────────────────────────────
  if (!body.selfie) return json({ error: 'Missing selfie' }, 400)
  if (body.selfie.length > MAX_SELFIE_BASE64_LENGTH) {
    return json({ error: 'Selfie too large' }, 400)
  }

  // Decode selfie base64 — validate before doing anything else
  let selfieBytes: Uint8Array
  try {
    selfieBytes = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0))
  } catch {
    return json({ error: 'Invalid selfie format' }, 400)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('avatar_url, is_verified, verification_attempts, last_attempt_at')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('verify-face profile lookup failed:', profileError.message)
    return json({ error: 'Profile lookup failed' }, 500)
  }

  if (!profile) return json({ error: 'Profile not found' }, 404)
  if (profile.is_verified) return json({ verified: true })
  if (!profile.avatar_url) return json({ verified: false, reason: 'no_avatar' })

  // Daily limit — reset counter if last attempt was on a previous day
  const today = new Date().toISOString().slice(0, 10)
  const lastDay = profile.last_attempt_at?.slice(0, 10) ?? ''
  const currentAttempts = lastDay === today ? profile.verification_attempts : 0

  if (currentAttempts >= MAX_DAILY_ATTEMPTS) {
    const retryAfter = new Date()
    retryAfter.setUTCHours(24, 0, 0, 0)
    return json({
      verified: false,
      reason: 'limit_reached',
      retryAfter: retryAfter.toISOString(),
    })
  }

  // Fetch avatar bytes — before incrementing attempts
  let avatarBytes: Uint8Array
  try {
    const avatarRes = await fetch(profile.avatar_url)
    if (!avatarRes.ok) return json({ error: 'Avatar unavailable' }, 424)
    avatarBytes = new Uint8Array(await avatarRes.arrayBuffer())
  } catch {
    return json({ error: 'Avatar unavailable' }, 424)
  }

  // Compare faces via AWS Rekognition
  let similarity = 0
  let matched = false
  try {
    const result = await rekognition.send(new CompareFacesCommand({
      SourceImage: { Bytes: selfieBytes },
      TargetImage: { Bytes: avatarBytes },
      SimilarityThreshold: SIMILARITY_THRESHOLD,
      QualityFilter: 'AUTO',
    }))
    similarity = result.FaceMatches?.[0]?.Similarity ?? 0
    matched = (result.FaceMatches?.length ?? 0) > 0
    console.log(`CompareFaces: similarity=${similarity.toFixed(1)}, matched=${matched}, threshold=${SIMILARITY_THRESHOLD}`)
  } catch (err: unknown) {
    // InvalidParameterException = no face detected or image quality too low
    const name = (err as { name?: string }).name ?? ''
    if (name === 'InvalidParameterException') {
      // Increment attempt even for no_face — prevents abuse via low-quality images
      const newAttempts = currentAttempts + 1
      const { error: attemptError } = await supabase
        .from('profiles')
        .update({ verification_attempts: newAttempts, last_attempt_at: new Date().toISOString() })
        .eq('id', user.id)
      if (attemptError) {
        console.error('verify-face failed to update attempts (no_face):', attemptError.message)
        return json({ error: 'Failed to record verification attempt' }, 500)
      }
      return json({
        verified: false,
        reason: 'no_face',
        attemptsLeft: MAX_DAILY_ATTEMPTS - newAttempts,
      })
    }
    // AWS unavailable — do NOT increment attempts
    return json({ error: 'AWS unavailable' }, 503)
  }

  // Increment attempts only after a real comparison result (match or no_match)
  const newAttempts = currentAttempts + 1
  const { error: attemptsUpdateError } = await supabase
    .from('profiles')
    .update({ verification_attempts: newAttempts, last_attempt_at: new Date().toISOString() })
    .eq('id', user.id)
  if (attemptsUpdateError) {
    console.error('verify-face failed to update attempts:', attemptsUpdateError.message)
    return json({ error: 'Failed to record verification attempt' }, 500)
  }

  if (matched) {
    const { error: verifyUpdateError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', user.id)
    if (verifyUpdateError) {
      console.error('verify-face failed to set is_verified=true:', verifyUpdateError.message)
      return json({ error: 'Failed to persist verification status' }, 500)
    }
    return json({ verified: true, similarity })
  }

  return json({
    verified: false,
    reason: 'no_match',
    similarity,
    attemptsLeft: MAX_DAILY_ATTEMPTS - newAttempts,
  })
}

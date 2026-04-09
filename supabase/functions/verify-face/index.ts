import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
} from 'npm:@aws-sdk/client-rekognition@3'

const SIMILARITY_THRESHOLD = Number(Deno.env.get('FACE_SIMILARITY_THRESHOLD') ?? '85')
const MAX_DAILY_ATTEMPTS = 3

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
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify JWT and extract user id
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const { data: { user }, error: authError } = await createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  ).auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { action: string; selfie?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const rekognition = getRekognitionClient()

  // ── action: validate-avatar ──────────────────────────────────────────────
  if (body.action === 'validate-avatar') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    if (!profile?.avatar_url) return json({ faceDetected: false, reason: 'no_avatar' })

    try {
      const avatarRes = await fetch(profile.avatar_url)
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
  if (body.action === 'verify') {
    if (!body.selfie) return json({ error: 'Missing selfie' }, 400)

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, is_verified, verification_attempts, last_attempt_at')
      .eq('id', user.id)
      .single()

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

    // Fetch avatar bytes
    let avatarBytes: Uint8Array
    try {
      const avatarRes = await fetch(profile.avatar_url)
      if (!avatarRes.ok) throw new Error('fetch_failed')
      avatarBytes = new Uint8Array(await avatarRes.arrayBuffer())
    } catch {
      return json({ error: 'AWS unavailable' }, 503)
    }

    // Decode selfie base64
    const selfieBytes = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0))

    // Increment attempt counter before calling AWS
    const newAttempts = currentAttempts + 1
    await supabase
      .from('profiles')
      .update({ verification_attempts: newAttempts, last_attempt_at: new Date().toISOString() })
      .eq('id', user.id)

    // Compare faces
    let similarity = 0
    let matched = false
    try {
      const result = await rekognition.send(new CompareFacesCommand({
        SourceImage: { Bytes: selfieBytes },
        TargetImage: { Bytes: avatarBytes },
        SimilarityThreshold: SIMILARITY_THRESHOLD,
        QualityFilter: 'HIGH',
      }))
      similarity = result.FaceMatches?.[0]?.Similarity ?? 0
      matched = (result.FaceMatches?.length ?? 0) > 0
    } catch (err: unknown) {
      // InvalidParameterException = no face detected in one of the images
      const name = (err as { name?: string }).name ?? ''
      if (name === 'InvalidParameterException') {
        return json({
          verified: false,
          reason: 'no_face',
          attemptsLeft: MAX_DAILY_ATTEMPTS - newAttempts,
        })
      }
      return json({ error: 'AWS unavailable' }, 503)
    }

    if (matched) {
      await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', user.id)
      return json({ verified: true, similarity })
    }

    return json({
      verified: false,
      reason: 'no_match',
      similarity,
      attemptsLeft: MAX_DAILY_ATTEMPTS - newAttempts,
    })
  }

  return json({ error: 'Unknown action' }, 400)
})

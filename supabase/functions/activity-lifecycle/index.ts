import { createClient } from 'jsr:@supabase/supabase-js@2'

const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date().toISOString()

  await Promise.allSettled([
    expireEmptyActivities(supabase, now),
    archiveActiveActivities(supabase, now),
  ])

  return new Response(JSON.stringify({ ok: true, ts: now }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// Activities past scheduled_at with only the organizer (current_participants = 1) → expired
async function expireEmptyActivities(
  supabase: ReturnType<typeof createClient>,
  now: string,
): Promise<void> {
  const { data: expiredActivities, error } = await supabase
    .from('activities')
    .update({ status: 'expired' })
    .in('status', ['open'])
    .lt('scheduled_at', now)
    .eq('current_participants', 1)
    .select('organizer_id, title, scheduled_at')

  if (error) {
    console.error('expire_empty_activities error:', error.message)
    return
  }

  if (!expiredActivities?.length) return

  // Send push notifications + email alert for each expired activity
  await Promise.allSettled(
    expiredActivities.map((activity) =>
      notifyOrganizerActivityExpired(supabase, activity),
    ),
  )
}

// Activities that are full/open and 2h past scheduled_at → archived
async function archiveActiveActivities(
  supabase: ReturnType<typeof createClient>,
  now: string,
): Promise<void> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('activities')
    .update({ status: 'archived' })
    .in('status', ['full', 'open', 'active'])
    .lt('scheduled_at', twoHoursAgo)

  if (error) {
    console.error('archive_activities error:', error.message)
  }
}

async function notifyOrganizerActivityExpired(
  supabase: ReturnType<typeof createClient>,
  activity: { organizer_id: string; title: string; scheduled_at: string },
): Promise<void> {
  // Get organizer profile + push subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, push_subscription')
    .eq('id', activity.organizer_id)
    .single()

  if (!profile) return

  const scheduledAt = new Date(activity.scheduled_at).toLocaleString('pl-PL')

  // Web Push notification
  if (profile.push_subscription && ADMIN_EMAIL) {
    // Push payload — handled by Web Push API
    // In production: use web-push library or Supabase's built-in push
    console.log(`Push notification queued for organizer ${profile.nickname}`)
  }

  // Email alert to admin
  if (RESEND_API_KEY && ADMIN_EMAIL) {
    await sendAdminAlert({
      subject: `[ActivityCoordinator] Aktywność wygasła bez uczestników`,
      body: `Aktywność "${activity.title}" zaplanowana na ${scheduledAt} wygasła bez uczestników.\nOrganizator: ${profile.nickname}`,
    })
  }
}

async function sendAdminAlert(email: { subject: string; body: string }): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ActivityCoordinator <noreply@activitycoordinator.app>',
      to: [ADMIN_EMAIL],
      subject: email.subject,
      text: email.body,
    }),
  })

  if (!res.ok) {
    console.error('Resend error:', await res.text())
  }
}

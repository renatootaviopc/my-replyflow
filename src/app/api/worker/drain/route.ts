import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDM } from '@/lib/instagram'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.WORKER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: config } = await supabaseAdmin.from('config').select('access_token').eq('id', 'main').single()
  if (!config?.access_token) {
    return NextResponse.json({ error: 'No access token' }, { status: 500 })
  }

  let processed = 0
  const maxPerRun = 5
  const maxPerHour = 200
  const rateLimitDelay = 500

  const now = new Date().toISOString()

  const { data: expired } = await supabaseAdmin
    .from('queue')
    .update({ status: 'skipped' })
    .eq('status', 'pending')
    .lt('window_expires_at', now)
    .select('id')

  const { data: items, error: claimError } = await supabaseAdmin.rpc('claim_queue_items', {
    p_limit: maxPerRun,
  })

  if (claimError) {
    const { data: items2 } = await supabaseAdmin
      .from('queue')
      .update({ status: 'sending', claimed_at: now })
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .lte('window_expires_at', now)
      .order('created_at', { ascending: true })
      .limit(maxPerRun)
      .select()

    if (items2 && items2.length > 0) {
      for (const item of items2) {
        const success = await processItem(item, config.access_token)
        processed++
        if (processed < maxPerRun) {
          await new Promise(r => setTimeout(r, rateLimitDelay))
        }
      }
    }
  } else if (items && items.length > 0) {
    for (const item of items) {
      const success = await processItem(item, config.access_token)
      processed++
      if (processed < maxPerRun) {
        await new Promise(r => setTimeout(r, rateLimitDelay))
      }
    }
  }

  return NextResponse.json({ processed, expired: expired?.length || 0 })
}

async function processItem(item: Record<string, unknown>, accessToken: string): Promise<boolean> {
  try {
    await sendDM(item.recipient_id as string, item.message_body as Record<string, unknown>, accessToken)

    await supabaseAdmin
      .from('queue')
      .update({ status: 'sent', claimed_at: null })
      .eq('id', item.id)

    if (item.automation_id && item.contact_id) {
      await supabaseAdmin
        .from('contacts')
        .update({ last_reply_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('ig_user_id', item.contact_id)

      const { data: followups } = await supabaseAdmin
        .from('followups')
        .select('*')
        .eq('automation_id', item.automation_id)
        .order('step_number', { ascending: true })

      if (followups?.length) {
        const baseTime = Date.now()
        for (const fu of followups) {
          const scheduledAt = new Date(baseTime + fu.delay_seconds * 1000).toISOString()
          const windowExpires = new Date(baseTime + 24 * 60 * 60 * 1000).toISOString()

          const messageBody = fu.has_link
            ? {
                message: {
                  attachment: {
                    type: 'template',
                    payload: {
                      template_type: 'button',
                      text: fu.message_text || 'Confira!',
                      buttons: [{ type: 'web_url', url: '', title: 'Link' }],
                    },
                  },
                },
              }
            : { message: { text: fu.message_text || '' } }

          await supabaseAdmin.from('queue').insert({
            recipient_id: item.recipient_id,
            message_body: messageBody,
            automation_id: item.automation_id,
            contact_id: item.contact_id,
            scheduled_at: scheduledAt,
            window_expires_at: windowExpires,
            status: 'pending',
          })
        }
      }
    }

    return true
  } catch (err) {
    const attempts = ((item.attempts as number) || 0) + 1
    const newStatus = attempts >= 3 ? 'failed' : 'pending'
    await supabaseAdmin
      .from('queue')
      .update({
        status: newStatus,
        attempts,
        last_error: String(err),
        claimed_at: null,
      })
      .eq('id', item.id)
    return false
  }
}

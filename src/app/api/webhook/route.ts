import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyHubSignature } from '@/lib/utils'
import { sendPrivateReply, replyToComment, sendDM } from '@/lib/instagram'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyHubSignature(rawBody, signature, process.env.INSTAGRAM_APP_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)

  await supabaseAdmin.from('events').insert({
    event_type: body.object === 'instagram' ? 'ig_event' : 'unknown',
    payload: body,
    source: 'webhook',
  })

  const entries = body.entry || []
  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      if (change.field === 'comments') {
        await handleComment(change.value)
      } else if (change.field === 'messages') {
        await handleMessage(change.value)
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}

async function handleComment(comment: Record<string, unknown>) {
  const commentId = comment.id as string
  const postId = comment.media_id as string
  const text = (comment.text as string || '').toLowerCase().trim()
  const from = comment.from as Record<string, string> | undefined
  const userId = from?.id as string
  const username = from?.username as string

  if (!text || !userId) return

  const { data: automations } = await supabaseAdmin
    .from('automations')
    .select('*')
    .eq('active', true)
    .contains('triggers', ['comment'])

  if (!automations?.length) return

  for (const auto of automations) {
    if (auto.post_id && auto.post_id !== postId) continue
    if (!matchesKeyword(text, auto.keywords, auto.match_type)) continue

    await ensureContact(userId, username, auto.id)

    const { data: config } = await supabaseAdmin.from('config').select('*').eq('id', 'main').single()
    if (!config?.access_token) return

    const windowExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabaseAdmin.from('queue').insert({
      recipient_id: userId,
      message_body: buildWelcomeMessage(auto),
      automation_id: auto.id,
      contact_id: userId,
      window_expires_at: windowExpires,
      status: 'pending',
    })

    if (auto.public_replies?.length > 0) {
      const reply = auto.public_replies[Math.floor(Math.random() * auto.public_replies.length)]
      try {
        await replyToComment(commentId, reply, config.access_token)
      } catch (e) {
        console.error('Public reply failed:', e)
      }
    }
  }
}

async function handleMessage(message: Record<string, unknown>) {
  const msgFrom = message.from as Record<string, string> | undefined
  const senderId = msgFrom?.id as string
  const text = (message.text as string || '').toLowerCase().trim()
  const replyToStory = (message.reply_to as Record<string, unknown> | undefined)?.story

  if (replyToStory) {
    await handleStoryReply(senderId, message)
    return
  }

  if (!senderId || !text) return

  await handleIncomingDM(senderId, text)
}

async function handleStoryReply(senderId: string, message: Record<string, unknown>) {
  const text = (message.text as string || '').toLowerCase().trim()
  if (!senderId) return

  const { data: automations } = await supabaseAdmin
    .from('automations')
    .select('*')
    .eq('active', true)
    .contains('triggers', ['story'])

  if (!automations?.length) return

  for (const auto of automations) {
    if (!matchesKeyword(text, auto.keywords, auto.match_type)) continue

    const { data: config } = await supabaseAdmin.from('config').select('*').eq('id', 'main').single()
    if (!config?.access_token) return

    await ensureContact(senderId, null, auto.id)

    await supabaseAdmin.from('queue').insert({
      recipient_id: senderId,
      message_body: buildWelcomeMessage(auto),
      automation_id: auto.id,
      contact_id: senderId,
      status: 'pending',
    })
    break
  }
}

async function handleIncomingDM(senderId: string, text: string) {
  const { data: config } = await supabaseAdmin.from('config').select('*').eq('id', 'main').single()
  if (!config?.access_token) return

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*, automations!inner(*)')
    .eq('ig_user_id', senderId)
    .single()

  if (contact) {
    await supabaseAdmin
      .from('contacts')
      .update({ last_reply_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('ig_user_id', senderId)

    const { data: automations } = await supabaseAdmin
      .from('automations')
      .select('*')
      .eq('active', true)
      .contains('triggers', ['dm'])

    if (automations?.length) {
      for (const auto of automations) {
        if (!matchesKeyword(text, auto.keywords, auto.match_type)) continue
        await supabaseAdmin.from('queue').insert({
          recipient_id: senderId,
          message_body: buildWelcomeMessage(auto),
          automation_id: auto.id,
          contact_id: senderId,
          status: 'pending',
        })
        break
      }
    }
  } else {
    for (const trigger of ['comment', 'story', 'dm']) {
      const { data: autos } = await supabaseAdmin
        .from('automations')
        .select('*')
        .eq('active', true)
        .contains('triggers', [trigger])

      if (!autos?.length) continue
      for (const auto of autos) {
        if (!matchesKeyword(text, auto.keywords, auto.match_type)) continue
        await supabaseAdmin.from('queue').insert({
          recipient_id: senderId,
          message_body: buildWelcomeMessage(auto),
          automation_id: auto.id,
          contact_id: senderId,
          status: 'pending',
        })
        return
      }
    }
  }
}

function matchesKeyword(text: string, keywords: string[], matchType: string): boolean {
  if (!keywords?.length) return false
  const lowerKeywords = keywords.map(k => k.toLowerCase().trim())
  switch (matchType) {
    case 'exact':
      return lowerKeywords.includes(text)
    case 'any':
      return true
    case 'contains':
    default:
      return lowerKeywords.some(kw => text.includes(kw))
  }
}

function buildWelcomeMessage(auto: Record<string, unknown>) {
  const msg: Record<string, unknown> = {}
  if (auto.link_url && auto.link_label) {
    msg.message = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: auto.dm_welcome || 'Olá!',
          buttons: [
            { type: 'web_url', url: auto.link_url, title: auto.link_label || 'Clique aqui' },
          ],
        },
      },
    }
  } else if (auto.quick_reply_button) {
    msg.message = {
      text: auto.dm_welcome || 'Olá!',
      quick_replies: [
        { content_type: 'text', title: auto.quick_reply_button, payload: 'QUICK_REPLY' },
      ],
    }
  } else {
    msg.message = { text: auto.dm_welcome || 'Olá!' }
  }
  return msg
}

async function ensureContact(userId: string, username: string | null, automationId: string) {
  const existing = await supabaseAdmin.from('contacts').select('ig_user_id').eq('ig_user_id', userId).single()
  if (existing.data) {
    await supabaseAdmin
      .from('contacts')
      .update({ last_automation_id: automationId, updated_at: new Date().toISOString() })
      .eq('ig_user_id', userId)
  } else {
    await supabaseAdmin.from('contacts').insert({
      ig_user_id: userId,
      username,
      last_automation_id: automationId,
    })
  }
}

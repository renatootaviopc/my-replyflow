import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('automations')
    .insert({
      name: body.name || 'Nova Automação',
      active: body.active ?? true,
      triggers: body.triggers || ['comment'],
      keywords: body.keywords || [],
      match_type: body.match_type || 'contains',
      post_id: body.post_id || null,
      public_replies: body.public_replies || [],
      dm_welcome: body.dm_welcome || 'Olá! Obrigado pelo interesse!',
      quick_reply_button: body.quick_reply_button || null,
      link_url: body.link_url || null,
      link_label: body.link_label || null,
      reminder_text: body.reminder_text || null,
      reminder_delay_seconds: body.reminder_delay_seconds || 3600,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.followups?.length) {
    const followupRows = body.followups.map((fu: Record<string, unknown>, i: number) => ({
      automation_id: data.id,
      step_number: i + 1,
      delay_seconds: fu.delay_seconds || 0,
      message_text: fu.message_text || '',
      has_link: fu.has_link || false,
    }))
    await supabaseAdmin.from('followups').insert(followupRows)
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, followups, ...updates } = body

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('automations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (followups) {
    await supabaseAdmin.from('followups').delete().eq('automation_id', id)
    if (followups.length) {
      const rows = followups.map((fu: Record<string, unknown>, i: number) => ({
        automation_id: id,
        step_number: i + 1,
        delay_seconds: fu.delay_seconds || 0,
        message_text: fu.message_text || '',
        has_link: fu.has_link || false,
      }))
      await supabaseAdmin.from('followups').insert(rows)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('automations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [contacts, queue, events, automations] = await Promise.all([
    supabaseAdmin.from('contacts').select('ig_user_id', { count: 'exact', head: true }),
    supabaseAdmin.from('queue').select('status', { count: 'exact' }),
    supabaseAdmin.from('events').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('automations').select('id, name, active', { count: 'exact' }),
  ])

  const queueStats = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 }
  if (queue.data) {
    for (const item of queue.data) {
      queueStats[item.status as keyof typeof queueStats]++
    }
  }

  return NextResponse.json({
    total_contacts: contacts.count || 0,
    total_events: events.count || 0,
    automations: automations.data || [],
    queue: queueStats,
  })
}

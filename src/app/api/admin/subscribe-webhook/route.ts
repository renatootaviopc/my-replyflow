import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { subscribeWebhook } from '@/lib/instagram'

export async function POST(request: NextRequest) {
  const { data: config } = await supabaseAdmin.from('config').select('*').eq('id', 'main').single()
  if (!config?.access_token || !config?.ig_user_id) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 })
  }

  try {
    const result = await subscribeWebhook(config.ig_user_id, config.access_token)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

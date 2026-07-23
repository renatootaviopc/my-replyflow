import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { refreshToken } from '@/lib/instagram'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.WORKER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: config } = await supabaseAdmin.from('config').select('*').eq('id', 'main').single()
    if (!config?.access_token) {
      return NextResponse.json({ error: 'No token to refresh' }, { status: 400 })
    }

    const result = await refreshToken(config.access_token)
    if (result.error) throw new Error(result.error.message)

    const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString()

    await supabaseAdmin.from('config').update({
      access_token: result.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', 'main')

    return NextResponse.json({ success: true, expires_at: expiresAt })
  } catch (err) {
    console.error('Token renewal failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

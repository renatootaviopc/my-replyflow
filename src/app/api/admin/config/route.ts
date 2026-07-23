import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserMedia } from '@/lib/instagram'

export async function GET() {
  const { data: config } = await supabaseAdmin.from('config').select('*').eq('id', 'main').single()

  return NextResponse.json({
    connected: !!config?.access_token,
    username: config?.username,
    name: config?.name,
    profile_picture_url: config?.profile_picture_url,
    token_expires_at: config?.token_expires_at,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { exchangeShortToken, getLongToken, getProfile, subscribeWebhook } from '@/lib/instagram'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://my-replyflow.vercel.app'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, APP_URL))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', APP_URL))
  }

  try {
    const shortTokenRes = await exchangeShortToken(code)
    if (shortTokenRes.error) throw new Error(shortTokenRes.error.message || JSON.stringify(shortTokenRes.error))

    const longTokenRes = await getLongToken(shortTokenRes.access_token)
    if (longTokenRes.error) throw new Error(longTokenRes.error.message || JSON.stringify(longTokenRes.error))

    const profile = await getProfile(longTokenRes.access_token)

    const expiresAt = new Date(Date.now() + longTokenRes.expires_in * 1000).toISOString()

    const { error: dbError } = await supabaseAdmin.from('config').upsert({
      id: 'main',
      ig_user_id: profile.user_id,
      username: profile.username,
      name: profile.name,
      profile_picture_url: profile.profile_picture_url,
      access_token: longTokenRes.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })

    if (dbError) throw new Error('DB error: ' + dbError.message)

    try {
      await subscribeWebhook(profile.user_id, longTokenRes.access_token)
    } catch (e) {
      console.error('Webhook subscription failed:', e)
    }

    return NextResponse.redirect(new URL('/?success=connected', APP_URL))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(String(err))}`, APP_URL))
  }
}

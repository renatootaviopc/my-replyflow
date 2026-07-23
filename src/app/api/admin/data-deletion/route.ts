import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { username } = await request.json()
  if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 })

  const cleanUsername = username.replace('@', '').toLowerCase().trim()

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('ig_user_id')
    .ilike('username', cleanUsername)
    .single()

  if (!contact) {
    return NextResponse.json({ message: 'Conta não encontrada ou já excluída' })
  }

  const userId = contact.ig_user_id

  await supabaseAdmin.from('queue').delete().eq('contact_id', userId)
  await supabaseAdmin.from('contacts').delete().eq('ig_user_id', userId)

  return NextResponse.json({ message: 'Dados excluídos com sucesso' })
}

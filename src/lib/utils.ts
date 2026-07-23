import { createHmac } from 'crypto'

export function verifyHubSignature(body: string, signature: string | null, appSecret: string): boolean {
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex')
  return expected === signature
}

export function getBrazilTime(date?: Date): string {
  const d = date || new Date()
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

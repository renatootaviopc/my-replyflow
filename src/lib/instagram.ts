const IG_BASE = 'https://graph.instagram.com/v25.0'

export async function igGet(endpoint: string, accessToken: string) {
  const url = endpoint.startsWith('http') ? endpoint : `${IG_BASE}${endpoint}`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}access_token=${accessToken}`)
  if (!res.ok) throw new Error(`IG GET ${url} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function igPost(endpoint: string, body: Record<string, unknown>, accessToken: string) {
  const url = endpoint.startsWith('http') ? endpoint : `${IG_BASE}${endpoint}`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(`IG POST ${url} failed: ${JSON.stringify(data)}`)
  return data
}

export async function exchangeShortToken(shortToken: string) {
  const appId = process.env.INSTAGRAM_APP_ID!
  const appSecret = process.env.INSTAGRAM_APP_SECRET!
  const redirectUri = process.env.OAUTH_REDIRECT_URI!
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'ig_exchange_token',
    redirect_uri: redirectUri,
    code: shortToken,
  })
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body,
  })
  return res.json()
}

export async function getLongToken(shortAccessToken: string) {
  const res = await fetch(
    `${IG_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET!}&access_token=${shortAccessToken}`
  )
  return res.json()
}

export async function refreshToken(longToken: string) {
  const res = await fetch(
    `${IG_BASE}/access_token?grant_type=ig_token_refresh&client_secret=${process.env.INSTAGRAM_APP_SECRET!}&access_token=${longToken}`
  )
  return res.json()
}

export async function getProfile(accessToken: string) {
  return igGet('/me?fields=user_id,username,name,profile_picture_url', accessToken)
}

export async function sendPrivateReply(commentId: string, text: string, accessToken: string) {
  return igPost(`/${commentId}/messages`, { recipient: { comment_id: commentId }, message: { text } }, accessToken)
}

export async function sendDM(recipientId: string, messageBody: Record<string, unknown>, accessToken: string) {
  return igPost(`/${recipientId}/messages`, { recipient: { id: recipientId }, ...messageBody }, accessToken)
}

export async function replyToComment(commentId: string, text: string, accessToken: string) {
  return igPost(`/${commentId}/replies`, { message: text }, accessToken)
}

export async function subscribeWebhook(igUserId: string, accessToken: string) {
  return igPost(`/${igUserId}/subscribed_apps`, { subscribed_fields: 'comments,messages' }, accessToken)
}

export async function getMedia(containerId: string, accessToken: string) {
  return igGet(`/${containerId}?fields=id,media_type,media_url,thumbnail_url,caption,permalink,children{id,media_type,media_url,thumbnail_url}`, accessToken)
}

export async function getUserMedia(igUserId: string, accessToken: string, limit = 25) {
  return igGet(`/${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,permalink&limit=${limit}`, accessToken)
}

'use client'

import { useState, useEffect } from 'react'

interface Automation {
  id: string
  name: string
  active: boolean
  triggers: string[]
  keywords: string[]
  match_type: string
  post_id: string | null
  public_replies: string[]
  dm_welcome: string
  quick_reply_button: string | null
  link_url: string | null
  link_label: string | null
  reminder_text: string | null
  reminder_delay_seconds: number
  followups?: Followup[]
}

interface Followup {
  step_number: number
  delay_seconds: number
  message_text: string
  has_link: boolean
}

interface Stats {
  total_contacts: number
  total_events: number
  automations: { id: string; name: string; active: boolean }[]
  queue: { pending: number; sending: number; sent: number; failed: number; skipped: number }
}

export default function AdminPanel() {
  const [tab, setTab] = useState<'dashboard' | 'automations' | 'settings'>('dashboard')
  const [config, setConfig] = useState<any>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [editingAuto, setEditingAuto] = useState<Automation | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(setConfig)
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
    fetch('/api/admin/automations').then(r => r.json()).then(setAutomations)
  }, [])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">MyReplyFlow</h1>
          <div className="flex items-center gap-3">
            {config?.profile_picture_url && (
              <img src={config.profile_picture_url} alt="" className="w-8 h-8 rounded-full" />
            )}
            {config?.connected ? (
              <span className="text-sm text-green-600 font-medium">@{config.username}</span>
            ) : (
              <a
                href={`https://www.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_IG_APP_ID}&redirect_uri=${encodeURIComponent(appUrl + '/api/oauth/callback')}&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments&response_type=code`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Conectar Instagram
              </a>
            )}
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 flex gap-6">
          {(['dashboard', 'automations', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'dashboard' ? 'Painel' : t === 'automations' ? 'Automações' : 'Configurações'}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Contatos" value={stats.total_contacts} />
              <StatCard label="Na fila" value={stats.queue.pending} />
              <StatCard label="Enviadas" value={stats.queue.sent} />
              <StatCard label="Automações" value={stats.automations.length} />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Automações Ativas</h2>
              {stats.automations.length === 0 ? (
                <p className="text-gray-500">Nenhuma automação criada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {stats.automations.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b">
                      <span>{a.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'automations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Automações</h2>
              <button
                onClick={() => { setEditingAuto(null); setShowForm(true) }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Nova Automação
              </button>
            </div>

            {showForm && (
              <AutomationForm
                automation={editingAuto}
                onSave={async (data) => {
                  const method = editingAuto ? 'PUT' : 'POST'
                  const body = editingAuto ? { ...data, id: editingAuto.id } : data
                  const res = await fetch('/api/admin/automations', {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  })
                  if (res.ok) {
                    const list = await fetch('/api/admin/automations').then(r => r.json())
                    setAutomations(list)
                    setShowForm(false)
                    setEditingAuto(null)
                  }
                }}
                onCancel={() => { setShowForm(false); setEditingAuto(null) }}
              />
            )}

            {automations.map(auto => (
              <div key={auto.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{auto.name}</h3>
                    <p className="text-sm text-gray-500">
                      Gatilhos: {auto.triggers.join(', ')} | Palavras: {auto.keywords.join(', ')} | Match: {auto.match_type}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await fetch('/api/admin/automations', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: auto.id, active: !auto.active }),
                        })
                        const list = await fetch('/api/admin/automations').then(r => r.json())
                        setAutomations(list)
                      }}
                      className={`px-3 py-1 rounded text-xs ${auto.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {auto.active ? 'Ativa' : 'Inativa'}
                    </button>
                    <button
                      onClick={() => { setEditingAuto(auto); setShowForm(true) }}
                      className="px-3 py-1 rounded text-xs bg-blue-100 text-blue-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Excluir esta automação?')) {
                          await fetch(`/api/admin/automations?id=${auto.id}`, { method: 'DELETE' })
                          const list = await fetch('/api/admin/automations').then(r => r.json())
                          setAutomations(list)
                        }
                      }}
                      className="px-3 py-1 rounded text-xs bg-red-100 text-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                {auto.link_url && (
                  <p className="text-xs text-gray-400">Link: {auto.link_label} → {auto.link_url}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Conexão Instagram</h2>
              {config?.connected ? (
                <div className="flex items-center gap-4">
                  <img src={config.profile_picture_url} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="font-medium">@{config.username}</p>
                    <p className="text-sm text-gray-500">Token válido até: {config.token_expires_at ? new Date(config.token_expires_at).toLocaleDateString('pt-BR') : 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 mb-3">Nenhuma conta conectada.</p>
                  <a
                    href={`https://www.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_IG_APP_ID}&redirect_uri=${encodeURIComponent(appUrl + '/api/oauth/callback')}&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments&response_type=code`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 inline-block"
                  >
                    Conectar Instagram
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function AutomationForm({
  automation,
  onSave,
  onCancel,
}: {
  automation: Automation | null
  onSave: (data: Partial<Automation>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(automation?.name || '')
  const [triggers, setTriggers] = useState<string[]>(automation?.triggers || ['comment'])
  const [keywords, setKeywords] = useState(automation?.keywords.join(', ') || '')
  const [matchType, setMatchType] = useState(automation?.match_type || 'contains')
  const [postId, setPostId] = useState(automation?.post_id || '')
  const [dmWelcome, setDmWelcome] = useState(automation?.dm_welcome || 'Olá! Obrigado pelo interesse! Aqui está o link:')
  const [quickReply, setQuickReply] = useState(automation?.quick_reply_button || '')
  const [linkUrl, setLinkUrl] = useState(automation?.link_url || '')
  const [linkLabel, setLinkLabel] = useState(automation?.link_label || '')
  const [publicReplies, setPublicReplies] = useState(automation?.public_replies.join('\n') || '')
  const [reminderText, setReminderText] = useState(automation?.reminder_text || '')
  const [reminderDelay, setReminderDelay] = useState(automation?.reminder_delay_seconds || 3600)

  const toggleTrigger = (t: string) => {
    setTriggers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">{automation ? 'Editar Automação' : 'Nova Automação'}</h3>

      <div>
        <label className="block text-sm font-medium mb-1">Nome</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Gatilhos</label>
        <div className="flex gap-3">
          {['comment', 'story', 'dm'].map(t => (
            <button
              key={t}
              onClick={() => toggleTrigger(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                triggers.includes(t)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t === 'comment' ? 'Comentário' : t === 'story' ? 'Story' : 'DM'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Palavras-chave (separadas por vírgula)</label>
        <input value={keywords} onChange={e => setKeywords(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="link, acesso, quero" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tipo de Match</label>
        <select value={matchType} onChange={e => setMatchType(e.target.value)} className="w-full border rounded-lg px-3 py-2">
          <option value="contains">Contém</option>
          <option value="exact">Exato</option>
          <option value="any">Qualquer (sempre dispara)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">ID do Post (opcional — vazio = qualquer post)</label>
        <input value={postId} onChange={e => setPostId(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="ABC123..." />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Mensagem de Boas-vindas (DM)</label>
        <textarea value={dmWelcome} onChange={e => setDmWelcome(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">URL do Link</label>
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Texto do Botão</label>
          <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Clique aqui" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Respostas Públicas no Comentário (1 por linha, sorteia uma)</label>
        <textarea value={publicReplies} onChange={e => setPublicReplies(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} placeholder="Obrigado! Enviando no privado...&#10;Check your DMs!" />
      </div>

      <div className="flex gap-3 pt-4">
        <button onClick={() => onSave({
          name,
          triggers,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          match_type: matchType,
          post_id: postId || null,
          dm_welcome: dmWelcome,
          quick_reply_button: quickReply || null,
          link_url: linkUrl || null,
          link_label: linkLabel || null,
          public_replies: publicReplies.split('\n').filter(Boolean),
          reminder_text: reminderText || null,
          reminder_delay_seconds: reminderDelay,
        })} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
          Salvar
        </button>
        <button onClick={onCancel} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300">
          Cancelar
        </button>
      </div>
    </div>
  )
}

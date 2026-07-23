'use client'

import { useState } from 'react'

export default function DataDeletionPage() {
  const [username, setUsername] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('Digite seu nome de usuário')
      return
    }

    try {
      const res = await fetch('/api/admin/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Erro ao processar solicitação')
      }
    } catch {
      setError('Erro de conexão')
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md bg-white rounded-lg shadow p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Solicitação Enviada</h1>
          <p className="text-gray-600">
            Todos os seus dados foram solicitados para exclusão.
            O processamento ocorrerá em até 48 horas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-4">Exclusão de Dados</h1>
        <p className="text-gray-600 mb-6">
          Para solicitar a exclusão de todos os seus dados, insira seu nome de usuário do Instagram.
          Todos os seus dados serão permanentemente removidos.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome de usuário do Instagram</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="@seuusuario"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition"
          >
            Solicitar Exclusão
          </button>
        </form>
      </div>
    </div>
  )
}

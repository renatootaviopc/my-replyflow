export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-6">Política de Privacidade</h1>
        <div className="space-y-4 text-gray-700">
          <h2 className="text-lg font-semibold">1. Dados Coletados</h2>
          <p>
            Esta aplicação coleta e processa dados do Instagram fornecidos pela API oficial do Meta,
            incluindo: nome de usuário, ID do Instagram, comentários em posts e mensagens diretas.
          </p>

          <h2 className="text-lg font-semibold">2. Uso dos Dados</h2>
          <p>
            Os dados são utilizados exclusivamente para o funcionamento das automações solicitadas
            pelo titular da conta do Instagram conectada, incluindo envio de mensagens automáticas
            em resposta a comentários e interações.
          </p>

          <h2 className="text-lg font-semibold">3. Armazenamento</h2>
          <p>
            Os dados são armazenados em servidores seguros do Supabase e são mantidos apenas
            pelo tempo necessário para o funcionamento do serviço.
          </p>

          <h2 className="text-lg font-semibold">4. Compartilhamento</h2>
          <p>
            Não compartilhamos dados com terceiros. Todos os dados permanecem sob controle
            do titular da conta conectada.
          </p>

          <h2 className="text-lg font-semibold">5. Direitos do Titular</h2>
          <p>
            Você pode solicitar a exclusão de todos os seus dados a qualquer momento
            através da página <a href="/exclusao-de-dados" className="text-blue-600 underline">/exclusao-de-dados</a>.
          </p>

          <h2 className="text-lg font-semibold">6. Contato</h2>
          <p>
            Para dúvidas sobre privacidade, entre em contato através do Instagram.
          </p>
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-lg font-semibold tracking-tight">VRGH</p>
            <p className="text-sm text-zinc-400">
              Locação de estrutura gamer para festas e eventos.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-zinc-200">Site</p>
            <div className="grid gap-1 text-zinc-300">
              <Link href="/equipamentos" className="hover:text-white">
                Equipamentos
              </Link>
              <Link href="/como-funciona" className="hover:text-white">
                Como funciona
              </Link>
              <Link href="/cobertura" className="hover:text-white">
                Cobertura
              </Link>
              <Link href="/orcamento" className="hover:text-white">
                Orçamento
              </Link>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-zinc-200">Contato</p>
            <div className="grid gap-1 text-zinc-300">
              <p>WhatsApp: (12) 99156-8840</p>
              <p>E-mail: contato@vrgh.com.br</p>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} VRGH. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

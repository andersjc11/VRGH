import Link from "next/link"

export function SiteFooter() {
  const whatsappNumber = "5512992239698"
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Olá! Vi o site da VRInfinity e gostaria de solicitar uma proposta personalizada para meu evento."
  )}`

  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <p className="bg-gradient-to-r from-white via-brand-100 to-fuchsia-100 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
              VRGH
            </p>
            <p className="text-sm text-zinc-400">
              Locação de estrutura gamer para festas e eventos.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-zinc-200">Site</p>
            <div className="grid gap-1 text-zinc-300">
              <Link href="/#como-funciona" className="hover:text-white">
                Como funciona
              </Link>
              <Link href="/#equipamentos" className="hover:text-white">
                Equipamentos
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                Solicitar Proposta
              </a>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-zinc-200">Contato</p>
            <div className="grid gap-1 text-zinc-300">
              <p>WhatsApp: (12) 99223-9698</p>
              <p>E-mail: contato@vrinfinitypro.com.br</p>
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

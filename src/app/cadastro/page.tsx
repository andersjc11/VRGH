import { redirect } from "next/navigation"

export default function CadastroRedirectPage() {
  // Conforme novas regras de negócio, clientes não criam conta.
  // O cadastro é feito internamente pela equipe de vendas durante o orçamento.
  redirect("/?msg=contato_whatsapp")
}

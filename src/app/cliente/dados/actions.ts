"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type UpdateClientDataState = {
  error?: string
  message?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export async function updateClientData(
  _prevState: UpdateClientDataState,
  formData: FormData
): Promise<UpdateClientDataState> {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/cliente/dados")

  const fullName = getString(formData, "full_name")
  const cpfRaw = getString(formData, "cpf")
  const addressLine1 = getString(formData, "address_line1")
  const neighborhood = getString(formData, "neighborhood")
  const city = getString(formData, "city")
  const postalCodeRaw = getString(formData, "postal_code")
  const whatsappRaw = getString(formData, "whatsapp")

  if (!fullName) return { error: "Informe seu nome." }
  const cpf = onlyDigits(cpfRaw)
  if (cpf.length !== 11) return { error: "CPF inválido. Digite 11 números." }
  if (!addressLine1) return { error: "Informe seu endereço." }
  if (!neighborhood) return { error: "Informe seu bairro." }
  if (!city) return { error: "Informe sua cidade." }
  const postalCode = onlyDigits(postalCodeRaw)
  if (postalCode.length !== 8) return { error: "CEP inválido. Digite 8 números." }
  const whatsapp = onlyDigits(whatsappRaw)
  if (whatsapp.length < 10) return { error: "WhatsApp inválido. Digite DDD + número." }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      cpf,
      address_line1: addressLine1,
      neighborhood,
      city,
      postal_code: postalCode,
      whatsapp,
      phone: whatsapp
    })
    .eq("id", user.id)

  if (error) return { error: "Não foi possível salvar seus dados. Tente novamente." }

  return { message: "Dados salvos com sucesso." }
}


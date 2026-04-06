"use client"

import { useFormState, useFormStatus } from "react-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { updateClientData, type UpdateClientDataState } from "./actions"

type Props = {
  initial: {
    full_name: string | null
    cpf: string | null
    address_line1: string | null
    neighborhood: string | null
    city: string | null
    postal_code: string | null
    whatsapp: string | null
    phone: string | null
  }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      Salvar dados
    </Button>
  )
}

export function DadosClienteForm({ initial }: Props) {
  const [state, action] = useFormState<UpdateClientDataState, FormData>(
    updateClientData,
    {}
  )

  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-zinc-200" htmlFor="full_name">
          Nome
        </label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={initial.full_name ?? ""}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-zinc-200" htmlFor="cpf">
          CPF
        </label>
        <Input
          id="cpf"
          name="cpf"
          required
          defaultValue={initial.cpf ?? ""}
          inputMode="numeric"
          placeholder="Somente números"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-zinc-200" htmlFor="address_line1">
          Endereço
        </label>
        <Input
          id="address_line1"
          name="address_line1"
          required
          defaultValue={initial.address_line1 ?? ""}
          autoComplete="street-address"
          placeholder="Rua, número, complemento"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="neighborhood">
            Bairro
          </label>
          <Input
            id="neighborhood"
            name="neighborhood"
            required
            defaultValue={initial.neighborhood ?? ""}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="city">
            Cidade
          </label>
          <Input id="city" name="city" required defaultValue={initial.city ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="postal_code">
            CEP
          </label>
          <Input
            id="postal_code"
            name="postal_code"
            required
            defaultValue={initial.postal_code ?? ""}
            inputMode="numeric"
            placeholder="Somente números"
            autoComplete="postal-code"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="whatsapp">
            WhatsApp
          </label>
          <Input
            id="whatsapp"
            name="whatsapp"
            required
            defaultValue={initial.whatsapp ?? initial.phone ?? ""}
            inputMode="tel"
            placeholder="DDD + número"
            autoComplete="tel"
          />
        </div>
      </div>

      {state.message ? (
        <p className="text-sm text-emerald-200">{state.message}</p>
      ) : null}
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      <SubmitButton />
    </form>
  )
}


"use client"

import { useMemo, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { updateClientData, type UpdateClientDataState } from "./actions"

type Props = {
  initial: {
    full_name: string | null
    cpf: string | null
    address_line1: string | null
    address_number: string | null
    address_line2: string | null
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

  const [postalCode, setPostalCode] = useState(initial.postal_code ?? "")
  const [addressLine1, setAddressLine1] = useState(initial.address_line1 ?? "")
  const [addressNumber, setAddressNumber] = useState(initial.address_number ?? "")
  const [addressLine2, setAddressLine2] = useState(initial.address_line2 ?? "")
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood ?? "")
  const [city, setCity] = useState(initial.city ?? "")
  const [cepError, setCepError] = useState<string | null>(null)
  const [isCepLoading, setIsCepLoading] = useState(false)
  const [lastCepLookup, setLastCepLookup] = useState("")

  const postalCodeDigits = useMemo(() => postalCode.replace(/\D/g, ""), [postalCode])

  async function lookupCep(cepDigits: string) {
    if (cepDigits.length !== 8) return
    if (cepDigits === lastCepLookup) return
    setIsCepLoading(true)
    setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      if (!res.ok) {
        setCepError("Não foi possível consultar o CEP.")
        setLastCepLookup("")
        return
      }
      const data = (await res.json()) as any
      if (data?.erro) {
        setCepError("CEP não encontrado.")
        setLastCepLookup("")
        return
      }

      const nextStreet = String(data?.logradouro ?? "").trim()
      const nextNeighborhood = String(data?.bairro ?? "").trim()
      const nextCity = String(data?.localidade ?? "").trim()
      const nextComplement = String(data?.complemento ?? "").trim()

      if (nextStreet) setAddressLine1(nextStreet)
      if (nextNeighborhood) setNeighborhood(nextNeighborhood)
      if (nextCity) setCity(nextCity)
      if (nextComplement && !addressLine2) setAddressLine2(nextComplement)
      setLastCepLookup(cepDigits)
    } catch {
      setCepError("Não foi possível consultar o CEP.")
      setLastCepLookup("")
    } finally {
      setIsCepLoading(false)
    }
  }

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="postal_code">
            CEP
          </label>
          <Input
            id="postal_code"
            name="postal_code"
            required
            value={postalCode}
            onChange={(e) => {
              const next = e.target.value
              const digits = next.replace(/\D/g, "")
              setPostalCode(next)
              setCepError(null)
              if (digits.length === 8) lookupCep(digits)
            }}
            onBlur={() => lookupCep(postalCodeDigits)}
            inputMode="numeric"
            placeholder="CEP (somente números)"
            autoComplete="postal-code"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">
              {isCepLoading ? "Consultando CEP..." : "Digite o CEP para autopreencher o endereço."}
            </p>
            {cepError ? <p className="text-xs text-red-300">{cepError}</p> : null}
          </div>
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

      <div className="space-y-2">
        <label className="text-sm text-zinc-200" htmlFor="address_line1">
          Endereço (Rua/Avenida)
        </label>
          <Input
          id="address_line1"
          name="address_line1"
            required
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          autoComplete="address-line1"
          />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="address_number">
            Número
          </label>
          <Input
            id="address_number"
            name="address_number"
            required
            value={addressNumber}
            onChange={(e) => setAddressNumber(e.target.value)}
            autoComplete="address-line2"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="address_line2">
            Complemento
          </label>
          <Input
            id="address_line2"
            name="address_line2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
        </div>
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
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-zinc-200" htmlFor="city">
            Cidade
          </label>
          <Input id="city" name="city" required value={city} onChange={(e) => setCity(e.target.value)} />
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


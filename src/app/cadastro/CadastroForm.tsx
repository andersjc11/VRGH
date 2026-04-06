"use client"

import { useFormState, useFormStatus } from "react-dom"
import { signUp, type AuthActionState } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      Criar conta
    </Button>
  )
}

export function CadastroForm({ refCode }: { refCode?: string }) {
  const [state, action] = useFormState<AuthActionState, FormData>(signUp, {})

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="ref" value={refCode ?? ""} />
      <div className="space-y-2">
        <label className="text-sm text-zinc-200" htmlFor="email">
          E-mail
        </label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-zinc-200" htmlFor="password">
          Senha
        </label>
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
      </div>
      {state.error ? (
        <p className="text-sm text-red-300">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { forgotPassword } from '@/services/api'
import { AuthLayout } from './login'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export const Route = createFileRoute('/forgot-pass')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await forgotPassword(email)
      toast.success('Email reset password berhasil dikirim')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim email reset'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Lupa Password"
      subtitle="Masukkan email akun kamu"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Email</Label>

          <Input
            type="email"
            placeholder="contoh@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl"
        >
          {loading ? 'Mengirim...' : 'Kirim Email Reset'}
        </Button>
      </form>
    </AuthLayout>
  )
}
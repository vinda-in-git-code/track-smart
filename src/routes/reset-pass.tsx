import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { AuthLayout } from './login'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export const Route = createFileRoute('/reset-pass')({
  component: ResetPassPage,
})

function ResetPassPage() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      toast.success('Password berhasil diubah')

      navigate({ to: '/login' })
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal reset password'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Masukkan password baru"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Password Baru</Label>

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-11 rounded-xl"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl"
        >
          {loading ? 'Menyimpan...' : 'Simpan Password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
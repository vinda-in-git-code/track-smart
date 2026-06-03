import { createFileRoute, Link } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useState } from 'react'
import {
  Wallet, ScanLine, PiggyBank, BarChart3,
  Target, ArrowRight, X, UserPlus,
  TrendingUp, Receipt,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: Landing,
})

const FEATURES = [
  { icon: PiggyBank, title: 'Finance Tracker', desc: 'Catat pemasukan dan pengeluaran harian, lalu lihat ke mana uangmu pergi tanpa perlu repot bikin spreadsheet.' },
  { icon: ScanLine, title: 'Smart Split Bill', desc: 'Bagi tagihan lebih cepat dengan bantuan AI yang membaca struk secara otomatis.' },
  { icon: BarChart3, title: 'Dashboard Analytics', desc: 'Lihat ringkasan dan pola pengeluaranmu lewat visual yang mudah dipahami.' },
  { icon: Target, title: 'Goals & Budgets', desc: 'Tetapkan target tabungan dan batas pengeluaran, lalu pantau perkembangannya dalam satu tempat.' },
  { icon: Receipt, title: 'OCR Receipt Scan', desc: 'Ambil foto struk dan data transaksi akan tercatat secara otomatis.' },
  { icon: TrendingUp, title: 'Spending Insights', desc: 'Dapatkan gambaran yang lebih jelas tentang kebiasaan pengeluaranmu.' },
]

const STEPS = [
  { step: '01', icon: UserPlus, title: 'Daftar & Login', desc: 'Daftar gratis dan mulai mengelola keuanganmu dalam hitungan menit.' },
  { step: '02', icon: Wallet, title: 'Catat Transaksi', desc: 'Masukkan pemasukan dan pengeluaran harian agar semuanya tetap terorganisir.' },
  { step: '03', icon: ScanLine, title: 'Split & Analisis', desc: 'Foto struk, bagi tagihan otomatis, dan lihat ringkasan pengeluaranmu.' },
]

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto relative shadow-xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export default function Landing() {
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {showPrivacy && (
        <Modal title="Privacy Policy" onClose={() => setShowPrivacy(false)}>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>Track Smart mengumpulkan data transaksi keuangan yang kamu input secara sukarela untuk memberikan layanan pelacakan keuangan dan split bill.</p>
            <p>Data kamu disimpan secara aman di Supabase dengan enkripsi dan Row Level Security, sehingga hanya kamu yang bisa mengakses data milikmu.</p>
            <p>Kami tidak menjual, menyewakan, atau membagikan data pribadi kamu kepada pihak ketiga manapun.</p>
            <p>Aplikasi ini dikembangkan sebagai proyek capstone Coding Camp 2026 powered by DBS Foundation dan bersifat non-komersial.</p>
            <p>Kamu dapat menghapus akun dan seluruh data kamu kapan saja melalui halaman Settings.</p>
          </div>
        </Modal>
      )}

      {showTerms && (
        <Modal title="Terms of Service" onClose={() => setShowTerms(false)}>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>Dengan menggunakan Track Smart, kamu memahami bahwa aplikasi ini dikembangkan sebagai bagian dari proyek capstone dan masih dalam tahap pengembangan.</p>
            <p>Pastikan data yang kamu masukkan sudah benar, karena seluruh pencatatan dan laporan bergantung pada informasi yang kamu input.</p>
            <p>Insight dan analisis yang ditampilkan bertujuan membantu kamu memahami kondisi keuangan, bukan sebagai saran atau rekomendasi finansial profesional.</p>
            <p>Penggunaan aplikasi untuk aktivitas yang melanggar hukum atau merugikan pengguna lain tidak diperbolehkan.</p>
          </div>
        </Modal>
      )}

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Track Smart</p>
              <p className="text-[10px] text-primary leading-tight">Split Easy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <button className="h-9 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
                Masuk
              </button>
            </Link>
            <Link to="/register">
              <button className="h-9 px-4 rounded-xl text-sm font-medium bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-glow)] hover:opacity-90 transition-opacity">
                Daftar Gratis
              </button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-0 px-6 bg-background overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="max-w-6xl mx-auto relative">
          {/* Text — centered */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              Lihat gambaran keuanganmu,{' '}
              <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
                dengan lebih jelas.
              </span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
              Catat pengeluaran, split tagihan bareng teman, dan simpan target keuanganmu di satu tempat.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link to="/register">
                <button className="h-11 px-6 rounded-xl text-sm font-semibold bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-glow)] hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                  Mulai Gratis <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link to="/login">
                <button className="h-11 px-6 rounded-xl text-sm font-medium border border-border bg-background hover:bg-muted transition-colors">
                  Sudah punya akun
                </button>
              </Link>
            </div>
          </div>

          {/* Mockup row */}
          <div className="relative flex items-end justify-center gap-6">

            {/* Phone mockup — kiri */}
            <div className="relative w-[160px] md:w-[190px] shrink-0 self-end translate-y-[2px]">
              <div className="absolute inset-0 z-0 flex items-center justify-center">
                <div
                  className="overflow-hidden rounded-[36px]"
                  style={{ width: '88%', height: '96%', marginTop: '1%' }}
                >
                  <img
                    src="/SS_Mobile.png"
                    alt="App Mobile"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
              <img
                src="/MockUp_Iphone.png"
                alt="iPhone"
                className="relative z-10 w-full drop-shadow-2xl"
              />
            </div>

            {/* Desktop dashboard — tengah, fade bottom */}
            <div className="flex-1 max-w-[740px] relative">
              <div className="rounded-t-2xl overflow-hidden border border-border/40 shadow-2xl shadow-primary/10">
                {/* Browser chrome bar */}
                <div className="bg-muted/80 backdrop-blur px-4 py-2.5 flex items-center gap-2 border-b border-border/60">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                  </div>
                  <div className="flex-1 bg-background/60 rounded-md px-3 py-1 text-[11px] text-muted-foreground text-center">
                    tracksmart.app/dashboard
                  </div>
                </div>
                {/* Screenshot + fade */}
                <div className="relative">
                  <img
                    src="/Ui_Dashboard.png"
                    alt="Dashboard"
                    className="w-full object-cover object-top"
                  />
                  {/* Smooth fade to background */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-52 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to bottom, transparent 0%, var(--background) 100%)',
                    }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-border/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Fitur</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Semua yang kamu butuhkan,{' '}
              <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
                dalam satu app.
              </span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md mx-auto text-sm">
              Buat ngatur uang tanpa ribet, dari pengeluaran harian sampai patungan bareng teman.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/30 transition-all duration-200">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-border/60 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Cara Kerja</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Mulai dalam 3 langkah</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ step, icon: Icon, title, desc }, i) => (
              <div key={step} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[calc(50%+40px)] right-0 h-px bg-border" />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-2xl bg-card border border-border/60 flex items-center justify-center mb-4 relative z-10 shadow-[var(--shadow-card)]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-xs font-bold text-primary tracking-widest mb-2">STEP {step}</p>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/60">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Mulai atur keuanganmu {' '}
            <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
              dengan lebih baik.
            </span>
          </h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Mulai gratis dan pantau keuanganmu dengan mudah.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/register">
              <button className="h-11 px-6 rounded-xl text-sm font-semibold bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-glow)] hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                Mulai Sekarang <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/login">
              <button className="h-11 px-6 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
                Sudah punya akun
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 px-6 py-10 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold">Track Smart, Split Easy</span>
            </div>
            <div className="flex gap-6">
              <button onClick={() => setShowPrivacy(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </button>
              <button onClick={() => setShowTerms(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </button>
            </div>
          </div>
          <div className="border-t border-border/60 pt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© 2026 Track Smart, Split Easy · Coding Camp 2026 powered by DBS Foundation</p>
            <p className="text-xs text-muted-foreground">Tim CC26-PSU045</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
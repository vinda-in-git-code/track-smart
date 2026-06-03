import { createContext, useContext, useState } from 'react'

type MobilePageTitleCtx = {
  title: string
  subtitle?: string
  setTitle: (title: string, subtitle?: string) => void
}

const Ctx = createContext<MobilePageTitleCtx>({ title: '', setTitle: () => {} })

export function MobilePageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitleState] = useState('')
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined)

  const setTitle = (t: string, s?: string) => {
    setTitleState(t)
    setSubtitle(s)
  }

  return (
    <Ctx.Provider value={{ title, subtitle, setTitle }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMobilePageTitle() {
  return useContext(Ctx)
}

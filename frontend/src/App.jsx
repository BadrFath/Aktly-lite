import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import AddressInfoPage from './pages/AddressInfoPage'
import CompanyInfoPage from './pages/CompanyInfoPage'
import DepositairePage from './pages/DepositairePage'
import FinalDossierPage from './pages/FinalDossierPage'
import StripePage from './pages/StripePage'
import StripeResultPage from './pages/StripeResultPage'

const navRoutes = ['/stripe', '/company', '/depositaire', '/adresse-info', '/dossier-final']

const buildNavItems = (uiLanguage) =>
  uiLanguage === 'nl'
    ? [
        { to: '/stripe', label: '1. Stripe betaling' },
        { to: '/company', label: '2. Bedrijfsinfo' },
        { to: '/depositaire', label: '3. Bewaarnemer + Veriff' },
        { to: '/adresse-info', label: '4. Nieuwe adressen' },
        { to: '/dossier-final', label: '5. Betaling + Dossier' },
      ]
    : [
        { to: '/stripe', label: '1. Paiement Stripe' },
        { to: '/company', label: '2. Infos societe' },
        { to: '/depositaire', label: '3. Depositaire + Veriff' },
        { to: '/adresse-info', label: '4. Nouvelles adresses' },
        { to: '/dossier-final', label: '5. Paiement + Dossier' },
      ]

const getStepIndex = (pathname) => navRoutes.findIndex((route) => route === pathname)

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentStep = getStepIndex(location.pathname)
  const isAuthPage = location.pathname === '/auth'
  const [uiLanguage, setUiLanguage] = useState(localStorage.getItem('aktly_ui_language') || 'fr')
  const [showFilesLangPrompt, setShowFilesLangPrompt] = useState(false)
  const [filesLanguage, setFilesLanguage] = useState(localStorage.getItem('aktly_files_language') || 'fr')
  const [pendingRoute, setPendingRoute] = useState('')
  const [privilegedAccess, setPrivilegedAccess] = useState(false)
  const navItems = buildNavItems(uiLanguage)
  const t = uiLanguage === 'nl'
    ? {
        secureLogin: 'Veilige login',
        flowTitle: '5-stappen traject (auth buiten traject)',
        uiLanguage: 'UI-taal',
        logout: 'Afmelden',
        step2Tag: 'Stap 2',
        filesLangTitle: 'Bestandstaal kiezen',
        filesLangDesc: 'Deze taal bepaalt de bestanden die later worden gegenereerd.',
        confirm: 'Bevestigen',
      }
    : {
        secureLogin: 'Connexion securisee',
        flowTitle: 'Parcours 5 etapes (auth hors parcours)',
        uiLanguage: 'Langue UI',
        logout: 'Deconnexion',
        step2Tag: 'Etape 2',
        filesLangTitle: 'Choisir la langue des fichiers',
        filesLangDesc: 'Cette langue controle les fichiers generes par la suite.',
        confirm: 'Confirmer',
      }

  useEffect(() => {
    let cancelled = false

    const loadAccessScope = async () => {
      const token = localStorage.getItem('aktly_auth_token') || ''
      if (!token) {
        if (!cancelled) {
          setPrivilegedAccess(false)
        }
        return
      }

      try {
        const response = await fetch('/api/auth/access-scope', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Auth-Token': token,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json().catch(() => ({}))
        if (!cancelled) {
          setPrivilegedAccess(Boolean(payload?.privileged))
        }
      } catch {
        if (!cancelled) {
          setPrivilegedAccess(false)
        }
      }
    }

    loadAccessScope()

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname === '/company' && !localStorage.getItem('aktly_files_language')) {
      setShowFilesLangPrompt(true)
      setPendingRoute('')
    }
  }, [location.pathname])

  const onLogout = () => {
    localStorage.clear()
    sessionStorage.clear()
    setPrivilegedAccess(false)
    navigate('/auth')
  }

  const onChangeUiLanguage = (event) => {
    const next = event.target.value
    setUiLanguage(next)
    localStorage.setItem('aktly_ui_language', next)
  }

  const onSelectFilesLanguage = () => {
    localStorage.setItem('aktly_files_language', filesLanguage)
    window.dispatchEvent(new CustomEvent('aktly-files-language-changed', { detail: filesLanguage }))
    setShowFilesLangPrompt(false)

    if (pendingRoute) {
      navigate(pendingRoute)
      setPendingRoute('')
    }
  }

  const onStepClick = (event, route) => {
    if (route === '/company' && !localStorage.getItem('aktly_files_language')) {
      event.preventDefault()
      setPendingRoute('/company')
      setShowFilesLangPrompt(true)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f766e_0%,#0f172a_34%,#020617_70%)] text-slate-100">
      <span className="bg-orb orb-a" aria-hidden="true"></span>
      <span className="bg-orb orb-b" aria-hidden="true"></span>
      <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Aktly Lite</p>
            <h1 className="text-lg font-semibold">
              {isAuthPage ? t.secureLogin : t.flowTitle}
            </h1>
          </div>
          {!isAuthPage && (
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-1">
              <nav className="flex flex-wrap gap-2">
              {navItems.map((item, index) => {
                const active = location.pathname === item.to
                const done = currentStep > index

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={(event) => onStepClick(event, item.to)}
                    className={`step-pill rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? 'border-emerald-300 bg-emerald-300/15 text-emerald-200'
                        : done
                          ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200'
                          : 'border-slate-600 text-slate-300 hover:border-emerald-300/60 hover:text-emerald-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              </nav>
              <label className="ml-auto flex items-center gap-2 rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-200">
                <span>{t.uiLanguage}</span>
                <select
                  value={uiLanguage}
                  onChange={onChangeUiLanguage}
                  className="rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
                >
                  <option value="fr">Francais</option>
                  <option value="nl">Nederlands</option>
                </select>
              </label>
              <button
                type="button"
                onClick={onLogout}
                className="wow-btn rounded-full border border-rose-300/60 bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 hover:from-rose-400 hover:to-orange-300"
              >
                {t.logout}
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-8 md:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/stripe" element={<StripePage />} />
              <Route path="/stripe/result" element={<StripeResultPage />} />
              <Route path="/company" element={<CompanyInfoPage privilegedAccess={privilegedAccess} uiLanguage={uiLanguage} />} />
              <Route path="/depositaire" element={<DepositairePage />} />
              <Route path="/adresse-info" element={<AddressInfoPage />} />
              <Route path="/dossier-final" element={<FinalDossierPage privilegedAccess={privilegedAccess} />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </section>

      {showFilesLangPrompt && !isAuthPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-300">{t.step2Tag}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-100">{t.filesLangTitle}</h3>
            <p className="mt-2 text-sm text-slate-300">
              {t.filesLangDesc}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFilesLanguage('fr')}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  filesLanguage === 'fr'
                    ? 'border-amber-300 bg-amber-300/15 text-amber-100'
                    : 'border-slate-600 text-slate-300 hover:border-amber-300/50'
                }`}
              >
                Francais
              </button>
              <button
                type="button"
                onClick={() => setFilesLanguage('nl')}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  filesLanguage === 'nl'
                    ? 'border-amber-300 bg-amber-300/15 text-amber-100'
                    : 'border-slate-600 text-slate-300 hover:border-amber-300/50'
                }`}
              >
                Nederlands
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onSelectFilesLanguage}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default AppLayout

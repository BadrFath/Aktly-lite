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
import LegacyStep1Page from './pages/legacy/LegacyStep1Page'
import LegacyStep1ValidatePage from './pages/legacy/LegacyStep1ValidatePage'
import LegacyStep2Page from './pages/legacy/LegacyStep2Page'
import LegacyStep3Page from './pages/legacy/LegacyStep3Page'
import LegacyStep4Page from './pages/legacy/LegacyStep4Page'
import LegacyStep5Page from './pages/legacy/LegacyStep5Page'
import LegacyStep6Page from './pages/legacy/LegacyStep6Page'
import LegacyFinishPage from './pages/legacy/LegacyFinishPage'
import LegacyBuyCreditsPage from './pages/legacy/LegacyBuyCreditsPage'

const navRoutes = ['/stripe', '/company', '/depositaire', '/adresse-info', '/dossier-final']
const legacyNavRoutes = [
  '/legacy/step1', '/legacy/step1-validate', '/legacy/step2',
  '/legacy/step3', '/legacy/step4', '/legacy/step5',
]
const legacySessionKeys = [
  'demande_id', 'missing_fields_data', 'entreprise_number',
  'ia_text_pv', 'ia_text_extrait', 'depositaire_api_disabled', 'depositaire_fallback',
]
const privilegedEmails = new Set(['badrfath16@gmail.com', 'contact@legakte.be'])
const dossierResetKeys = [
  'aktly_payment',
  'aktly_payment_verified',
  'aktly_company_data',
  'aktly_depositaire',
  'aktly_address_info',
  'aktly_documents_lang',
  'aktly_veriff_url',
  'aktly_veriff_notification',
  'aktly_step_2',
  'aktly_step_3',
  'aktly_step_4',
  'aktly_step_5',
]

const buildLegacyNavItems = (uiLanguage) =>
  uiLanguage === 'nl'
    ? [
        { to: '/legacy/step1', label: '1. Bedrijf zoeken' },
        { to: '/legacy/step1-validate', label: '2. Bedrijfsdetails' },
        { to: '/legacy/step2', label: '3. Bewaarder' },
        { to: '/legacy/step3', label: '4. Data & plaats' },
        { to: '/legacy/step4', label: '5. PV (IA)' },
        { to: '/legacy/step5', label: '6. Uittreksel (IA)' },
      ]
    : [
        { to: '/legacy/step1', label: '1. Recherche entreprise' },
        { to: '/legacy/step1-validate', label: '2. Details entreprise' },
        { to: '/legacy/step2', label: '3. Depositaire' },
        { to: '/legacy/step3', label: '4. Dates & lieu' },
        { to: '/legacy/step4', label: '5. PV (IA)' },
        { to: '/legacy/step5', label: '6. Extrait (IA)' },
      ]

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
  const isLegacyRoute = location.pathname.startsWith('/legacy/')
  const [uiLanguage, setUiLanguage] = useState(localStorage.getItem('aktly_ui_language') || 'fr')
  const [showFilesLangPrompt, setShowFilesLangPrompt] = useState(false)
  const [filesLanguage, setFilesLanguage] = useState(localStorage.getItem('aktly_files_language') || 'fr')
  const [pendingRoute, setPendingRoute] = useState('')
  const [privilegedAccess, setPrivilegedAccess] = useState(
    localStorage.getItem('aktly_privileged_access') === 'true',
  )
  const navItems = buildNavItems(uiLanguage)
  const legacyNavItems = buildLegacyNavItems(uiLanguage)
  const t = uiLanguage === 'nl'
    ? {
        secureLogin: 'Veilige login',
        flowTitle: isLegacyRoute ? 'Legacy 6-stappen traject' : '5-stappen traject (auth buiten traject)',
        uiLanguage: 'UI-taal',
        logout: 'Afmelden',
        createFolder: isLegacyRoute ? 'Dossier aanmaken' : 'Dossier aanmaken',
        buyCredits: 'Credits kopen',
        step2Tag: 'Stap 2',
        filesLangTitle: 'Bestandstaal kiezen',
        filesLangDesc: 'Deze taal bepaalt de bestanden die later worden gegenereerd.',
        confirm: 'Bevestigen',
      }
    : {
        secureLogin: 'Connexion securisee',
        flowTitle: isLegacyRoute ? 'Parcours legacy 6 etapes' : 'Parcours 5 etapes (auth hors parcours)',
        uiLanguage: 'Langue UI',
        logout: 'Deconnexion',
        createFolder: 'Creer un dossier',
        buyCredits: 'Acheter des credits',
        step2Tag: 'Etape 2',
        filesLangTitle: 'Choisir la langue des fichiers',
        filesLangDesc: 'Cette langue controle les fichiers generes par la suite.',
        confirm: 'Confirmer',
      }

  useEffect(() => {
    let cancelled = false

    const loadAccessScope = async () => {
      const token = localStorage.getItem('aktly_auth_token') || ''
      const localUser = (() => {
        const raw = localStorage.getItem('aktly_user')
        return raw ? JSON.parse(raw) : null
      })()
      const localEmail = String(localUser?.email || '').trim().toLowerCase()

      if (!token) {
        if (!cancelled) {
          const isAllowed = privilegedEmails.has(localEmail)
          setPrivilegedAccess(isAllowed)
          localStorage.setItem('aktly_privileged_access', isAllowed ? 'true' : 'false')
          if (isAllowed) {
            localStorage.setItem('aktly_payment_verified', 'true')
            localStorage.setItem('aktly_step_2', 'done')
          }
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
          if (response.status === 401) {
            localStorage.removeItem('aktly_auth_token')
          }
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json().catch(() => ({}))
        if (!cancelled) {
          const apiEmail = String(payload?.email || '').trim().toLowerCase()
          const isAllowed = Boolean(payload?.privileged) || privilegedEmails.has(apiEmail) || privilegedEmails.has(localEmail)
          setPrivilegedAccess(isAllowed)
          localStorage.setItem('aktly_privileged_access', isAllowed ? 'true' : 'false')
          if (isAllowed) {
            localStorage.setItem('aktly_payment_verified', 'true')
            localStorage.setItem('aktly_step_2', 'done')
          }
        }
      } catch {
        if (!cancelled) {
          const isAllowed = privilegedEmails.has(localEmail)
          setPrivilegedAccess(isAllowed)
          localStorage.setItem('aktly_privileged_access', isAllowed ? 'true' : 'false')
          if (isAllowed) {
            localStorage.setItem('aktly_payment_verified', 'true')
            localStorage.setItem('aktly_step_2', 'done')
          }
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

  const onCreateFolder = () => {
    if (isLegacyRoute) {
      legacySessionKeys.forEach((key) => sessionStorage.removeItem(key))
      navigate('/legacy/step1')
    } else {
      dossierResetKeys.forEach((key) => localStorage.removeItem(key))
      navigate('/stripe')
    }
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
              <button
                type="button"
                onClick={onCreateFolder}
                className="step-pill inline-flex items-center gap-2 rounded-full border border-slate-600 bg-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:border-emerald-300/60 hover:text-emerald-100"
              >
                <span aria-hidden="true">+</span>
                {t.createFolder}
              </button>
              {isLegacyRoute
                ? legacyNavItems.map((item) => {
                    const active = location.pathname === item.to
                    const itemIdx = legacyNavRoutes.findIndex((r) => r === item.to)
                    const currentLegacyIdx = legacyNavRoutes.findIndex((r) => r === location.pathname)
                    const done = currentLegacyIdx > itemIdx

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
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
                  })
                : navItems.map((item, index) => {
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
                  })
              }
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
              <Route path="/auth" element={<AuthPage uiLanguage={uiLanguage} />} />
              <Route path="/stripe" element={<StripePage uiLanguage={uiLanguage} />} />
              <Route path="/stripe/result" element={<StripeResultPage uiLanguage={uiLanguage} />} />
              <Route path="/company" element={<CompanyInfoPage privilegedAccess={privilegedAccess} uiLanguage={uiLanguage} />} />
              <Route path="/depositaire" element={<DepositairePage uiLanguage={uiLanguage} />} />
              <Route path="/adresse-info" element={<AddressInfoPage uiLanguage={uiLanguage} />} />
              <Route path="/dossier-final" element={<FinalDossierPage privilegedAccess={privilegedAccess} uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step1" element={<LegacyStep1Page uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step1-validate" element={<LegacyStep1ValidatePage uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step2" element={<LegacyStep2Page uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step3" element={<LegacyStep3Page uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step4" element={<LegacyStep4Page uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step5" element={<LegacyStep5Page uiLanguage={uiLanguage} />} />
              <Route path="/legacy/step6" element={<LegacyStep6Page uiLanguage={uiLanguage} />} />
              <Route path="/legacy/finish" element={<LegacyFinishPage uiLanguage={uiLanguage} />} />
              <Route path="/legacy/buy-credits" element={<LegacyBuyCreditsPage uiLanguage={uiLanguage} />} />
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

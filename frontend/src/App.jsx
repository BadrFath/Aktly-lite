import { AnimatePresence, motion } from 'framer-motion'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import AddressInfoPage from './pages/AddressInfoPage'
import CompanyInfoPage from './pages/CompanyInfoPage'
import DepositairePage from './pages/DepositairePage'
import FinalDossierPage from './pages/FinalDossierPage'
import StripePage from './pages/StripePage'

const navItems = [
  { to: '/stripe', label: '1. Paiement Stripe' },
  { to: '/company', label: '2. Infos societe' },
  { to: '/depositaire', label: '3. Depositaire + Veriff' },
  { to: '/adresse-info', label: '4. Nouvelles adresses' },
  { to: '/dossier-final', label: '5. Paiement + Dossier' },
]

const getStepIndex = (pathname) => navItems.findIndex((item) => item.to === pathname)

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentStep = getStepIndex(location.pathname)
  const isAuthPage = location.pathname === '/auth'

  const onLogout = () => {
    localStorage.clear()
    sessionStorage.clear()
    navigate('/auth')
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
              {isAuthPage ? 'Connexion securisee' : 'Parcours 5 etapes (auth hors parcours)'}
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
              <button
                type="button"
                onClick={onLogout}
                className="wow-btn ml-auto rounded-full border border-rose-300/60 bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 hover:from-rose-400 hover:to-orange-300"
              >
                Deconnexion
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
              <Route path="/company" element={<CompanyInfoPage />} />
              <Route path="/depositaire" element={<DepositairePage />} />
              <Route path="/adresse-info" element={<AddressInfoPage />} />
              <Route path="/dossier-final" element={<FinalDossierPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  )
}

export default AppLayout

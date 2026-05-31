import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'

function LegacyBuyCreditsPage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()

  const t = uiLanguage === 'nl'
    ? {
        title: 'Geen credits beschikbaar',
        message: 'U heeft geen beschikbare credits. Koop credits om door te gaan.',
        cta: 'Credits kopen',
      }
    : {
        title: 'Credits insuffisants',
        message: "Vous n'avez pas de credits disponibles. Veuillez acheter des credits pour continuer.",
        cta: 'Acheter des credits',
      }

  return (
    <motion.div className="mx-auto max-w-md" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-10 text-center shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Legacy</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">{t.title}</h2>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">{t.message}</p>

        <button
          type="button"
          onClick={() => navigate('/stripe')}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-amber-900/30 transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          {t.cta}
        </button>
      </motion.div>
    </motion.div>
  )
}

export default LegacyBuyCreditsPage

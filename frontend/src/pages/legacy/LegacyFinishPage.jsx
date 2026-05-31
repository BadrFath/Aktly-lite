import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'

const API_BASE = '/api/legacy-proxy'

const legacySessionKeys = [
  'demande_id', 'missing_fields_data', 'entreprise_number',
  'ia_text_pv', 'ia_text_extrait', 'depositaire_api_disabled', 'depositaire_fallback',
]

function LegacyFinishPage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const demandeId = sessionStorage.getItem('demande_id') ?? '—'

  const t = uiLanguage === 'nl'
    ? {
        title: 'Dossier succesvol aangemaakt!',
        subtitle: 'Uw dossier is met succes verwerkt.',
        demandeLabel: 'Aanvraag-ID',
        newDossier: 'Nieuw dossier aanmaken',
        dashboard: 'Terug naar dashboard',
      }
    : {
        title: 'Dossier cree avec succes!',
        subtitle: 'Votre dossier a ete traite avec succes.',
        demandeLabel: 'ID de la demande',
        newDossier: 'Creer un nouveau dossier',
        dashboard: 'Retour au tableau de bord',
      }

  const onNewDossier = () => {
    legacySessionKeys.forEach((k) => sessionStorage.removeItem(k))
    navigate('/legacy/step1')
  }

  return (
    <motion.div className="mx-auto max-w-lg" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-10 text-center shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 14 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40"
        >
          <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>

        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Legacy</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">{t.title}</h2>
        <p className="mt-2 text-sm text-slate-400">{t.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/60 px-6 py-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">{t.demandeLabel}</p>
          <p className="mt-1 text-lg font-mono font-semibold text-emerald-300">{demandeId}</p>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs uppercase tracking-wider text-slate-500">
            {uiLanguage === 'nl' ? 'Documenten downloaden' : 'Télécharger les documents'}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: 'Formulaire 1', type: 'formulaire1' },
              { label: 'Formulaire 2', type: 'formulaire2' },
              { label: 'Déclaration particulière', type: 'declaration' },
              { label: 'Attestation modèle 2', type: 'attestation' },
              { label: 'Procès-verbal AG', type: 'pv' },
            ].map(({ label, type }) => (
              <a
                key={type}
                href={`${API_BASE}/demandes/${demandeId}/download/${type}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-700/60 hover:text-emerald-300"
              >
                <span>{label}</span>
                <svg className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onNewDossier}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            {t.newDossier}
          </button>
          <button
            type="button"
            onClick={() => navigate('/stripe')}
            className="w-full rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
          >
            {t.dashboard}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default LegacyFinishPage

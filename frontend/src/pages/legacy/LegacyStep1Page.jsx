import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost } from '../../lib/legacyApi'

const legacySessionKeys = [
  'demande_id', 'missing_fields_data', 'entreprise_number',
  'ia_text_pv', 'ia_text_extrait', 'depositaire_api_disabled', 'depositaire_fallback',
]

function LegacyStep1Page({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [enterpriseNumber, setEnterpriseNumber] = useState('')
  const [langue, setLangue] = useState('fr')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const inputRef = useRef(null)

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap 1 - Bedrijf zoeken',
        subtitle: 'Voer het ondernemingsnummer in om het bedrijf op te zoeken.',
        label: 'Ondernemingsnummer (10 cijfers)',
        placeholder: '0123456789',
        langLabel: 'Taal van de documenten',
        search: 'Zoeken',
        cancel: 'Annuleren',
        confirm: 'Bevestigen',
        confirmMsg: 'Deze bewerking verbruikt een krediet. Wilt u doorgaan?',
        errLength: 'Het ondernemingsnummer moet exact 10 tekens bevatten.',
        errType: 'Alleen ELP-type ondernemingen worden ondersteund.',
        errStatus: 'Het bedrijf moet actief zijn (Actief).',
        errGeneric: 'Er is een fout opgetreden. Probeer opnieuw.',
      }
    : {
        title: 'Etape 1 - Recherche entreprise',
        subtitle: "Entrez le numero d'entreprise pour rechercher la societe.",
        label: "Numero d'entreprise (10 chiffres)",
        placeholder: '0123456789',
        langLabel: 'Langue des documents',
        search: 'Chercher',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        confirmMsg: 'Cette operation va consommer un credit. Voulez-vous continuer?',
        errLength: "Le numero d'entreprise doit contenir exactement 10 caracteres.",
        errType: 'Seules les entreprises de type ELP sont prises en charge.',
        errStatus: "L'entreprise doit etre active (Actif).",
        errGeneric: 'Une erreur est survenue. Veuillez reessayer.',
      }

  useEffect(() => {
    legacySessionKeys.forEach((k) => sessionStorage.removeItem(k))

    const checkCredits = async () => {
      try {
        const data = await legacyGet('/billing/subscription')
        const hasCredits = data?.credits > 0 || data?.active_subscription || data?.valid_coupon
        if (!hasCredits) {
          navigate('/legacy/buy-credits')
        }
      } catch {
        // allow user to proceed if billing check fails
      }
    }

    checkCredits()
    inputRef.current?.focus()
  }, [navigate])

  const onSearchClick = () => {
    setError('')
    if (enterpriseNumber.trim().length !== 10) {
      setError(t.errLength)
      return
    }
    setShowConfirm(true)
  }

  const onConfirm = async () => {
    setShowConfirm(false)
    setLoading(true)
    setError('')
    try {
      const data = await legacyPost('/getEnterpriseByNumber', {
        enterprise_number: enterpriseNumber.trim(),
        langue,
      })

      const typeOk = data?.typeOfEnterprise === 'ELP'
      if (!typeOk) {
        setError(t.errType)
        setLoading(false)
        return
      }

      const status = data?.juridicalSituation?.status ?? data?.juridicalSituations?.[0]?.status ?? ''
      if (status !== 'Actif' && status !== 'Actief') {
        setError(t.errStatus)
        setLoading(false)
        return
      }

      const demande = await legacyPost('/demandes', {
        enterprise_number: enterpriseNumber.trim(),
        bce_data: data,
        langue,
      })

      sessionStorage.setItem('demande_id', String(demande?.id ?? demande?.demande_id ?? ''))
      sessionStorage.setItem('entreprise_number', enterpriseNumber.trim())
      navigate('/legacy/step1-validate')
    } catch (err) {
      setError(err?.message || t.errGeneric)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div className="mx-auto max-w-xl" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Legacy</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">{t.title}</h2>
        <p className="mt-2 text-sm text-slate-400">{t.subtitle}</p>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.label}</label>
            <input
              ref={inputRef}
              type="text"
              maxLength={10}
              value={enterpriseNumber}
              onChange={(e) => setEnterpriseNumber(e.target.value.replace(/\D/g, ''))}
              placeholder={t.placeholder}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.langLabel}</label>
            <div className="flex gap-4">
              {['fr', 'nl'].map((l) => (
                <label key={l} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="langue"
                    value={l}
                    checked={langue === l}
                    onChange={() => setLangue(l)}
                    className="accent-emerald-400"
                  />
                  {l === 'fr' ? 'Francais' : 'Nederlands'}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onSearchClick}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {uiLanguage === 'nl' ? 'Laden...' : 'Chargement...'}
              </span>
            ) : t.search}
          </button>
        </div>
      </motion.div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <p className="text-center text-slate-200">{t.confirmMsg}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-400 hover:text-slate-100"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                {t.confirm}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

export default LegacyStep1Page

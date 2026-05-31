import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost } from '../../lib/legacyApi'

function extractDesc(desc, lang) {
  if (!desc) return ''
  if (typeof desc === 'string') return desc
  if (Array.isArray(desc)) {
    const match = desc.find(d => d?.language === lang) ?? desc[0]
    return match?.value ?? ''
  }
  return desc?.value ?? ''
}

function parseBceData(bceData) {
  if (!bceData) return {}

  let parsed = bceData
  if (typeof bceData === 'string') {
    try { parsed = JSON.parse(bceData) } catch { return {} }
  }

  const lang = parsed?.lang_entre || 'fr'

  const denom = parsed?.denomination
  let name = ''
  if (Array.isArray(denom)) {
    name = extractDesc(denom[0]?.description, lang)
  } else if (denom) {
    name = extractDesc(denom?.description, lang) || String(denom)
  }

  const enterpriseNumber = parsed?.enterpriseNumber ?? parsed?.enterprise_number ?? parsed?.number ?? ''

  const addr = Array.isArray(parsed?.addresses)
    ? parsed.addresses[0]
    : (typeof parsed?.address === 'object' && parsed?.address !== null ? parsed.address : {})
  const fullAddress = addr?.full ?? (typeof parsed?.address === 'string' ? parsed.address : '')
  if (fullAddress) return { name, enterpriseNumber, address: fullAddress }

  const street = addr?.street ?? ''
  const house = addr?.houseNumber ?? addr?.house_number ?? ''
  const box = addr?.box ?? ''
  const zip = addr?.postalCode ?? addr?.zipcode ?? addr?.zipCode ?? ''
  const muni = addr?.municipality ?? ''
  const country = addr?.country ?? ''

  const addressParts = [
    street && house ? (street + ' ' + house + (box ? ' bte ' + box : '')) : street,
    [zip, muni].filter(Boolean).join(' '),
    country,
  ].filter(Boolean)

  return { name, enterpriseNumber, address: addressParts.join(', ') }
}

function LegacyStep1ValidatePage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [demande, setDemande] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap 2 - Bedrijfsdetails',
        company: 'Bedrijfsnaam',
        number: 'Ondernemingsnummer',
        address: 'Adres',
        back: 'Terug',
        next: 'Volgende',
        errLoad: 'Kan de aanvraag niet laden.',
      }
    : {
        title: 'Etape 2 - Details entreprise',
        company: 'Raison sociale',
        number: "Numero d'entreprise",
        address: 'Adresse',
        back: 'Retour',
        next: 'Suivant',
        errLoad: 'Impossible de charger la demande.',
      }

  useEffect(() => {
    const id = sessionStorage.getItem('demande_id')
    if (!id) {
      navigate('/legacy/step1')
      return
    }

    const load = async () => {
      try {
        const data = await legacyGet(`/demandes/${id}`)
        setDemande(data)
      } catch {
        setError(t.errLoad)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [navigate, t.errLoad])

  const onNext = async () => {
    const id = sessionStorage.getItem('demande_id')
    try {
      await legacyPost(`/demandes/${id}/progress`, { progress: 25 })
    } catch {
      // non-blocking
    }
    navigate('/legacy/step2')
  }

  const info = parseBceData(demande?.bce_data)

  return (
    <motion.div className="mx-auto max-w-xl" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Legacy</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">{t.title}</h2>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : error ? (
          <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        ) : (
          <motion.div variants={cardReveal} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 space-y-3">
              <Row label={t.company} value={info.name} />
              <Row label={t.number} value={info.enterpriseNumber || demande?.enterprise_number} />
              <Row label={t.address} value={info.address} />
            </div>
          </motion.div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed opacity-50"
          >
            {t.back}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={loading || !!error}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.next}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm text-slate-200">{value || 'â€”'}</span>
    </div>
  )
}

export default LegacyStep1ValidatePage

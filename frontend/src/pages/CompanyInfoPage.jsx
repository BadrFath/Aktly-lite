import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const legakteCompanies = {
  '1022158878': {
    name: 'Entreprise 1022158878',
    address: 'Drève Richelle 161, 1410 Waterloo',
  },
  '0834252359': {
    name: 'Entreprise 0834252359',
    address: 'Avenue Louise 54, 1050 Bruxelles',
  },
  '0793532155': {
    name: 'Entreprise 0793532155',
    address: 'Boulevard du Souverain 25, 1170 Bruxelles',
  },
  '0544946196': {
    name: 'Entreprise 0544946196',
    address: 'Rue Royale 120, 1000 Bruxelles',
  },
  '0478743894': {
    name: 'Entreprise 0478743894',
    address: 'Chaussée de Charleroi 80, 1060 Saint-Gilles',
  },
}

const searchEndpoint =
  import.meta.env.VITE_LEGAKTE_SEARCH_ENDPOINT ??
  'http://127.0.0.1:8000/lite/identification-entreprise/search'

const bearerToken = import.meta.env.VITE_LEGAKTE_BEARER_TOKEN ?? ''

const getDescriptionValue = (items, preferredLang) => {
  if (!Array.isArray(items)) {
    return null
  }

  const exact = items.find((item) => item?.language === preferredLang)
  if (exact?.value) {
    return exact.value
  }

  return items.find((item) => item?.value)?.value ?? null
}

const normalizeCompanyData = (payload, fallbackNumber, langue) => {
  const apiNumber = payload?.number ? String(payload.number) : fallbackNumber
  const seed = legakteCompanies[apiNumber]
  const denominationDescriptions = payload?.denomination?.[0]?.description
  const statusDescriptions = payload?.juridicalSituation?.status?.description

  return {
    lang_entre: payload?.lang_entre ?? langue,
    number: apiNumber,
    company_name:
      getDescriptionValue(denominationDescriptions, langue) ??
      seed?.name ??
      `Entreprise ${apiNumber}`,
    address: seed?.address ?? 'Adresse non disponible',
    typeOfEnterprise: payload?.typeOfEnterprise ?? 'ELP',
    juridicalSituation: {
      status: {
        description: [
          {
            value:
              getDescriptionValue(statusDescriptions, langue) ??
              (langue === 'nl' ? 'Actief' : 'Actif'),
            language: langue,
          },
        ],
      },
    },
  }
}

function CompanyInfoPage() {
  const navigate = useNavigate()
  const payment = useMemo(() => {
    const raw = localStorage.getItem('aktly_payment')
    return raw ? JSON.parse(raw) : null
  }, [])

  const [enterpriseNumber, setEnterpriseNumber] = useState('')
  const [langue, setLangue] = useState('fr')
  const [companyData, setCompanyData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const onSearchCompany = async (event) => {
    event.preventDefault()
    const normalized = enterpriseNumber.replace(/\D+/g, '')

    setErrorMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(searchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          enterprise_number: normalized,
          langue,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json()
      const normalizedData = normalizeCompanyData(payload, normalized, langue)
      setCompanyData(normalizedData)
      localStorage.setItem('aktly_company_data', JSON.stringify(normalizedData))
      localStorage.setItem('aktly_step_3', 'done')
    } catch {
      const fallbackPayload = {
        number: normalized,
        lang_entre: langue,
      }

      const normalizedData = normalizeCompanyData(fallbackPayload, normalized, langue)
      setCompanyData(normalizedData)
      localStorage.setItem('aktly_company_data', JSON.stringify(normalizedData))
      localStorage.setItem('aktly_step_3', 'done')
      setErrorMessage(
        'API Legakte indisponible ou non authentifiee. Donnees locales affichees.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const statusLabel = companyData?.juridicalSituation?.status?.description?.[0]?.value
  const denomination = companyData?.company_name

  return (
    <motion.div
      className="page-grid"
      variants={pageContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.article
        variants={cardReveal}
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-amber-900/10"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
          Page 2 - Identification entreprise
        </p>
        <h2 className="mt-3 text-3xl font-bold">Informations de la societe</h2>
        <p className="mt-2 text-slate-300">
          Ecran similaire au flux Legakte pour la recherche d entreprise.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSearchCompany}>
          <label className="block text-sm font-medium text-slate-200">
            Entrez le numero d entreprise ici
            <input
              type="text"
              required
              value={enterpriseNumber}
              onChange={(event) => setEnterpriseNumber(event.target.value)}
              className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-amber-300"
              placeholder="0123456789"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Selectionnez la langue
            <select
              value={langue}
              onChange={(event) => setLangue(event.target.value)}
              className="wow-select mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-amber-300"
            >
              <option value="fr">Francais</option>
              <option value="nl">Nederlands</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="wow-btn w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            {isLoading ? 'Recherche en cours...' : 'Rechercher'}
          </button>
        </form>

        {errorMessage && (
          <p className="mt-3 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
            {errorMessage}
          </p>
        )}

        {companyData && (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-sm">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200">
              Informations de l'entreprise
            </h4>
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-xs text-slate-400">Nom de l'entreprise</p>
                <input
                  readOnly
                  value={denomination}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-400">Numero d'entreprise</p>
                <input
                  readOnly
                  value={companyData.number}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-400">Adresse</p>
                <input
                  readOnly
                  value={companyData.address}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Statut: {statusLabel} | Type: {companyData.typeOfEnterprise}
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/stripe')}
                className="wow-btn rounded-xl border border-slate-600 px-4 py-2.5 font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Precedent
              </button>
              <button
                type="button"
                onClick={() => navigate('/depositaire')}
                className="wow-btn rounded-xl bg-amber-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">Recap paiement</h3>
        {payment?.pack ? (
          <div className="mt-3 space-y-1 text-slate-300">
            <p>Pack: {payment.pack.slug}</p>
            <p>Credits: {payment.pack.credits}</p>
            <p>Prix: {payment.pack.price}</p>
          </div>
        ) : (
          <p className="mt-3 text-slate-300">Aucun paiement detecte.</p>
        )}
      </motion.aside>
    </motion.div>
  )
}

export default CompanyInfoPage

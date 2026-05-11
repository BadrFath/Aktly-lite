import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const fallbackDirigeants = [
  {
    id: '657',
    demandeId: 'a0eaa59a-31f1-4e54-8b16-0ec5f69705d3',
    surname: 'El Yakoubi',
    givenName: 'Mohamed',
    function: 'Administrateur',
  },
  {
    id: '652',
    demandeId: 'a0d5cc74-2911-4044-9369-e05188669e5f',
    surname: 'Pousseur',
    givenName: 'Celine',
    function: 'Administrateur',
  },
  {
    id: '648',
    demandeId: 'a0d4497b-c8bf-4e04-af9a-476fb23d93c3',
    surname: 'Proye',
    givenName: 'Glenn',
    function: 'Administrateur',
  },
  {
    id: '632',
    demandeId: 'a0cd2c29-3bf3-4b68-8f39-11e4093b3a5f',
    surname: 'Schroeter',
    givenName: 'Loic',
    function: 'Bestuurder',
  },
]

const dirigeantsEndpoint = import.meta.env.VITE_LEGAKTE_DIRIGEANTS_ENDPOINT ?? ''
const bearerToken = import.meta.env.VITE_LEGAKTE_BEARER_TOKEN ?? ''

const normalizeDirigeant = (row, index) => {
  const fullName = (row?.name ?? '').trim()
  let givenName = row?.givenName ?? row?.given_name ?? row?.prenom ?? ''
  let surname = row?.surname ?? row?.lastName ?? row?.nom ?? ''

  if (!givenName && !surname && fullName) {
    const parts = fullName.split(/\s+/)
    givenName = parts.shift() ?? ''
    surname = parts.join(' ')
  }

  const functionLabel = row?.function ?? row?.fonction ?? row?.role ?? 'Administrateur'
  const demandeId =
    row?.demandeId ?? row?.demande_id ?? row?.idDemande ?? row?.request_id ?? 'N/A'
  const id = String(row?.id ?? `${demandeId}-${index}`)

  return {
    id,
    demandeId: String(demandeId),
    givenName: String(givenName || '').trim(),
    surname: String(surname || '').trim(),
    function: String(functionLabel),
  }
}

const extractRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.dirigeants)) {
    return payload.dirigeants
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  return []
}

function DepositairePage() {
  const navigate = useNavigate()
  const [type, setType] = useState('comptable')
  const [dirigeants, setDirigeants] = useState(fallbackDirigeants)
  const [selectedDirigeantId, setSelectedDirigeantId] = useState(fallbackDirigeants[0]?.id ?? '')
  const [gsm, setGsm] = useState('+32470123456')
  const [veriffSent, setVeriffSent] = useState(false)
  const [sourceLabel, setSourceLabel] = useState('SQLite locale')
  const [apiError, setApiError] = useState('')
  const [isLoadingDirigeants, setIsLoadingDirigeants] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadDirigeants = async () => {
      if (!dirigeantsEndpoint) {
        setSourceLabel('SQLite locale')
        return
      }

      setIsLoadingDirigeants(true)
      setApiError('')

      try {
        const response = await fetch(dirigeantsEndpoint, {
          method: 'GET',
          headers: {
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json()
        const normalized = extractRows(payload)
          .map(normalizeDirigeant)
          .filter((row) => row.givenName || row.surname)

        if (!cancelled && normalized.length > 0) {
          setDirigeants(normalized)
          setSourceLabel('API Legakte live')
        } else if (!cancelled) {
          setApiError('API connectee, mais aucun dirigeant n a ete retourne.')
          setSourceLabel('SQLite locale')
        }
      } catch {
        if (!cancelled) {
          setApiError('API dirigeants indisponible. Donnees locales affichees.')
          setSourceLabel('SQLite locale')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDirigeants(false)
        }
      }
    }

    loadDirigeants()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!dirigeants.some((item) => item.id === selectedDirigeantId)) {
      setSelectedDirigeantId(dirigeants[0]?.id ?? '')
    }
  }, [dirigeants, selectedDirigeantId])

  const selectedDirigeant = dirigeants.find((item) => item.id === selectedDirigeantId)

  const onSendVeriff = (event) => {
    event.preventDefault()
    const payload = {
      depositaire_type: type,
      dirigeant: selectedDirigeant,
      gsm,
      sentAt: new Date().toISOString(),
    }

    localStorage.setItem('aktly_depositaire', JSON.stringify(payload))
    localStorage.setItem('aktly_step_4', 'done')
    setVeriffSent(true)
  }

  return (
    <motion.div
      className="page-grid"
      variants={pageContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.article
        variants={cardReveal}
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-fuchsia-900/10"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">
          Page 3 - Depositaire et Identification
        </p>
        <h2 className="mt-3 text-3xl font-bold">Depositaire: Qui va deposer le dossier ?</h2>
        <p className="mt-2 text-slate-300">
          Selectionne le depositaire puis lance l identification (Veriff).
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSendVeriff}>
          <label className="block text-sm font-medium text-slate-200">
            Type de depositaire
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="wow-select mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-fuchsia-300"
            >
              <option value="comptable">Comptable</option>
              <option value="gestionnaire">Gestionnaire</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Dirigeant delegue
            <select
              value={selectedDirigeantId}
              onChange={(event) => setSelectedDirigeantId(event.target.value)}
              className="wow-select mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-fuchsia-300"
            >
              {dirigeants.map((dirigeant) => (
                <option key={dirigeant.id} value={dirigeant.id}>
                  {dirigeant.givenName} {dirigeant.surname} - {dirigeant.function}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Numero GSM pour Veriff
            <input
              type="text"
              required
              value={gsm}
              onChange={(event) => setGsm(event.target.value)}
              className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-fuchsia-300"
              placeholder="+324XXXXXXXX"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/company')}
              className="wow-btn rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Precedent
            </button>
            <button
              type="submit"
              className="wow-btn rounded-xl bg-fuchsia-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300"
            >
              Lancer Veriff
            </button>
          </div>
        </form>

        {veriffSent && (
          <div className="mt-5 space-y-3 rounded-xl border border-fuchsia-300/40 bg-fuchsia-300/10 p-3 text-sm text-fuchsia-100">
            <p>Lien Veriff simule envoye. Le depositaire peut maintenant verifier son identite.</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/adresse-info')}
                className="wow-btn rounded-xl bg-fuchsia-200 px-4 py-2 font-semibold text-slate-900 transition hover:bg-fuchsia-100"
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
        <h3 className="text-xl font-semibold">Liste des dirigeants (source autre dossier)</h3>
        <p className="mt-2 text-sm text-slate-300">
          Donnees reelles depuis Legakte. Source active: {sourceLabel}
        </p>
        {isLoadingDirigeants && <p className="mt-2 text-xs text-sky-300">Chargement des dirigeants...</p>}
        {apiError && <p className="mt-2 text-xs text-amber-300">{apiError}</p>}
        <div className="mt-4 space-y-3">
          {dirigeants.map((dirigeant) => (
            <div key={dirigeant.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm">
              <p className="font-semibold text-slate-100">
                {dirigeant.givenName} {dirigeant.surname}
              </p>
              <p className="text-slate-300">Fonction: {dirigeant.function}</p>
              <p className="text-slate-400">Reference dossier: {dirigeant.demandeId}</p>
            </div>
          ))}
        </div>
      </motion.aside>
    </motion.div>
  )
}

export default DepositairePage

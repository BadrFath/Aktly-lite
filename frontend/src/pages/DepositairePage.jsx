import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const dirigeantsEndpoint = (import.meta.env.VITE_LEGAKTE_DIRIGEANTS_ENDPOINT ?? '/api/legakte/dirigeants').trim()
const veriffSessionEndpoint = (import.meta.env.VITE_VERIFF_SESSION_ENDPOINT ?? '/api/veriff/session').trim()
const veriffNotifyEndpoint = (import.meta.env.VITE_VERIFF_NOTIFY_ENDPOINT ?? '/api/veriff/notify').trim()
const bearerToken = (import.meta.env.VITE_LEGAKTE_BEARER_TOKEN ?? '').trim()

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
  const companyDataRaw = localStorage.getItem('aktly_company_data')
  const companyData = companyDataRaw ? JSON.parse(companyDataRaw) : null
  const enterpriseNumber = String(companyData?.number ?? '').replace(/\D+/g, '')
  const [type, setType] = useState('comptable')
  const [dirigeants, setDirigeants] = useState([])
  const [selectedDirigeantId, setSelectedDirigeantId] = useState('')
  const [gsm, setGsm] = useState('')
  const [veriffSent, setVeriffSent] = useState(false)
  const [sourceLabel, setSourceLabel] = useState('API Legakte live')
  const [apiError, setApiError] = useState('')
  const [isLoadingDirigeants, setIsLoadingDirigeants] = useState(false)
  const [isSendingVeriff, setIsSendingVeriff] = useState(false)
  const [isSendingNotify, setIsSendingNotify] = useState(false)
  const [veriffError, setVeriffError] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifySent, setNotifySent] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadDirigeants = async () => {
      if (!dirigeantsEndpoint) {
        setSourceLabel('Configuration manquante')
        setApiError('Configuration dirigeants manquante. Verifie VITE_LEGAKTE_DIRIGEANTS_ENDPOINT.')
        return
      }

      setIsLoadingDirigeants(true)
      setApiError('')

      try {
        const authToken = localStorage.getItem('aktly_auth_token') ?? ''
        const search = enterpriseNumber
          ? `?enterprise_number=${encodeURIComponent(enterpriseNumber)}`
          : ''
        const response = await fetch(`${dirigeantsEndpoint}${search}`, {
          method: 'GET',
          headers: {
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
            ...(authToken ? { 'X-Auth-Token': authToken } : {}),
          },
          credentials: 'include',
          ...(search ? { cache: 'no-store' } : {}),
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
          setSourceLabel('Session utilisateur')
        } else if (!cancelled) {
          setApiError('API connectee, mais aucun dirigeant n a ete retourne.')
          setSourceLabel('Session utilisateur')
        }
      } catch {
        if (!cancelled) {
          setApiError('API dirigeants indisponible ou non authentifiee.')
          setSourceLabel('Session utilisateur')
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
  }, [dirigeantsEndpoint, enterpriseNumber])

  useEffect(() => {
    if (!dirigeants.some((item) => item.id === selectedDirigeantId)) {
      setSelectedDirigeantId(dirigeants[0]?.id ?? '')
    }
  }, [dirigeants, selectedDirigeantId])

  const selectedDirigeant = dirigeants.find((item) => item.id === selectedDirigeantId)

  const onNotifyAndContinue = async () => {
    setIsSendingNotify(true)
    setVeriffError('')
    setNotifyMessage('')
    setNotifySent(false)

    try {
      const authToken = localStorage.getItem('aktly_auth_token') ?? ''
      const response = await fetch(veriffNotifyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          ...(authToken ? { 'X-Auth-Token': authToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          dirigeant: selectedDirigeant,
          gsm,
          notifiedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const raw = await response.text().catch(() => '')
        let message = ''
        try {
          const parsed = raw ? JSON.parse(raw) : {}
          message = parsed?.message || parsed?.details || ''
        } catch {
          message = raw
        }
        throw new Error(message || `HTTP ${response.status}`)
      }

      const payload = await response.json().catch(() => ({}))
      const status = String(payload?.status || '').toLowerCase()
      const confirmed =
        payload?.sent === true ||
        payload?.success === true ||
        ['sent', 'queued', 'delivered'].includes(status) ||
        Boolean(payload?.messageId || payload?.message_id || payload?.reference)

      if (!confirmed) {
        throw new Error(payload?.message || 'Envoi non confirme par le service de notification.')
      }

      const message = payload?.message || 'Message envoye au depositaire.'
      setNotifyMessage(message)
      setNotifySent(true)
      localStorage.setItem('aktly_veriff_notification', 'sent')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setVeriffError(
        `Impossible d envoyer le message Veriff${message ? `: ${message}` : '. Reessaye.'}`,
      )
    } finally {
      setIsSendingNotify(false)
    }
  }

  const onSendVeriff = async (event) => {
    event.preventDefault()

    if (!veriffSessionEndpoint) {
      setVeriffError('Configuration Veriff manquante. Verifie VITE_VERIFF_SESSION_ENDPOINT.')
      return
    }

    setVeriffError('')
    setIsSendingVeriff(true)

    const payload = {
      depositaire_type: type,
      dirigeant: selectedDirigeant,
      gsm,
      sentAt: new Date().toISOString(),
    }

    try {
      const authToken = localStorage.getItem('aktly_auth_token') ?? ''
      const response = await fetch(veriffSessionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          ...(authToken ? { 'X-Auth-Token': authToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const veriffPayload = await response.json().catch(() => ({}))
      const veriffUrl =
        veriffPayload?.url ??
        veriffPayload?.veriff_url ??
        veriffPayload?.sessionUrl ??
        veriffPayload?.session_url ??
        ''

      localStorage.setItem('aktly_depositaire', JSON.stringify(payload))
      localStorage.setItem('aktly_step_4', 'done')

      if (veriffUrl) {
        localStorage.setItem('aktly_veriff_url', veriffUrl)
        window.location.assign(veriffUrl)
        return
      }

      setVeriffSent(true)
    } catch {
      setVeriffError('Envoi Veriff echoue. Verifie les variables et la connectivite Render.')
    } finally {
      setIsSendingVeriff(false)
    }
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
              disabled={isSendingVeriff || !selectedDirigeant}
              className="wow-btn rounded-xl bg-fuchsia-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300"
            >
              {isSendingVeriff ? 'Envoi en cours...' : 'Lancer Veriff'}
            </button>
          </div>
        </form>

        {veriffError && (
          <p className="mt-4 rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">
            {veriffError}
          </p>
        )}

        {notifyMessage && (
          <p className="mt-4 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
            {notifyMessage}
          </p>
        )}

        {veriffSent && (
          <div className="mt-5 space-y-3 rounded-xl border border-fuchsia-300/40 bg-fuchsia-300/10 p-3 text-sm text-fuchsia-100">
            <p>Session Veriff creee. Le depositaire peut maintenant verifier son identite.</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onNotifyAndContinue}
                disabled={isSendingNotify}
                className="wow-btn rounded-xl bg-fuchsia-200 px-4 py-2 font-semibold text-slate-900 transition hover:bg-fuchsia-100"
              >
                {isSendingNotify ? 'Envoi du message...' : 'Envoyer message Veriff'}
              </button>
            </div>
            {notifySent && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/adresse-info')}
                  className="wow-btn rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-200"
                >
                  Continuer
                </button>
              </div>
            )}
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
          {!isLoadingDirigeants && dirigeants.length === 0 && (
            <p className="text-sm text-slate-300">Aucun dirigeant disponible via l API.</p>
          )}
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

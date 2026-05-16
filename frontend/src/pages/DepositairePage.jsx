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
]

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

function DepositairePage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const companyDataRaw = localStorage.getItem('aktly_company_data')
  const companyData = companyDataRaw ? JSON.parse(companyDataRaw) : null
  const enterpriseNumber = String(companyData?.number ?? '').replace(/\D+/g, '')
  const depositaireType = 'comptable'
  const [dirigeants, setDirigeants] = useState(fallbackDirigeants)
  const [selectedDirigeantId, setSelectedDirigeantId] = useState(fallbackDirigeants[0]?.id ?? '')
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
  const t = uiLanguage === 'nl'
    ? {
        configMissing: 'Configuratie ontbreekt',
        dirigeantsConfigMissing: 'Configuratie bestuurders ontbreekt. Controleer VITE_LEGAKTE_DIRIGEANTS_ENDPOINT.',
        sessionUser: 'Gebruikerssessie',
        apiConnectedNoDirigeant: 'API verbonden, maar geen bestuurder teruggegeven.',
        apiUnavailable: 'Bestuurders-API onbeschikbaar of niet geauthenticeerd.',
        notifyNotConfirmed: 'Verzending niet bevestigd door notificatieservice.',
        notifySent: 'Bericht naar bewaarnemer verzonden.',
        notifyFailed: 'Kan Veriff-bericht niet verzenden',
        retry: 'Probeer opnieuw.',
        veriffConfigMissing: 'Veriff-configuratie ontbreekt. Controleer VITE_VERIFF_SESSION_ENDPOINT.',
        veriffFailed: 'Veriff-verzending mislukt. Controleer variabelen en Render-connectiviteit.',
        pageTag: 'Pagina 3 - Bewaarnemer en Identificatie',
        title: 'Bewaarnemer: Wie zal het dossier indienen?',
        subtitle: 'Selecteer de bewaarnemer en start de identificatie (Veriff).',
        delegate: 'Gedelegeerde bestuurder',
        gsm: 'GSM-nummer voor Veriff',
        prev: 'Vorige',
        send: 'Start Veriff',
        sending: 'Bezig met verzenden...',
        sessionCreated: 'Veriff-sessie aangemaakt. De bewaarnemer kan nu de identiteit verifiëren.',
        sendMsg: 'Veriff-bericht verzenden',
        sendMsgLoading: 'Bericht verzenden...',
        continue: 'Doorgaan',
        listTitle: 'Lijst van bestuurders (bron ander dossier)',
        listSubtitle: 'Reële gegevens van Legakte. Actieve bron:',
        loading: 'Bestuurders laden...',
        noDirigeant: 'Geen bestuurders beschikbaar via de API.',
        functionLabel: 'Functie',
        reference: 'Dossierreferentie',
      }
    : {
        configMissing: 'Configuration manquante',
        dirigeantsConfigMissing: 'Configuration dirigeants manquante. Verifie VITE_LEGAKTE_DIRIGEANTS_ENDPOINT.',
        sessionUser: 'Session utilisateur',
        apiConnectedNoDirigeant: 'API connectee, mais aucun dirigeant n a ete retourne.',
        apiUnavailable: 'API dirigeants indisponible ou non authentifiee.',
        notifyNotConfirmed: 'Envoi non confirme par le service de notification.',
        notifySent: 'Message envoye au depositaire.',
        notifyFailed: 'Impossible d envoyer le message Veriff',
        retry: 'Reessaye.',
        veriffConfigMissing: 'Configuration Veriff manquante. Verifie VITE_VERIFF_SESSION_ENDPOINT.',
        veriffFailed: 'Envoi Veriff echoue. Verifie les variables et la connectivite Render.',
        pageTag: 'Page 3 - Depositaire et Identification',
        title: 'Depositaire: Qui va deposer le dossier ?',
        subtitle: 'Selectionne le depositaire puis lance l identification (Veriff).',
        delegate: 'Dirigeant delegue',
        gsm: 'Numero GSM pour Veriff',
        prev: 'Precedent',
        send: 'Lancer Veriff',
        sending: 'Envoi en cours...',
        sessionCreated: 'Session Veriff creee. Le depositaire peut maintenant verifier son identite.',
        sendMsg: 'Envoyer message Veriff',
        sendMsgLoading: 'Envoi du message...',
        continue: 'Continuer',
        listTitle: 'Liste des dirigeants (source autre dossier)',
        listSubtitle: 'Donnees reelles depuis Legakte. Source active:',
        loading: 'Chargement des dirigeants...',
        noDirigeant: 'Aucun dirigeant disponible via l API.',
        functionLabel: 'Fonction',
        reference: 'Reference dossier',
      }

  useEffect(() => {
    let cancelled = false

    const applyLocalFallback = (message) => {
      if (cancelled) {
        return
      }

      setDirigeants(fallbackDirigeants)
      setSourceLabel('Session utilisateur')
      if (message) {
        setApiError(message)
      }
    }

    const loadDirigeants = async () => {
      if (!dirigeantsEndpoint) {
      applyLocalFallback(t.dirigeantsConfigMissing)
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
          setSourceLabel(t.sessionUser)
        } else if (!cancelled) {
          applyLocalFallback(t.apiConnectedNoDirigeant)
        }
      } catch {
        applyLocalFallback(t.apiUnavailable)
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
  }, [dirigeantsEndpoint, enterpriseNumber, t.apiConnectedNoDirigeant, t.apiUnavailable, t.configMissing, t.dirigeantsConfigMissing, t.sessionUser])

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
        throw new Error(payload?.message || t.notifyNotConfirmed)
      }

      const message = payload?.message || t.notifySent
      setNotifyMessage(message)
      setNotifySent(true)
      localStorage.setItem('aktly_veriff_notification', 'sent')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setVeriffError(
        `${t.notifyFailed}${message ? `: ${message}` : `. ${t.retry}`}`,
      )
    } finally {
      setIsSendingNotify(false)
    }
  }

  const onSendVeriff = async (event) => {
    event.preventDefault()

    if (!veriffSessionEndpoint) {
      setVeriffError(t.veriffConfigMissing)
      return
    }

    setVeriffError('')
    setIsSendingVeriff(true)

    const payload = {
      depositaire_type: depositaireType,
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
      setVeriffError(t.veriffFailed)
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
          {t.pageTag}
        </p>
        <h2 className="mt-3 text-3xl font-bold">{t.title}</h2>
        <p className="mt-2 text-slate-300">
          {t.subtitle}
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSendVeriff}>
          <label className="block text-sm font-medium text-slate-200">
            {t.delegate}
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
            {t.gsm}
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
              {t.prev}
            </button>
            <button
              type="submit"
              disabled={isSendingVeriff || !selectedDirigeant}
              className="wow-btn rounded-xl bg-fuchsia-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300"
            >
              {isSendingVeriff ? t.sending : t.send}
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
            <p>{t.sessionCreated}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onNotifyAndContinue}
                disabled={isSendingNotify}
                className="wow-btn rounded-xl bg-fuchsia-200 px-4 py-2 font-semibold text-slate-900 transition hover:bg-fuchsia-100"
              >
                {isSendingNotify ? t.sendMsgLoading : t.sendMsg}
              </button>
            </div>
            {notifySent && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/adresse-info')}
                  className="wow-btn rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-200"
                >
                  {t.continue}
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
        <h3 className="text-xl font-semibold">{t.listTitle}</h3>
        <p className="mt-2 text-sm text-slate-300">
          {t.listSubtitle} {sourceLabel}
        </p>
        {isLoadingDirigeants && <p className="mt-2 text-xs text-sky-300">{t.loading}</p>}
        {apiError && <p className="mt-2 text-xs text-amber-300">{apiError}</p>}
        <div className="mt-4 space-y-3">
          {!isLoadingDirigeants && dirigeants.length === 0 && (
            <p className="text-sm text-slate-300">{t.noDirigeant}</p>
          )}
          {dirigeants.map((dirigeant) => (
            <div key={dirigeant.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm">
              <p className="font-semibold text-slate-100">
                {dirigeant.givenName} {dirigeant.surname}
              </p>
              <p className="text-slate-300">{t.functionLabel}: {dirigeant.function}</p>
              <p className="text-slate-400">{t.reference}: {dirigeant.demandeId}</p>
            </div>
          ))}
        </div>
      </motion.aside>
    </motion.div>
  )
}

export default DepositairePage

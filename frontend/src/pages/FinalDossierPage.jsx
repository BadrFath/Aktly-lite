import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const form1DownloadBaseUrl = (
  import.meta.env.VITE_LEGAKTE_FORMULAIRE1_DOWNLOAD_BASE_URL ??
  'https://form.legakte.be/pdfs/formulaire1'
).trim()
const form1DemandeIdStorageKey = 'aktly_formulaire1_demande_id'

const generateUuidFallback = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `demande-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const resolveDemandeId = (draft) => {
  const rawValue =
    draft?.depositaire?.dirigeant?.demandeId ??
    draft?.depositaire?.dirigeant?.demande_id ??
    draft?.depositaire?.dirigeant?.idDemande ??
    draft?.depositaire?.dirigeant?.request_id ??
    ''
  const normalized = String(rawValue || '').trim()
  if (!normalized || normalized.toLowerCase() === 'n/a') {
    return ''
  }
  return normalized
}

const getOrCreateStoredForm1DemandeId = () => {
  const existing = String(localStorage.getItem(form1DemandeIdStorageKey) || '').trim()
  if (existing && existing.toLowerCase() !== 'n/a') {
    return existing
  }

  const created = generateUuidFallback()
  localStorage.setItem(form1DemandeIdStorageKey, created)
  return created
}

const buildFormulaire1DownloadUrl = (draft, fallbackDemandeId = '') => {
  const demandeId = resolveDemandeId(draft) || String(fallbackDemandeId || '').trim()
  if (!form1DownloadBaseUrl || !demandeId) {
    return ''
  }
  const separator = form1DownloadBaseUrl.includes('?') ? '&' : '?'
  return `${form1DownloadBaseUrl}${separator}demande_id=${encodeURIComponent(demandeId)}&download=true`
}

const getDossierFiles = (uiLanguage, formulaire1DownloadUrl) => [
  {
    title: uiLanguage === 'nl' ? 'Formulier 1' : 'Formulaire 1',
    documentKey: 'formulaire1entr',
    directDownloadUrl: formulaire1DownloadUrl,
    viewUrl: formulaire1DownloadUrl || '/legakte-docs/formulaire1entr.pdf',
    fallbackDownloadUrl: formulaire1DownloadUrl || '/legakte-docs/formulaire1entr.pdf',
  },
  {
    title: uiLanguage === 'nl' ? 'Formulier 2' : 'Formulaire 2',
    documentKey: 'formulaire2entr',
    viewUrl: '/legakte-docs/formulaire2entr.pdf',
    fallbackDownloadUrl: '/legakte-docs/formulaire2entr.pdf',
  },
  {
    title: uiLanguage === 'nl' ? 'Identiteitsattest model 1' : "Attestation d'identite modele 1",
    documentKey: 'attestation-identite',
    viewUrl: '/legakte-docs/attestation-identite-modele-1-fr.pdf',
    fallbackDownloadUrl: '/legakte-docs/attestation-identite-modele-1-fr.pdf',
  },
  {
    title: uiLanguage === 'nl' ? 'Proces-verbaal van de algemene vergadering' : "Proces-verbal de l'assemblee generale",
    documentKey: 'pv-assemblee-generale',
    viewUrl: '/legakte-docs/pv-assemblee-generale.txt',
    fallbackDownloadUrl: '/legakte-docs/pv-assemblee-generale.docx',
  },
]

const dossierGenerateBaseEndpoint =
  import.meta.env.VITE_LEGAKTE_DOSSIER_GENERATE_ENDPOINT ??
  '/lite/dossier/generate'

const bearerToken = import.meta.env.VITE_LEGAKTE_BEARER_TOKEN ?? ''

const readJsonFromStorage = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const readDossierSnapshot = () => ({
  isPaymentVerified: localStorage.getItem('aktly_payment_verified') === 'true',
  payment: readJsonFromStorage('aktly_payment'),
  user: readJsonFromStorage('aktly_user'),
  addressInfo: readJsonFromStorage('aktly_address_info'),
  depositaire: readJsonFromStorage('aktly_depositaire'),
  companyData: readJsonFromStorage('aktly_company_data'),
  documentsLang: localStorage.getItem('aktly_documents_lang') || 'fr',
})

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const resolveCompanyDisplayName = (companyData) => {
  if (companyData?.company_name) {
    return companyData.company_name
  }

  const descriptions = companyData?.denomination?.[0]?.description
  if (Array.isArray(descriptions)) {
    const preferred = descriptions.find((item) => item?.language === companyData?.lang_entre)?.value
    if (preferred) {
      return preferred
    }
    const fallback = descriptions.find((item) => item?.value)?.value
    if (fallback) {
      return fallback
    }
  }

  return '-'
}

function FinalDossierPage({ privilegedAccess = false, uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => readDossierSnapshot())
  const [generatedForm1DemandeId] = useState(() => getOrCreateStoredForm1DemandeId())
  const dossierFiles = useMemo(
    () => getDossierFiles(uiLanguage, buildFormulaire1DownloadUrl(draft, generatedForm1DemandeId)),
    [uiLanguage, draft, generatedForm1DemandeId],
  )
  const t = uiLanguage === 'nl'
    ? {
        pageTag: 'Pagina 5 - Betaling + Handtekening + Dossier',
        title: 'Eindinformatie van het dossier',
        subtitle: 'Betalingsoverzicht, ondertekeningsinstructies en dossierweergave/afdruk.',
        paymentInfo: 'Informatie monitorbetaling',
        client: 'Klant',
        email: 'E-mail',
        pack: 'Pack',
        credits: 'Credits',
        amount: 'Bedrag',
        signHow: 'Hoe ondertekenen',
        c1: 'Open het PV-document en controleer de informatie.',
        c2: 'Onderteken met de gevraagde methode (eID of elektronische handtekening).',
        c3: 'Controleer data en dossieradres voor indiening.',
        c4: 'Bewaar een PDF-kopie van het volledige dossier.',
        prefilled: 'Vooraf ingevulde bedrijfsinformatie',
        enterprise: 'Onderneming',
        bce: 'Ondernemingsnummer',
        bceAddress: 'BCE-adres',
        legalForm: 'Rechtsvorm',
        startDate: 'Startdatum',
        completeDossier: 'Volledig dossier (weergave en afdruk)',
        generationFallback: 'Servergeneratie niet beschikbaar. Statisch bestand werd gedownload.',
        view: 'Bekijken',
        opening: 'Openen...',
        download: 'Downloaden',
        generating: 'Genereren...',
        dates: 'Wijzigingsdatum',
        agDate: 'Datum AV',
        printAll: 'Volledig dossier afdrukken',
        prev: 'Vorige',
        finish: 'Afronden en terug naar start',
        filesSource: 'Bron gebruikte bestanden',
      }
    : {
        pageTag: 'Page 5 - Paiement Moniteur + Signature + Dossier',
        title: 'Informations finales du dossier',
        subtitle: 'Recap paiement moniteur, consignes de signature, et dossier disponible en visuel ou impression.',
        paymentInfo: 'Information de paiement moniteur',
        client: 'Client',
        email: 'Email',
        pack: 'Pack',
        credits: 'Credits',
        amount: 'Montant',
        signHow: 'Comment signer',
        c1: 'Ouvrir le document PV et verifier les informations.',
        c2: 'Signer avec la methode demandee (eID ou signature electronique).',
        c3: 'Verifier les dates et l adresse du dossier avant depot.',
        c4: 'Conserver une copie PDF du dossier complet.',
        prefilled: 'Informations entreprise pre-remplies',
        enterprise: 'Entreprise',
        bce: 'Numero BCE',
        bceAddress: 'Adresse BCE',
        legalForm: 'Forme juridique',
        startDate: 'Date de debut',
        completeDossier: 'Dossier complet (visuel et impression)',
        generationFallback: 'Generation serveur indisponible. Fichier statique telecharge a la place.',
        view: 'Voir',
        opening: 'Ouverture...',
        download: 'Telecharger',
        generating: 'Generation...',
        dates: 'Date changement',
        agDate: 'Date AG',
        printAll: 'Imprimer le dossier complet',
        prev: 'Precedent',
        finish: 'Terminer et revenir au debut',
        filesSource: 'Source fichiers utilises',
      }

  const { isPaymentVerified, payment, user, addressInfo, depositaire, companyData, documentsLang } = draft

  const [downloadError, setDownloadError] = useState('')
  const [downloadingKey, setDownloadingKey] = useState('')
  const [viewingKey, setViewingKey] = useState('')

  useEffect(() => {
    const refreshSnapshot = () => {
      setDraft(readDossierSnapshot())
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSnapshot()
      }
    }

    refreshSnapshot()
    window.addEventListener('focus', refreshSnapshot)
    window.addEventListener('pageshow', refreshSnapshot)
    window.addEventListener('storage', refreshSnapshot)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', refreshSnapshot)
      window.removeEventListener('pageshow', refreshSnapshot)
      window.removeEventListener('storage', refreshSnapshot)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const realDemandeId = resolveDemandeId(draft)
    if (realDemandeId) {
      localStorage.setItem(form1DemandeIdStorageKey, realDemandeId)
    }
  }, [draft])

  const onPrintDossier = () => {
    window.print()
  }

  const triggerStaticDownload = (url) => {
    const link = document.createElement('a')
    link.href = url
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const requestGeneratedDocumentBlob = async (file) => {
    const latestDraft = readDossierSnapshot()
    setDraft(latestDraft)

    const endpoint = `${dossierGenerateBaseEndpoint}/${file.documentKey}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        company_data: latestDraft.companyData ?? {},
        address_info: latestDraft.addressInfo ?? {},
        depositaire: latestDraft.depositaire ?? {},
        user: latestDraft.user ?? {},
        payment: latestDraft.payment ?? {},
        file_language: latestDraft.documentsLang,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') || ''
    const matchedFileName = disposition.match(/filename="?([^";]+)"?/i)
    const fileName = matchedFileName?.[1] || `${file.documentKey}.pdf`

    return { blob, fileName }
  }

  const onViewGeneratedDocument = async (file) => {
    setDownloadError('')
    setViewingKey(file.documentKey)

    if (file.directDownloadUrl) {
      window.open(file.directDownloadUrl, '_blank', 'noopener,noreferrer')
      setViewingKey('')
      return
    }

    // Open immediately to reduce popup blocker risk, then navigate when content is ready.
    const previewWindow = window.open('', '_blank')

    try {
      const { blob, fileName } = await requestGeneratedDocumentBlob(file)
      const mime = String(blob?.type || '').toLowerCase()

      if (previewWindow) {
        if (mime.includes('text/plain') || !mime) {
          const textContent = await blob.text()
          const safeTitle = escapeHtml(fileName)
          const safeBody = escapeHtml(textContent)
          previewWindow.document.open()
          previewWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{margin:0;padding:20px;background:#0b1220;color:#e5e7eb;font-family:Consolas,Monaco,'Courier New',monospace}pre{white-space:pre-wrap;line-height:1.5;font-size:16px}</style></head><body><pre>${safeBody}</pre></body></html>`)
          previewWindow.document.close()
        } else {
          const blobUrl = URL.createObjectURL(blob)
          previewWindow.location.href = blobUrl
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
        }
      } else {
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      }
    } catch {
      if (previewWindow) {
        previewWindow.close()
      }
      setDownloadError(t.generationFallback)
      window.open(file.viewUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setViewingKey('')
    }
  }

  const onDownloadGeneratedDocument = async (file) => {
    setDownloadError('')
    setDownloadingKey(file.documentKey)

    if (file.directDownloadUrl) {
      triggerStaticDownload(file.directDownloadUrl)
      setDownloadingKey('')
      return
    }

    try {
      const { blob, fileName } = await requestGeneratedDocumentBlob(file)
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      setDownloadError(
        t.generationFallback,
      )
      triggerStaticDownload(file.fallbackDownloadUrl)
    } finally {
      setDownloadingKey('')
    }
  }

  if (!isPaymentVerified && !privilegedAccess) {
    return (
      <motion.div className="page-grid" variants={pageContainer} initial="hidden" animate="visible">
        <motion.article
          variants={cardReveal}
          className="wow-panel rounded-3xl border border-rose-300/30 bg-slate-900/70 p-6 shadow-xl shadow-rose-900/20"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Acces bloque</p>
          <h2 className="mt-3 text-3xl font-bold">Paiement Stripe non confirme</h2>
          <p className="mt-3 text-slate-200">
            Les formulaires finaux ne sont pas charges tant que le paiement n est pas confirme.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/stripe')}
              className="wow-btn rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Aller au paiement Stripe
            </button>
          </div>
        </motion.article>
      </motion.div>
    )
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
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-sky-900/20"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
          {t.pageTag}
        </p>
        <h2 className="mt-3 text-3xl font-bold">{t.title}</h2>
        <p className="mt-2 text-slate-300">
          {t.subtitle}
        </p>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">{t.paymentInfo}</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            <p>{t.client}: {user?.name ?? 'Non renseigne'}</p>
            <p>{t.email}: {user?.email ?? 'Non renseigne'}</p>
            <p>{t.pack}: {payment?.pack?.slug ?? 'Non selectionne'}</p>
            <p>{t.credits}: {payment?.pack?.credits ?? 0}</p>
            <p>{t.amount}: {payment?.pack?.price ?? '-'}</p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">{t.signHow}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>{t.c1}</li>
            <li>{t.c2}</li>
            <li>{t.c3}</li>
            <li>{t.c4}</li>
          </ol>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">{t.prefilled}</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            <p>{t.enterprise}: {resolveCompanyDisplayName(companyData)}</p>
            <p>{t.bce}: {companyData?.number ?? '-'}</p>
            <p>{t.bceAddress}: {companyData?.address ?? '-'}</p>
            <p>{t.legalForm}: {companyData?.enterprise?.legalForm ?? '-'}</p>
            <p>{t.startDate}: {companyData?.enterprise?.startDate ?? '-'}</p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">{t.completeDossier}</h3>
          {downloadError && (
            <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
              {downloadError}
            </p>
          )}
          <div className="mt-3 rounded-2xl bg-slate-100 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2">
            {dossierFiles.map((file) => (
              <article
                key={file.title}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="mb-4 text-xl font-medium text-slate-800">{file.title}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onViewGeneratedDocument(file)}
                    disabled={viewingKey === file.documentKey || downloadingKey === file.documentKey}
                    className="wow-btn inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    <span aria-hidden="true">◉</span>
                    {viewingKey === file.documentKey ? t.opening : t.view}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadGeneratedDocument(file)}
                    disabled={downloadingKey === file.documentKey || viewingKey === file.documentKey}
                    className="wow-btn inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    <span aria-hidden="true">⬇</span>
                    {downloadingKey === file.documentKey ? t.generating : t.download}
                  </button>
                </div>
              </article>
            ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Dossier complet</p>
            <p className="mt-1">
              {t.dates}: {addressInfo?.dateChangement || '-'} | {t.agDate}:{' '}
              {addressInfo?.dateAssembleeGenerale || '-'}
            </p>
            <button
              type="button"
              onClick={onPrintDossier}
              className="wow-btn mt-3 rounded-lg bg-violet-500 px-3 py-2 font-semibold text-white hover:bg-violet-400"
            >
              {t.printAll}
            </button>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/adresse-info')}
            className="wow-btn rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-slate-400"
          >
            {t.prev}
          </button>
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="wow-btn rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            {t.finish}
          </button>
        </div>
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">{t.filesSource}</h3>
        <p className="mt-2 text-sm text-slate-300">
          Fichiers copies depuis E:\\Mohammed el yakoubi\\Legakte pour les etapes 5 et 6.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>formulaire1entr.pdf</li>
          <li>formulaire2entr.pdf</li>
          <li>Attestation d'identite - Modele 1 FR.pdf</li>
          <li>PV Ass-exemple.txt / PV Ass-exemple (1).docx</li>
        </ul>
      </motion.aside>
    </motion.div>
  )
}

export default FinalDossierPage

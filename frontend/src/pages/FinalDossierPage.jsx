import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const dossierFiles = [
  {
    title: 'Formulaire 1',
    viewUrl: '/legakte-docs/formulaire1entr.pdf',
    downloadUrl: '/legakte-docs/formulaire1entr.pdf',
  },
  {
    title: 'Formulaire 2',
    viewUrl: '/legakte-docs/formulaire2entr.pdf',
    downloadUrl: '/legakte-docs/formulaire2entr.pdf',
  },
  {
    title: "Attestation d'identite modele 1",
    viewUrl: '/legakte-docs/attestation-identite-modele-1-fr.pdf',
    downloadUrl: '/legakte-docs/attestation-identite-modele-1-fr.pdf',
  },
  {
    title: "Proces-verbal de l'assemblee generale",
    viewUrl: '/legakte-docs/pv-assemblee-generale.txt',
    downloadUrl: '/legakte-docs/pv-assemblee-generale.docx',
  },
]

function FinalDossierPage() {
  const navigate = useNavigate()

  const payment = useMemo(() => {
    const raw = localStorage.getItem('aktly_payment')
    return raw ? JSON.parse(raw) : null
  }, [])

  const user = useMemo(() => {
    const raw = localStorage.getItem('aktly_user')
    return raw ? JSON.parse(raw) : null
  }, [])

  const addressInfo = useMemo(() => {
    const raw = localStorage.getItem('aktly_address_info')
    return raw ? JSON.parse(raw) : null
  }, [])

  const onPrintDossier = () => {
    window.print()
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
          Page 5 - Paiement Moniteur + Signature + Dossier
        </p>
        <h2 className="mt-3 text-3xl font-bold">Informations finales du dossier</h2>
        <p className="mt-2 text-slate-300">
          Recap paiement moniteur, consignes de signature, et dossier disponible en visuel
          ou impression.
        </p>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">Information de paiement moniteur</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            <p>Client: {user?.name ?? 'Non renseigne'}</p>
            <p>Email: {user?.email ?? 'Non renseigne'}</p>
            <p>Pack: {payment?.pack?.slug ?? 'Non selectionne'}</p>
            <p>Credits: {payment?.pack?.credits ?? 0}</p>
            <p>Montant: {payment?.pack?.price ?? '-'}</p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">Comment signer</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>Ouvrir le document PV et verifier les informations.</li>
            <li>Signer avec la methode demandee (eID ou signature electronique).</li>
            <li>Verifier les dates et l adresse du dossier avant depot.</li>
            <li>Conserver une copie PDF du dossier complet.</li>
          </ol>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <h3 className="text-lg font-semibold text-slate-100">Dossier complet (visuel et impression)</h3>
          <div className="mt-3 rounded-2xl bg-slate-100 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2">
            {dossierFiles.map((file) => (
              <article
                key={file.title}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="mb-4 text-xl font-medium text-slate-800">{file.title}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={file.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="wow-btn inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    <span aria-hidden="true">◉</span>
                    Voir
                  </a>
                  <a
                    href={file.downloadUrl}
                    download
                    className="wow-btn inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    <span aria-hidden="true">⬇</span>
                    Telecharger
                  </a>
                </div>
              </article>
            ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Dossier complet</p>
            <p className="mt-1">
              Date changement: {addressInfo?.dateChangement || '-'} | Date AG:{' '}
              {addressInfo?.dateAssembleeGenerale || '-'}
            </p>
            <button
              type="button"
              onClick={onPrintDossier}
              className="wow-btn mt-3 rounded-lg bg-violet-500 px-3 py-2 font-semibold text-white hover:bg-violet-400"
            >
              Imprimer le dossier complet
            </button>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/adresse-info')}
            className="wow-btn rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-slate-400"
          >
            Precedent
          </button>
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="wow-btn rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            Terminer et revenir au debut
          </button>
        </div>
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">Source fichiers utilises</h3>
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

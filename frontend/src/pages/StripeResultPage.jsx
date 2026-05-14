import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cardReveal, pageContainer } from '../lib/motionPresets'

function StripeResultPage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [statusLabel, setStatusLabel] = useState(uiLanguage === 'nl' ? 'Betaling controleren...' : 'Verification du paiement...')
  const [isPaid, setIsPaid] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const t = uiLanguage === 'nl'
    ? {
        canceled: 'Betaling geannuleerd op Stripe. Geen einddossier wordt geladen.',
        noSession: 'Stripe-sessie niet gevonden. Betaling niet bevestigd.',
        confirmed: 'Betaling bevestigd. Je kan verder in het traject.',
        notConfirmed: 'Betaling niet bevestigd door Stripe. Probeer opnieuw.',
        impossible: 'Stripe-verificatie onmogelijk. Betaling niet bevestigd.',
        header: 'Stripe terugkeer',
        title: 'Betalingsstatus',
        back: 'Terug naar betaling',
        next: 'Verder naar stap 2',
      }
    : {
        canceled: 'Paiement annule sur Stripe. Aucun dossier final ne sera charge.',
        noSession: 'Session Stripe introuvable. Paiement non confirme.',
        confirmed: 'Paiement confirme. Vous pouvez continuer le parcours.',
        notConfirmed: 'Paiement non confirme par Stripe. Veuillez reessayer.',
        impossible: 'Verification Stripe impossible. Paiement non confirme.',
        header: 'Retour Stripe',
        title: 'Statut du paiement',
        back: 'Retour paiement',
        next: 'Continuer vers etape 2',
      }

  const sessionId = useMemo(() => searchParams.get('session_id') || '', [searchParams])
  const status = useMemo(() => (searchParams.get('status') || '').toLowerCase(), [searchParams])

  useEffect(() => {
    const checkPayment = async () => {
      if (status === 'cancel') {
        localStorage.setItem('aktly_payment_verified', 'false')
        setStatusLabel(t.canceled)
        setIsPaid(false)
        setIsChecking(false)
        return
      }

      if (!sessionId) {
        localStorage.setItem('aktly_payment_verified', 'false')
        setStatusLabel(t.noSession)
        setIsPaid(false)
        setIsChecking(false)
        return
      }

      try {
        const response = await fetch(`/api/stripe/checkout-session/${encodeURIComponent(sessionId)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json().catch(() => ({}))
        const paid = payload?.payment_status === 'paid'

        localStorage.setItem('aktly_payment_verified', paid ? 'true' : 'false')
        if (paid) {
          localStorage.setItem('aktly_step_2', 'done')
          setStatusLabel(t.confirmed)
          setIsPaid(true)
        } else {
          setStatusLabel(t.notConfirmed)
          setIsPaid(false)
        }
      } catch {
        localStorage.setItem('aktly_payment_verified', 'false')
        setStatusLabel(t.impossible)
        setIsPaid(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkPayment()
  }, [sessionId, status, t.canceled, t.confirmed, t.impossible, t.noSession, t.notConfirmed])

  return (
    <motion.div className="page-grid" variants={pageContainer} initial="hidden" animate="visible">
      <motion.article
        variants={cardReveal}
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-emerald-900/20"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{t.header}</p>
        <h2 className="mt-3 text-3xl font-bold">{t.title}</h2>
        <p className="mt-3 rounded-xl border border-slate-600 bg-slate-950/60 px-4 py-3 text-slate-200">
          {statusLabel}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/stripe')}
            className="rounded-xl border border-slate-500 px-4 py-2 font-semibold text-slate-100"
          >
            {t.back}
          </button>
          <button
            type="button"
            disabled={isChecking || !isPaid}
            onClick={() => navigate('/company')}
            className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.next}
          </button>
        </div>
      </motion.article>
    </motion.div>
  )
}

export default StripeResultPage

import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cardReveal, pageContainer } from '../lib/motionPresets'

function StripeResultPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [statusLabel, setStatusLabel] = useState('Verification du paiement...')
  const [isPaid, setIsPaid] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const sessionId = useMemo(() => searchParams.get('session_id') || '', [searchParams])
  const status = useMemo(() => (searchParams.get('status') || '').toLowerCase(), [searchParams])

  useEffect(() => {
    const checkPayment = async () => {
      if (status === 'cancel') {
        localStorage.setItem('aktly_payment_verified', 'false')
        setStatusLabel('Paiement annule sur Stripe. Aucun dossier final ne sera charge.')
        setIsPaid(false)
        setIsChecking(false)
        return
      }

      if (!sessionId) {
        localStorage.setItem('aktly_payment_verified', 'false')
        setStatusLabel('Session Stripe introuvable. Paiement non confirme.')
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
          setStatusLabel('Paiement confirme. Vous pouvez continuer le parcours.')
          setIsPaid(true)
        } else {
          setStatusLabel('Paiement non confirme par Stripe. Veuillez reessayer.')
          setIsPaid(false)
        }
      } catch {
        localStorage.setItem('aktly_payment_verified', 'false')
        setStatusLabel('Verification Stripe impossible. Paiement non confirme.')
        setIsPaid(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkPayment()
  }, [sessionId, status])

  return (
    <motion.div className="page-grid" variants={pageContainer} initial="hidden" animate="visible">
      <motion.article
        variants={cardReveal}
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-emerald-900/20"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Retour Stripe</p>
        <h2 className="mt-3 text-3xl font-bold">Statut du paiement</h2>
        <p className="mt-3 rounded-xl border border-slate-600 bg-slate-950/60 px-4 py-3 text-slate-200">
          {statusLabel}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/stripe')}
            className="rounded-xl border border-slate-500 px-4 py-2 font-semibold text-slate-100"
          >
            Retour paiement
          </button>
          <button
            type="button"
            disabled={isChecking || !isPaid}
            onClick={() => navigate('/company')}
            className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuer vers etape 2
          </button>
        </div>
      </motion.article>
    </motion.div>
  )
}

export default StripeResultPage

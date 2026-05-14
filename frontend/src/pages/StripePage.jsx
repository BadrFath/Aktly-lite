import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const pack = {
  slug: 'formalites-siege-social',
  title: 'Aktly - Formalites siege social',
  monthlyPriceEur: 29,
  credits: 50,
}

function StripePage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)
  const t = uiLanguage === 'nl'
    ? {
        title: 'Stripe betaling',
        monthly: '/ maand',
        hint: 'Het betaalformulier wordt enkel ingevuld op de echte Stripe-pagina.',
        secureTab: 'Je betaling gebeurt in een nieuw beveiligd Stripe-tabblad.',
        autoReturn: 'Automatische terugkeer met statuscontrole.',
        paymentOnly: 'Betaling enkel via Stripe',
        prev: 'Vorige',
        open: 'Openen van Stripe...',
        pay: 'Betalen in EUR via Stripe',
        foot: 'Stripe opent in een nieuw tabblad. Daarna keer je terug voor betalingscontrole.',
        payLinkMissing: 'Stripe-betaallink niet gevonden.',
        openFailed: 'Kan Stripe niet openen',
        checkRender: 'Controleer Stripe-configuratie op Render.',
      }
    : {
        title: 'Paiement Stripe',
        monthly: '/ mois',
        hint: 'Le formulaire de paiement est rempli uniquement sur la vraie page Stripe.',
        secureTab: 'Votre paiement se fait dans un nouvel onglet Stripe securise.',
        autoReturn: 'Retour automatique avec verification du statut.',
        paymentOnly: 'Paiement uniquement via Stripe',
        prev: 'Precedent',
        open: 'Ouverture de Stripe...',
        pay: 'Payer en EUR sur Stripe',
        foot: 'Stripe s ouvre dans un nouvel onglet. Vous revenez ensuite pour verification du paiement.',
        payLinkMissing: 'Lien de paiement Stripe introuvable.',
        openFailed: 'Impossible d ouvrir Stripe',
        checkRender: 'Verifie la configuration Stripe sur Render.',
      }

  const money = useMemo(() => {
    return {
      amount: pack.monthlyPriceEur,
      display: `${pack.monthlyPriceEur.toFixed(2).replace('.', ',')} EUR`,
    }
  }, [])

  const openStripeCheckout = async () => {
    setErrorMessage('')
    setIsRedirecting(true)

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          amount_eur: money.amount,
          title: pack.title,
          slug: pack.slug,
          credits: pack.credits,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.message || `HTTP ${response.status}`)
      }

      const payload = await response.json().catch(() => ({}))
      const paymentUrl = (payload?.url || '').trim()

      if (!paymentUrl) {
        throw new Error(t.payLinkMissing)
      }

      localStorage.setItem(
        'aktly_payment',
        JSON.stringify({
          pack: {
            slug: pack.slug,
            title: pack.title,
            credits: pack.credits,
            price: money.display,
            currency: 'EUR',
            monthly: true,
          },
          paidAt: null,
          startedAt: new Date().toISOString(),
        }),
      )

      localStorage.setItem('aktly_step_2', 'pending_live_payment')
      localStorage.setItem('aktly_payment_verified', 'false')

      const stripeTab = window.open(paymentUrl, '_blank', 'noopener,noreferrer')
      if (!stripeTab) {
        window.location.assign(paymentUrl)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(
        `${t.openFailed}${message ? `: ${message}` : `. ${t.checkRender}`}`,
      )
      setIsRedirecting(false)
      return
    }

    setIsRedirecting(false)
  }

  return (
    <motion.div className="page-grid" variants={pageContainer} initial="hidden" animate="visible">
      <motion.article
        variants={cardReveal}
        className="rounded-3xl border border-slate-200/90 bg-slate-50 p-6 text-slate-700 shadow-2xl shadow-slate-950/20"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aktly</p>
        <h2 className="mt-6 text-3xl font-bold text-slate-800">{t.title}</h2>
        <p className="mt-2 text-5xl font-semibold text-slate-900">
          {money.display}
          <span className="ml-2 text-2xl font-medium text-slate-500">{t.monthly}</span>
        </p>

        <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          {t.hint}
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold text-slate-800">{pack.title}</p>
              <p className="mt-2 text-base text-slate-500">
                {t.secureTab}
              </p>
              <p className="mt-2 text-sm text-slate-500">{t.autoReturn}</p>
            </div>
            <p className="text-3xl font-semibold text-slate-800">{money.display}</p>
          </div>
        </div>
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="rounded-3xl border border-slate-200/90 bg-slate-50 p-6 text-slate-700 shadow-2xl shadow-slate-950/20"
      >
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900">
          {t.paymentOnly}
        </div>

        <div className="security-stage mt-5">
          <motion.div
            className="floating-pay-card card-a"
            animate={{
              x: [-92, -126, -6, -6, -92],
              y: [-48, -66, -10, -10, -48],
              rotate: [-12, -18, 0, 0, -12],
              scale: [1, 1.04, 0.24, 0.24, 1],
              opacity: [0.96, 1, 0.24, 0, 0.96],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.32, 0.6, 0.72, 1],
            }}
          >
            <span className="chip" />
            <span className="line short" />
            <span className="line long" />
          </motion.div>

          <motion.div
            className="floating-pay-card card-b"
            animate={{
              x: [92, 132, 7, 7, 92],
              y: [-36, -58, -8, -8, -36],
              rotate: [14, 21, 0, 0, 14],
              scale: [0.96, 1.02, 0.22, 0.22, 0.96],
              opacity: [0.88, 1, 0.2, 0, 0.88],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.3, 0.58, 0.72, 1],
              delay: 0.15,
            }}
          >
            <span className="chip" />
            <span className="line short" />
            <span className="line long" />
          </motion.div>

          <motion.div
            className="floating-pay-card card-c"
            animate={{
              x: [0, 0, 0, 0],
              y: [58, 84, 8, 8, 58],
              rotate: [0, 6, 0, 0, 0],
              scale: [0.92, 1, 0.2, 0.2, 0.92],
              opacity: [0.8, 1, 0.18, 0, 0.8],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.34, 0.62, 0.72, 1],
              delay: 0.3,
            }}
          >
            <span className="chip" />
            <span className="line short" />
            <span className="line long" />
          </motion.div>

          <motion.div
            className="security-lock"
            animate={{
              opacity: [0, 0, 1, 1, 0],
              scale: [0.62, 0.62, 1, 1, 0.82],
              y: [18, 18, 0, 0, 14],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.45, 0.62, 0.84, 1],
            }}
          >
            <span className="lock-shackle" />
            <span className="lock-body" />
            <span className="lock-pulse" />
          </motion.div>

          <p className="security-caption">Payment Card Security</p>
          <p className="security-subtitle">Floating cards morphing into a verified padlock</p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-100 px-5 py-3 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500 hover:shadow-lg"
          >
            {t.prev}
          </button>
          <button
            type="button"
            onClick={openStripeCheckout}
            disabled={isRedirecting}
            className="rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-300/50 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRedirecting ? t.open : t.pay}
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {t.foot}
        </p>

        {errorMessage && (
          <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        )}
      </motion.aside>
    </motion.div>
  )
}

export default StripePage

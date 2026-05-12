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

const stripePaymentLink = (import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? '').trim()

function StripePage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('Maroc')
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)

  const money = useMemo(() => {
    return {
      amount: pack.monthlyPriceEur,
      symbol: 'EUR',
      display: `${pack.monthlyPriceEur.toFixed(2).replace('.', ',')} EUR`,
    }
  }, [])

  const resolveStripeUrl = async () => {
    const direct = stripePaymentLink.trim()
    if (direct) {
      return direct.startsWith('http://') || direct.startsWith('https://')
        ? direct
        : `https://${direct}`
    }

    const response = await fetch('/api/stripe/payment-link', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.message || `HTTP ${response.status}`)
    }

    const payload = await response.json().catch(() => ({}))
    const runtimeUrl = (payload?.url ?? '').trim()

    if (!runtimeUrl) {
      throw new Error('Lien Stripe indisponible.')
    }

    return runtimeUrl.startsWith('http://') || runtimeUrl.startsWith('https://')
      ? runtimeUrl
      : `https://${runtimeUrl}`
  }

  const onPay = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsRedirecting(true)

    const paymentPayload = {
      pack: {
        slug: pack.slug,
        title: pack.title,
        credits: pack.credits,
        price: money.display,
        currency: 'EUR',
        monthly: true,
      },
      email,
      paidAt: new Date().toISOString(),
    }

    localStorage.setItem(
      'aktly_payment',
      JSON.stringify(paymentPayload),
    )

    try {
      const paymentUrl = await resolveStripeUrl()
      localStorage.setItem('aktly_step_2', 'pending_live_payment')
      localStorage.setItem('aktly_payment_live_redirect', 'true')
      window.location.assign(paymentUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(
        `Impossible d ouvrir Stripe${message ? `: ${message}` : '. Verifie la configuration Stripe sur Render.'}`,
      )
      setIsRedirecting(false)
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
        className="rounded-3xl border border-slate-200/90 bg-slate-50 p-6 text-slate-700 shadow-2xl shadow-slate-950/20"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aktly</p>
        <h2 className="mt-6 text-3xl font-bold text-slate-800">
          S abonner a Aktly - Formalites siege social
        </h2>
        <p className="mt-2 text-5xl font-semibold text-slate-900">
          {money.display}
          <span className="ml-2 text-2xl font-medium text-slate-500">/ mois</span>
        </p>

        <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          Paiement unique en euro (EUR)
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold text-slate-800">{pack.title}</p>
              <p className="mt-2 text-base text-slate-500">
                Accedez a Aktly et simplifiez vos formalites administratives pour votre siege social.
              </p>
              <p className="mt-2 text-sm text-slate-500">Facture tous les mois</p>
            </div>
            <p className="text-3xl font-semibold text-slate-800">{money.display}</p>
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-200 pt-4 text-xl">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Sous-total</span>
              <span className="font-semibold text-slate-800">{money.display}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Taxe</span>
              <span className="font-semibold text-slate-800">
                0,00 EUR
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-2xl font-semibold text-slate-900">Total du jour</span>
              <span className="text-2xl font-semibold text-slate-900">{money.display}</span>
            </div>
          </div>
        </div>
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="rounded-3xl border border-slate-200/90 bg-slate-50 p-6 text-slate-700 shadow-2xl shadow-slate-950/20"
      >
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900">
          Paiement uniquement via Stripe
        </div>

        <form className="space-y-4" onSubmit={onPay}>
          <h3 className="text-3xl font-semibold text-slate-800">Coordonnees</h3>
          <label className="block text-base font-medium text-slate-700">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              placeholder="email@exemple.com"
            />
          </label>

          <h3 className="pt-2 text-3xl font-semibold text-slate-800">Moyen de paiement</h3>
          <div className="rounded-2xl border border-slate-300 bg-white p-4">
            <p className="mb-3 text-xl font-semibold text-slate-800">Carte</p>

          <label className="block text-sm font-medium text-slate-200">
            Numero de carte
            <input
              type="text"
              required
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              placeholder="1234 1234 1234 1234"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-base font-medium text-slate-700">
              Expiration
              <input
                type="text"
                required
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                placeholder="MM/AA"
              />
            </label>

            <label className="block text-base font-medium text-slate-700">
              CVC
              <input
                type="text"
                required
                value={cvc}
                onChange={(event) => setCvc(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                placeholder="123"
              />
            </label>
          </div>

          <label className="mt-4 block text-base font-medium text-slate-700">
            Nom du titulaire de la carte
            <input
              type="text"
              required
              value={cardName}
              onChange={(event) => setCardName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              placeholder="Nom complet"
            />
          </label>

          <label className="mt-4 block text-base font-medium text-slate-700">
            Pays ou region
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="Maroc">Maroc</option>
              <option value="Belgique">Belgique</option>
              <option value="France">France</option>
            </select>
          </label>
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

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-100 px-5 py-3 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-500 hover:shadow-lg"
            >
              Precedent
            </button>
            <button
              type="submit"
              disabled={isRedirecting}
              className="rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-300/50 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              {isRedirecting ? 'Ouverture de Stripe...' : 'Payer en EUR sur Stripe'}
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Redirection vers la page de paiement securisee Stripe pour finaliser l abonnement.
          </p>
          {errorMessage && (
            <p className="rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          )}
        </form>
      </motion.aside>
    </motion.div>
  )
}

export default StripePage

import { motion } from 'framer-motion'
import { useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

function AuthPage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const loginEndpoint = (import.meta.env.VITE_AUTH_LOGIN_ENDPOINT ?? '/api/auth/login').trim()
  const signupEndpoint = (import.meta.env.VITE_AUTH_SIGNUP_ENDPOINT ?? '/api/auth/signup').trim()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = uiLanguage === 'nl'
    ? {
        title: 'Login / Registreren',
        subtitle: 'Meld je aan of maak een account om verder te gaan naar Stripe-betaling.',
        fullName: 'Volledige naam',
        anonymous: 'Anonieme gebruiker',
        email: 'E-mail',
        password: 'Wachtwoord',
        passwordAgain: 'Wachtwoord opnieuw invoeren',
        next: 'Volgende',
        checking: 'Controleren...',
        secure: 'Beveiligde toegang',
        secureDesc: 'Gebruik je gegevens om het traject te openen. In registratie-modus bevestig je het wachtwoord.',
      }
    : {
        title: 'Login / Sign up',
        subtitle: 'Connecte-toi ou cree un compte pour continuer vers le paiement Stripe.',
        fullName: 'Nom complet',
        anonymous: 'Utilisateur anonyme',
        email: 'Email',
        password: 'Mot de passe',
        passwordAgain: 'Entrez a nouveau le mot de passe',
        next: 'Suivant',
        checking: 'Verification...',
        secure: 'Acces securise',
        secureDesc: 'Utilise tes identifiants pour acceder au parcours. En mode Sign up, confirme le mot de passe avant de continuer.',
      }

  const onChange = (event) => {
    const { name, value } = event.target
    setErrorMessage('')
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    const endpoint = mode === 'signup' ? signupEndpoint : loginEndpoint
    const normalizedEmail = form.email.trim().toLowerCase()
    const trimmedName = form.fullName.trim()

    if (!endpoint) {
      setErrorMessage('Configuration auth manquante. Verifie VITE_AUTH_LOGIN_ENDPOINT et VITE_AUTH_SIGNUP_ENDPOINT.')
      return
    }

    if (mode === 'signup' && form.password !== form.confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const requestBody =
        mode === 'signup'
          ? {
              name: trimmedName,
              email: normalizedEmail,
              password: form.password,
              password_confirmation: form.confirmPassword,
            }
          : {
              email: normalizedEmail,
              password: form.password,
            }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const rawText = await response.text().catch(() => '')
        let apiMessage = ''

        try {
          const parsed = rawText ? JSON.parse(rawText) : {}
          apiMessage = parsed?.message || parsed?.error || ''
        } catch {
          apiMessage = rawText
        }

        throw new Error(apiMessage || `HTTP ${response.status}`)
      }

      const payload = await response.json().catch(() => ({}))
      const token =
        payload?.app_token ??
        payload?.token ??
        payload?.access_token ??
        payload?.data?.token ??
        ''
      const user = payload?.user ?? payload?.data?.user ?? null

      localStorage.setItem(
        'aktly_user',
        JSON.stringify({
          name: user?.name || trimmedName || normalizedEmail.split('@')[0] || 'Utilisateur Lite',
          email: user?.email || normalizedEmail,
          mode,
        }),
      )

      if (token) {
        localStorage.setItem('aktly_auth_token', token)
      }

      localStorage.setItem('aktly_step_1', 'done')
      navigate('/stripe')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(
        `Authentification echouee${message ? `: ${message}` : '. Verifie les identifiants et la configuration Render.'}`,
      )
    } finally {
      setIsSubmitting(false)
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
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-emerald-900/10"
      >
        <h2 className="mt-3 text-3xl font-bold">{t.title}</h2>
        <p className="mt-2 max-w-lg text-slate-300">
          {t.subtitle}
        </p>

        <div className="mt-6 inline-flex rounded-full border border-slate-700 bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-emerald-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === 'signup'
                ? 'bg-emerald-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Sign up
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-200">
            {t.fullName}
            <input
              type="text"
              name="fullName"
              required={mode === 'signup'}
              value={form.fullName}
              onChange={onChange}
              className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-300"
              placeholder={t.anonymous}
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            {t.email}
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={onChange}
              className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-300"
              placeholder="utilisateur@exemple.com"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            {t.password}
            <input
              type="password"
              name="password"
              required
              value={form.password}
              onChange={onChange}
              className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-300"
              placeholder="********"
            />
          </label>

          {mode === 'signup' && (
            <label className="block text-sm font-medium text-slate-200">
              {t.passwordAgain}
              <input
                type="password"
                name="confirmPassword"
                required={mode === 'signup'}
                value={form.confirmPassword}
                onChange={onChange}
                className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-300"
                placeholder="********"
              />
            </label>
          )}

          {errorMessage && (
            <p className="rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="wow-btn rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {isSubmitting ? t.checking : t.next}
            </button>
          </div>
        </form>
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">{t.secure}</h3>
        <p className="mt-2 text-slate-300">
          {t.secureDesc}
        </p>
      </motion.aside>
    </motion.div>
  )
}

export default AuthPage

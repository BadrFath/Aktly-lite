import { motion } from 'framer-motion'
import { useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errorMessage, setErrorMessage] = useState('')

  const onChange = (event) => {
    const { name, value } = event.target
    setErrorMessage('')
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = (event) => {
    event.preventDefault()

    if (mode === 'signup' && form.password !== form.confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.')
      return
    }

    localStorage.setItem(
      'aktly_user',
      JSON.stringify({
        name: form.fullName || 'Utilisateur Lite',
        email: form.email,
        mode,
      }),
    )
    localStorage.setItem('aktly_step_1', 'done')

    navigate('/stripe')
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
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          Authentification (hors parcours)
        </p>
        <h2 className="mt-3 text-3xl font-bold">Login / Sign up</h2>
        <p className="mt-2 max-w-lg text-slate-300">
          Connecte-toi ou cree un compte pour continuer vers le paiement Stripe.
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
            Nom complet
            <input
              type="text"
              name="fullName"
              required
              value={form.fullName}
              onChange={onChange}
              className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-emerald-300"
              placeholder="Utilisateur anonyme"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Email
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
            Mot de passe
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
              Entrez a nouveau le mot de passe
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
              className="wow-btn rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Suivant
            </button>
          </div>
        </form>
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">Acces securise</h3>
        <p className="mt-2 text-slate-300">
          Utilise tes identifiants pour acceder au parcours. En mode Sign up,
          confirme le mot de passe avant de continuer.
        </p>
      </motion.aside>
    </motion.div>
  )
}

export default AuthPage

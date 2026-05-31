import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost, legacyPut } from '../../lib/legacyApi'

function LegacyStep3Page({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ date_changement: '', date_assemblee: '', fait_a: '' })
  const [loading, setLoading] = useState(false)
  const [prefilling, setPrefilling] = useState(true)
  const [error, setError] = useState('')

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap 4 - Data & plaats',
        dateChangement: 'Datum van de wijziging',
        dateAssemblee: 'Datum en uur van de vergadering',
        faitA: 'Opgemaakt te (stad)',
        back: 'Terug',
        next: 'Volgende',
        errRequired: 'Alle velden zijn verplicht.',
        errGeneric: 'Er is een fout opgetreden.',
      }
    : {
        title: 'Etape 4 - Dates & lieu',
        dateChangement: 'Date du changement',
        dateAssemblee: "Date et heure de l'assemblee",
        faitA: 'Fait a (ville)',
        back: 'Retour',
        next: 'Suivant',
        errRequired: 'Tous les champs sont requis.',
        errGeneric: 'Une erreur est survenue.',
      }

  useEffect(() => {
    const id = sessionStorage.getItem('demande_id')
    if (!id) { navigate('/legacy/step1'); return }

    const prefill = async () => {
      try {
        const data = await legacyGet(`/demandes/${id}`)
        if (data) {
          setForm({
            date_changement: data.date_changement ?? '',
            date_assemblee: data.date_assemblee ? data.date_assemblee.replace('T', ' ').substring(0, 16) : '',
            fait_a: data.fait_a ?? '',
          })
        }
      } catch {
        // proceed with empty form
      } finally {
        setPrefilling(false)
      }
    }

    prefill()
  }, [navigate])

  const onChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const onSubmit = async () => {
    if (!form.date_changement || !form.date_assemblee || !form.fait_a.trim()) {
      setError(t.errRequired)
      return
    }
    setError('')
    setLoading(true)

    const id = sessionStorage.getItem('demande_id')
    try {
      await legacyPut(`/demandes/${id}`, {
        date_changement: form.date_changement,
        date_assemblee: form.date_assemblee,
        fait_a: form.fait_a,
      })
      await legacyPost(`/demandes/${id}/progress`, { progress: 75 })
      navigate('/legacy/step4')
    } catch (err) {
      setError(err?.message || t.errGeneric)
    } finally {
      setLoading(false)
    }
  }

  if (prefilling) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  return (
    <motion.div className="mx-auto max-w-xl" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Legacy</p>
        <h2 className="mt-3 mb-6 text-2xl font-bold text-slate-100">{t.title}</h2>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Progression</span>
            <span className="text-xs text-emerald-400 font-semibold">75%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-700">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '75%' }} />
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.dateChangement}</label>
            <input type="date" value={form.date_changement} onChange={onChange('date_changement')}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 focus:border-emerald-400 focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.dateAssemblee}</label>
            <input type="datetime-local" value={form.date_assemblee} onChange={onChange('date_assemblee')}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 focus:border-emerald-400 focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.faitA}</label>
            <input type="text" value={form.fait_a} onChange={onChange('fait_a')}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none" />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={() => navigate('/legacy/step2')}
              className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-400 hover:text-slate-100">
              {t.back}
            </button>
            <button type="button" onClick={onSubmit} disabled={loading}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? '...' : t.next}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default LegacyStep3Page

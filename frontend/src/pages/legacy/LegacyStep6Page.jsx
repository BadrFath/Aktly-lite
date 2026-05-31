import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost, legacyPut } from '../../lib/legacyApi'

function getInputType(key, value) {
  if (/date/i.test(key)) return 'date'
  if (typeof value === 'number') return 'number'
  return 'text'
}

function LegacyStep6Page({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [fieldValues, setFieldValues] = useState({})
  const [disabled, setDisabled] = useState({})
  const [meta, setMeta] = useState(null) // {source, fields, mode, form}
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap - Ontbrekende velden',
        subtitle: 'Vul de ontbrekende velden in om door te gaan.',
        disable: 'Uitschakelen',
        save: 'Opslaan',
        back: 'Terug',
        errGeneric: 'Er is een fout opgetreden.',
        errNoData: 'Geen veldgegevens gevonden.',
      }
    : {
        title: 'Etape - Champs manquants',
        subtitle: 'Remplissez les champs manquants pour continuer.',
        disable: 'Desactiver',
        save: 'Sauvegarder',
        back: 'Retour',
        errGeneric: 'Une erreur est survenue.',
        errNoData: 'Aucune donnee de champ trouvee.',
      }

  useEffect(() => {
    const raw = sessionStorage.getItem('missing_fields_data')
    if (!raw) {
      setError(t.errNoData)
      setLoading(false)
      return
    }

    let parsed
    try { parsed = JSON.parse(raw) } catch {
      setError(t.errNoData)
      setLoading(false)
      return
    }

    setMeta(parsed)
    const id = sessionStorage.getItem('demande_id')

    const load = async () => {
      try {
        if (parsed.mode === 'pdf') {
          const data = await legacyGet(`/demandes/${id}/pdf-fields?form=${parsed.form ?? 'formulaire1'}`)
          setFieldValues(data ?? {})
        } else {
          // mode === 'ia': use fields from sessionStorage directly
          const initialValues = {}
          const fields = parsed.fields ?? {}
          Object.keys(fields).forEach((k) => {
            initialValues[k] = fields[k] ?? ''
          })
          setFieldValues(initialValues)
        }
      } catch (err) {
        setError(err?.message || t.errGeneric)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [t.errNoData, t.errGeneric])

  const onChange = (key) => (e) => {
    setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const toggleDisable = (key) => {
    setDisabled((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const onSave = async () => {
    setError('')
    setSaving(true)
    const id = sessionStorage.getItem('demande_id')

    try {
      const activeValues = {}
      Object.entries(fieldValues).forEach(([k, v]) => {
        if (!disabled[k]) activeValues[k] = v
      })

      if (meta.mode === 'pdf') {
        await legacyPut(`/demandes/${id}/pdf-fields`, {
          fields: activeValues,
          form: meta.form ?? 'formulaire1',
        })
      } else {
        await legacyPut(`/demandes/${id}`, activeValues)
      }

      // Navigate back to source
      const source = meta.source
      if (source === 'step4') navigate('/legacy/step4')
      else if (source === 'step5') navigate('/legacy/step5')
      else navigate('/legacy/finish')
    } catch (err) {
      setError(err?.message || t.errGeneric)
    } finally {
      setSaving(false)
    }
  }

  const fieldKeys = Object.keys(fieldValues)

  return (
    <motion.div className="mx-auto max-w-2xl" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Legacy</p>
        <h2 className="mt-3 mb-2 text-2xl font-bold text-slate-100">{t.title}</h2>
        <p className="mb-6 text-sm text-slate-400">{t.subtitle}</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="space-y-4">
            {fieldKeys.length === 0 && !error && (
              <p className="text-sm text-slate-400">{uiLanguage === 'nl' ? 'Geen velden.' : 'Aucun champ.'}</p>
            )}

            {fieldKeys.map((key) => (
              <div key={key} className={`rounded-xl border p-4 transition ${
                disabled[key] ? 'border-slate-700 bg-slate-800/40 opacity-50' : 'border-slate-600 bg-slate-800/60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">{key}</label>
                  <button
                    type="button"
                    onClick={() => toggleDisable(key)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      disabled[key]
                        ? 'border border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                        : 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    }`}
                  >
                    {t.disable}
                  </button>
                </div>
                <input
                  type={getInputType(key, fieldValues[key])}
                  value={fieldValues[key] ?? ''}
                  onChange={onChange(key)}
                  disabled={disabled[key]}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-slate-100 focus:border-emerald-400 focus:outline-none disabled:opacity-40"
                />
              </div>
            ))}

            {error && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button type="button"
                onClick={() => {
                  const src = meta?.source
                  if (src === 'step4') navigate('/legacy/step4')
                  else if (src === 'step5') navigate('/legacy/step5')
                  else navigate('/legacy/finish')
                }}
                className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-400 hover:text-slate-100">
                {t.back}
              </button>
              <button type="button" onClick={onSave} disabled={saving}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? '...' : t.save}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default LegacyStep6Page

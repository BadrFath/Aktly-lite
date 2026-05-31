import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost } from '../../lib/legacyApi'

function LegacyStep5Page({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [aiProgress, setAiProgress] = useState(0)
  const [aiLoading, setAiLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const doneRef = useRef(false)

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap 6 - Uittreksel (IA)',
        subtitle: 'De AI-gegenereerde tekst van het uittreksel. U kunt deze bewerken.',
        loading: 'AI genereert de uittreksel-tekst...',
        finish: 'Voltooien',
        back: 'Terug',
        errGeneric: 'Er is een fout opgetreden.',
      }
    : {
        title: 'Etape 6 - Extrait (IA)',
        subtitle: "Le texte d'extrait genere par IA. Vous pouvez le modifier.",
        loading: "L'IA genere le texte de l'extrait...",
        finish: 'Terminer',
        back: 'Retour',
        errGeneric: 'Une erreur est survenue.',
      }

  useEffect(() => {
    const id = sessionStorage.getItem('demande_id')
    if (!id) { navigate('/legacy/step1'); return }

    const cachedText = sessionStorage.getItem('ia_text_extrait')
    if (cachedText) {
      setText(cachedText)
      setAiProgress(100)
      setAiLoading(false)
      return
    }

    const checkCredits = async () => {
      try {
        const data = await legacyGet('/billing/subscription')
        const hasCredits = data?.credits > 0 || data?.active_subscription || data?.valid_coupon
        if (!hasCredits) navigate('/legacy/buy-credits')
      } catch { /* proceed */ }
    }

    // Animated progress 0→100%: increment 2-5% every 300ms until API responds
    timerRef.current = setInterval(() => {
      if (doneRef.current) {
        clearInterval(timerRef.current)
        return
      }
      setAiProgress((prev) => {
        const step = Math.floor(Math.random() * 4) + 2 // 2-5
        return Math.min(prev + step, 95)
      })
    }, 300)

    const fetchAiText = async () => {
      await checkCredits()
      try {
        const data = await legacyGet(`/getExtraitTextWithIA/${id}`)
        const generatedText = data?.text ?? data?.extrait_text ?? data?.content ?? ''
        sessionStorage.setItem('ia_text_extrait', generatedText)
        setText(generatedText)
      } catch (err) {
        setError(err?.message || t.errGeneric)
      } finally {
        doneRef.current = true
        clearInterval(timerRef.current)
        setAiProgress(100)
        setAiLoading(false)
      }
    }

    fetchAiText()
    return () => clearInterval(timerRef.current)
  }, [navigate, t.errGeneric])

  const onFinish = async () => {
    setError('')
    setSubmitting(true)
    const id = sessionStorage.getItem('demande_id')

    try {
      await legacyPost(`/demandes/${id}/extraitText`, { text })

      const missingRes = await legacyGet(`/demandes/${id}/missing-pdf-fields?form=formulaire1`)

      if (missingRes && Object.keys(missingRes).length > 0) {
        sessionStorage.setItem('missing_fields_data', JSON.stringify({
          source: 'step5',
          fields: missingRes,
          mode: 'pdf',
          form: 'formulaire1',
        }))
        navigate('/legacy/step6')
      } else {
        sessionStorage.removeItem('ia_text_pv')
        sessionStorage.removeItem('ia_text_extrait')
        sessionStorage.removeItem('missing_fields_data')
        navigate('/legacy/finish')
      }
    } catch (err) {
      if (err?.status === 422 && err?.data) {
        sessionStorage.setItem('missing_fields_data', JSON.stringify({
          source: 'step5',
          fields: err.data?.fields ?? err.data,
          mode: 'pdf',
          form: 'formulaire1',
        }))
        navigate('/legacy/step6')
      } else {
        setError(err?.message || t.errGeneric)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div className="mx-auto max-w-2xl" variants={pageContainer} initial="hidden" animate="visible">
      <motion.div
        variants={cardReveal}
        className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Legacy</p>
        <h2 className="mt-3 mb-2 text-2xl font-bold text-slate-100">{t.title}</h2>
        <p className="mb-6 text-sm text-slate-400">{t.subtitle}</p>

        {aiLoading ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">{t.loading}</p>
            <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
              <motion.div
                className="h-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400"
                initial={{ width: '0%' }}
                animate={{ width: `${aiProgress}%` }}
                transition={{ duration: 0.35, ease: 'linear' }}
              />
            </div>
            <p className="text-xs text-slate-500">{aiProgress}%</p>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-200 leading-relaxed focus:border-emerald-400 focus:outline-none resize-y"
            />

            {error && (
              <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => navigate('/legacy/step4')}
                className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-400 hover:text-slate-100">
                {t.back}
              </button>
              <button type="button" onClick={onFinish} disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? '...' : t.finish}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export default LegacyStep5Page

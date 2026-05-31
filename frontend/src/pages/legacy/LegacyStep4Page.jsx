import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost } from '../../lib/legacyApi'

function LegacyStep4Page({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [aiProgress, setAiProgress] = useState(0)
  const [aiLoading, setAiLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap 5 - PV (IA)',
        subtitle: 'De AI-gegenereerde tekst van het proces-verbaal. U kunt deze bewerken.',
        loading: 'AI genereert de PV-tekst...',
        finish: 'Voltooien',
        back: 'Terug',
        errGeneric: 'Er is een fout opgetreden.',
      }
    : {
        title: 'Etape 5 - PV (IA)',
        subtitle: 'Le texte PV genere par IA. Vous pouvez le modifier.',
        loading: 'L\'IA genere le texte du PV...',
        finish: 'Terminer',
        back: 'Retour',
        errGeneric: 'Une erreur est survenue.',
      }

  useEffect(() => {
    const id = sessionStorage.getItem('demande_id')
    if (!id) { navigate('/legacy/step1'); return }

    const cachedText = sessionStorage.getItem('ia_text_pv')
    if (cachedText) {
      setText(cachedText)
      setAiProgress(100)
      setAiLoading(false)
      return
    }

    // Fake progress bar from 0→100% over ~3s
    let progress = 0
    timerRef.current = setInterval(() => {
      progress = Math.min(progress + 3, 95)
      setAiProgress(progress)
    }, 90)

    const checkCredits = async () => {
      try {
        const data = await legacyGet('/billing/subscription')
        const hasCredits = data?.credits > 0 || data?.active_subscription || data?.valid_coupon
        if (!hasCredits) navigate('/legacy/buy-credits')
      } catch { /* proceed */ }
    }

    const fetchAiText = async () => {
      await checkCredits()
      try {
        const data = await legacyGet(`/getTextWithIA/${id}`)
        const generatedText = data?.text ?? data?.pv_text ?? data?.content ?? ''
        sessionStorage.setItem('ia_text_pv', generatedText)
        setText(generatedText)
      } catch (err) {
        setError(err?.message || t.errGeneric)
      } finally {
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
      await legacyPost(`/demandes/${id}/progress`, { progress: 100 })
      const res = await legacyPost(`/demandes/${id}/text`, { text })

      // Success
      navigate('/legacy/step5')
    } catch (err) {
      if (err?.status === 422 && err?.data?.fields) {
        sessionStorage.setItem('missing_fields_data', JSON.stringify({
          source: 'step4',
          fields: err.data.fields,
          mode: 'ia',
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

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Progression</span>
            <span className="text-xs text-emerald-400 font-semibold">100%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-700">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '100%' }} />
          </div>
        </div>

        {aiLoading ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">{t.loading}</p>
            <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
              <motion.div
                className="h-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400"
                initial={{ width: '0%' }}
                animate={{ width: `${aiProgress}%` }}
                transition={{ duration: 0.3, ease: 'linear' }}
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
              <button type="button" onClick={() => navigate('/legacy/step3')}
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

export default LegacyStep4Page

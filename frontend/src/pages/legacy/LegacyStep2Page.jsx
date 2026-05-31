import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardReveal, pageContainer } from '../../lib/motionPresets'
import { legacyGet, legacyPost, legacyPostForm } from '../../lib/legacyApi'

const PROGRESS_BAR = (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-slate-400">Progression</span>
      <span className="text-xs text-emerald-400 font-semibold">50%</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-700">
      <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '50%' }} />
    </div>
  </div>
)

function LegacyStep2Page({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const [type, setType] = useState('comptable')
  const [form, setForm] = useState({
    nom: '', prenom: '', date_naissance: '', lieu_naissance: '',
    numero_registre_national: '', domicile: '', gsm: '',
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [prefilling, setPrefilling] = useState(true)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const t = uiLanguage === 'nl'
    ? {
        title: 'Stap 3 - Bewaarder',
        typeLabel: 'Type bewaarder',
        comptable: 'Boekhouder',
        gestionnaire: 'Beheerder',
        nom: 'Achternaam',
        prenom: 'Voornaam',
        dateNaissance: 'Geboortedatum',
        lieuNaissance: 'Geboorteplaats',
        numReg: 'Rijksregisternummer',
        domicile: 'Domicilie',
        gsm: 'GSM',
        idCard: 'Identiteitskaart (PDF of afbeelding)',
        back: 'Terug',
        next: 'Volgende',
        errGeneric: 'Er is een fout opgetreden.',
        errRequired: 'Naam en voornaam zijn verplicht.',
      }
    : {
        title: 'Etape 3 - Depositaire',
        typeLabel: 'Type de depositaire',
        comptable: 'Comptable',
        gestionnaire: 'Gestionnaire',
        nom: 'Nom',
        prenom: 'Prenom',
        dateNaissance: 'Date de naissance',
        lieuNaissance: 'Lieu de naissance',
        numReg: 'Numero de registre national',
        domicile: 'Domicile',
        gsm: 'GSM',
        idCard: "Carte d'identite (PDF ou image)",
        back: 'Retour',
        next: 'Suivant',
        errGeneric: 'Une erreur est survenue.',
        errRequired: 'Le nom et le prenom sont requis.',
      }

  useEffect(() => {
    const id = sessionStorage.getItem('demande_id')
    if (!id) { navigate('/legacy/step1'); return }

    const prefill = async () => {
      try {
        const data = await legacyGet(`/depositaires/${id}`)
        if (data) {
          setType(data.type ?? 'comptable')
          setForm((f) => ({
            ...f,
            nom: data.nom ?? '',
            prenom: data.prenom ?? '',
            date_naissance: data.date_naissance ?? '',
            lieu_naissance: data.lieu_naissance ?? '',
            numero_registre_national: data.numero_registre_national ?? '',
            domicile: data.domicile ?? '',
            gsm: data.gsm ?? '',
          }))
        }
      } catch (err) {
        const status = err?.status
        if (status === 404 || status === 500 || status === 503) {
          sessionStorage.setItem('depositaire_api_disabled', 'true')
        }
      } finally {
        setPrefilling(false)
      }
    }

    prefill()
  }, [navigate])

  const onChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const onSubmit = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) {
      setError(t.errRequired)
      return
    }
    setError('')
    setLoading(true)

    const id = sessionStorage.getItem('demande_id')
    const apiDisabled = sessionStorage.getItem('depositaire_api_disabled') === 'true'

    const payload = {
      type,
      nom: form.nom,
      prenom: form.prenom,
      ...(type === 'gestionnaire' && {
        date_naissance: form.date_naissance,
        lieu_naissance: form.lieu_naissance,
        numero_registre_national: form.numero_registre_national,
        domicile: form.domicile,
        gsm: form.gsm,
      }),
    }

    try {
      if (apiDisabled) {
        sessionStorage.setItem('depositaire_fallback', JSON.stringify(payload))
      } else {
        const fd = new FormData()
        fd.append('demande_id', id)
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v ?? ''))
        if (file) fd.append('carte_identite', file)
        await legacyPostForm('/depositaires', fd)
      }

      await legacyPost(`/demandes/${id}/progress`, { progress: 50 })
      navigate('/legacy/step3')
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
        {PROGRESS_BAR}

        <div className="space-y-5">
          {/* Type selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.typeLabel}</label>
            <div className="flex gap-4">
              {['comptable', 'gestionnaire'].map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="radio" name="depositaire_type" value={v} checked={type === v}
                    onChange={() => setType(v)} className="accent-emerald-400" />
                  {v === 'comptable' ? t.comptable : t.gestionnaire}
                </label>
              ))}
            </div>
          </div>

          <Field label={t.nom} value={form.nom} onChange={onChange('nom')} />
          <Field label={t.prenom} value={form.prenom} onChange={onChange('prenom')} />

          {type === 'gestionnaire' && (
            <>
              <Field label={t.dateNaissance} type="date" value={form.date_naissance} onChange={onChange('date_naissance')} />
              <Field label={t.lieuNaissance} value={form.lieu_naissance} onChange={onChange('lieu_naissance')} />
              <Field label={t.numReg} value={form.numero_registre_national} onChange={onChange('numero_registre_national')} />
              <Field label={t.domicile} value={form.domicile} onChange={onChange('domicile')} />
              <Field label={t.gsm} value={form.gsm} onChange={onChange('gsm')} />
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{t.idCard}</label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-300 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={() => navigate('/legacy/step1-validate')}
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

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      <input type={type} value={value} onChange={onChange}
        className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none" />
    </div>
  )
}

export default LegacyStep2Page

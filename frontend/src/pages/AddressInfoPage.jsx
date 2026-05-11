import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

function AddressInfoPage() {
  const navigate = useNavigate()
  const companyData = useMemo(() => {
    const raw = localStorage.getItem('aktly_company_data')
    return raw ? JSON.parse(raw) : null
  }, [])

  const [form, setForm] = useState({
    rue: '',
    numero: '',
    boite: '',
    codePostal: '',
    commune: '',
    dateChangement: '',
    dateAgIdentique: true,
    dateAssembleeGenerale: '',
  })
  const [saved, setSaved] = useState(false)

  const onChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'dateAgIdentique' && checked
        ? { dateAssembleeGenerale: '' }
        : {}),
    }))
  }

  const onSubmit = (event) => {
    event.preventDefault()

    localStorage.setItem('aktly_step_5', 'done')
    localStorage.setItem(
      'aktly_address_info',
      JSON.stringify({
        ...form,
        dateAssembleeGenerale: form.dateAgIdentique
          ? form.dateChangement
          : form.dateAssembleeGenerale,
      }),
    )
    setSaved(true)
    navigate('/dossier-final')
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
        className="wow-panel rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-indigo-900/20"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">
          Page 4 - Nouvelles adresses + informations
        </p>
        <h2 className="mt-3 text-3xl font-bold">Nouvelles adresses + informations</h2>
        <p className="mt-2 text-slate-300">
          Renseigne la nouvelle adresse et la date de changement de statut.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-200 sm:col-span-2">
              Rue
              <input
                type="text"
                name="rue"
                value={form.rue}
                onChange={onChange}
                className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
                placeholder="Rue du test"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Numero
              <input
                type="text"
                name="numero"
                value={form.numero}
                onChange={onChange}
                className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
                placeholder="21"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-200">
              Boite
              <input
                type="text"
                name="boite"
                value={form.boite}
                onChange={onChange}
                className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
                placeholder="B"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Code postal
              <input
                type="text"
                name="codePostal"
                value={form.codePostal}
                onChange={onChange}
                className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
                placeholder="1000"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Commune
              <input
                type="text"
                name="commune"
                value={form.commune}
                onChange={onChange}
                className="wow-input mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
                placeholder="Bruxelles"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-200">
            Date de changement
            <input
              type="date"
              name="dateChangement"
              required
              value={form.dateChangement}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              name="dateAgIdentique"
              checked={form.dateAgIdentique}
              onChange={onChange}
              className="h-4 w-4"
            />
            Date d'assemblee generale identique a la date de changement
          </label>

          {!form.dateAgIdentique && (
            <label className="block text-sm font-medium text-slate-200">
              Date d'assemblee generale
              <input
                type="date"
                name="dateAssembleeGenerale"
                required={!form.dateAgIdentique}
                value={form.dateAssembleeGenerale}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none transition focus:border-indigo-300"
              />
            </label>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/depositaire')}
              className="wow-btn rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Precedent
            </button>
            <button
              type="submit"
              className="wow-btn rounded-xl bg-indigo-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-indigo-300"
            >
              Suivant
            </button>
          </div>
        </form>

        {saved && (
          <div className="mt-4 rounded-xl border border-indigo-300/40 bg-indigo-300/10 px-3 py-2 text-sm text-indigo-100">
            Etape 5 enregistree avec succes.
          </div>
        )}
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">Informations entreprise courantes</h3>
        <p className="mt-2 text-sm text-slate-300">
          Affichage de rappel des donnees entreprise recuperees precedemment.
        </p>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
          <p>
            Nom: {companyData?.company_name ?? 'Entreprise non chargee'}
          </p>
          <p>Numero: {companyData?.number ?? '-'}</p>
          <p>Adresse: {companyData?.address ?? '-'}</p>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Source de reference etape 5: E:\Mohammed el yakoubi\Legakte
        </p>
      </motion.aside>
    </motion.div>
  )
}

export default AddressInfoPage

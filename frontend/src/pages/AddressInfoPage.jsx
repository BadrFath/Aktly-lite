import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { cardReveal, pageContainer } from '../lib/motionPresets'
import { useNavigate } from 'react-router-dom'

const LEGAL_FORM_NL_TO_FR = {
  'Besloten Vennootschap': 'Société à responsabilité limitée',
  'BV': 'SRL',
  'BVBA': 'SPRL',
  'Besloten Vennootschap met Beperkte Aansprakelijkheid': 'Société Privée à Responsabilité Limitée',
  'Naamloze Vennootschap': 'Société Anonyme',
  'NV': 'SA',
  'Gewone commanditaire vennootschap': 'Société en commandite simple',
  'CommV': 'SComm',
  'Commanditaire vennootschap op aandelen': 'Société en commandite par actions',
  'CVA': 'SCA',
  'Vennootschap onder firma': 'Société en nom collectif',
  'VOF': 'SNC',
  'Coöperatieve vennootschap': 'Société coopérative',
  'CV': 'SC',
  'Vereniging zonder winstoogmerk': 'Association sans but lucratif',
  'VZW': 'ASBL',
  'Internationale vereniging zonder winstoogmerk': 'Association internationale sans but lucratif',
  'IVZW': 'AISBL',
  'Stichting': 'Fondation',
  'Private stichting': 'Fondation privée',
  'Maatschap': 'Société de droit commun',
  'Eenmanszaak': 'Entreprise individuelle',
  'Landbouwvennootschap': 'Société agricole',
  'Economisch samenwerkingsverband': "Groupement d'intérêt économique",
  'ESV': 'GIE',
  'Europese vennootschap': 'Société européenne',
}
const LEGAL_FORM_FR_TO_NL = Object.fromEntries(
  Object.entries(LEGAL_FORM_NL_TO_FR).map(([nl, fr]) => [fr, nl])
)

function translateLegalForm(legalForm, targetLang) {
  if (!legalForm) return legalForm
  if (targetLang === 'fr') return LEGAL_FORM_NL_TO_FR[legalForm] || legalForm
  if (targetLang === 'nl') return LEGAL_FORM_FR_TO_NL[legalForm] || legalForm
  return legalForm
}

function AddressInfoPage({ uiLanguage = 'fr' }) {
  const navigate = useNavigate()
  const companyData = useMemo(() => {
    const raw = localStorage.getItem('aktly_company_data')
    return raw ? JSON.parse(raw) : null
  }, [])

  const currentAddress = companyData?.addresses?.[0] ?? {}

  const [docLang, setDocLang] = useState(
    localStorage.getItem('aktly_documents_lang') || 'fr'
  )

  const [form, setForm] = useState({
    rue: currentAddress?.street ?? '',
    numero: currentAddress?.houseNumber ?? '',
    boite: currentAddress?.box ?? '',
    codePostal: currentAddress?.postalCode ?? '',
    commune: currentAddress?.municipality ?? '',
    dateChangement: '',
    dateAgIdentique: true,
    dateAssembleeGenerale: '',
  })
  const [saved, setSaved] = useState(false)
  const t = uiLanguage === 'nl'
    ? {
        pageTag: 'Pagina 4 - Nieuwe adressen + informatie',
        title: 'Nieuwe adressen + informatie',
        subtitle: 'Vul het nieuwe adres en de datum van statuutwijziging in.',
        street: 'Straat',
        number: 'Nummer',
        box: 'Bus',
        zip: 'Postcode',
        city: 'Gemeente',
        changeDate: 'Wijzigingsdatum',
        sameAgDate: 'Datum algemene vergadering is gelijk aan wijzigingsdatum',
        agDate: 'Datum algemene vergadering',
        prev: 'Vorige',
        next: 'Volgende',
        saved: 'Stap 5 succesvol opgeslagen.',
        currentInfo: 'Huidige bedrijfsinformatie',
        currentInfoDesc: 'Overzicht van eerder opgehaalde bedrijfsgegevens.',
        name: 'Naam',
        enterpriseNumber: 'Nummer',
        address: 'Adres',
        legalForm: 'Rechtsvorm',
        notLoaded: 'Onderneming niet geladen',
        source: 'Referentiebron stap 5',
        docLangTitle: 'Taal van de gegenereerde documenten',
        docLangDesc: 'Kies de taal waarmee de formulieren worden aangemaakt.',
      }
    : {
        pageTag: 'Page 4 - Nouvelles adresses + informations',
        title: 'Nouvelles adresses + informations',
        subtitle: 'Renseigne la nouvelle adresse et la date de changement de statut.',
        street: 'Rue',
        number: 'Numero',
        box: 'Boite',
        zip: 'Code postal',
        city: 'Commune',
        changeDate: 'Date de changement',
        sameAgDate: "Date d'assemblee generale identique a la date de changement",
        agDate: "Date d'assemblee generale",
        prev: 'Precedent',
        next: 'Suivant',
        saved: 'Etape 5 enregistree avec succes.',
        currentInfo: 'Informations entreprise pre-remplies',
        currentInfoDesc: 'Rappel des donnees entreprise recuperees precedemment.',
        name: 'Entreprise',
        enterpriseNumber: 'Numero BCE',
        address: 'Adresse BCE',
        legalForm: 'Forme juridique',
        notLoaded: 'Entreprise non chargee',
        source: 'Source de reference etape 5',
        docLangTitle: 'Langue de generation des fichiers',
        docLangDesc: 'Choisissez la langue dans laquelle les formulaires seront generes.',
      }

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

  const onDocLangChange = (lang) => {
    setDocLang(lang)
    localStorage.setItem('aktly_documents_lang', lang)
  }

  const onSubmit = (event) => {
    event.preventDefault()

    localStorage.setItem('aktly_step_5', 'done')
    localStorage.setItem('aktly_documents_lang', docLang)
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
          {t.pageTag}
        </p>
        <h2 className="mt-3 text-3xl font-bold">{t.title}</h2>
        <p className="mt-2 text-slate-300">
          {t.subtitle}
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-200 sm:col-span-2">
              {t.street}
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
              {t.number}
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
              {t.box}
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
              {t.zip}
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
              {t.city}
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
            {t.changeDate}
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
            {t.sameAgDate}
          </label>

          {!form.dateAgIdentique && (
            <label className="block text-sm font-medium text-slate-200">
              {t.agDate}
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
              {t.prev}
            </button>
            <button
              type="submit"
              className="wow-btn rounded-xl bg-indigo-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-indigo-300"
            >
              {t.next}
            </button>
          </div>
        </form>

        {saved && (
          <div className="mt-4 rounded-xl border border-indigo-300/40 bg-indigo-300/10 px-3 py-2 text-sm text-indigo-100">
            {t.saved}
          </div>
        )}
      </motion.article>

      <motion.aside
        variants={cardReveal}
        className="wow-panel-soft rounded-3xl border border-white/10 bg-slate-900/40 p-6"
      >
        <h3 className="text-xl font-semibold">{t.currentInfo}</h3>
        <p className="mt-2 text-sm text-slate-300">
          {t.currentInfoDesc}
        </p>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
          <p>
            {t.name}: {companyData?.company_name ?? t.notLoaded}
          </p>
          <p>{t.enterpriseNumber}: {companyData?.number ?? '-'}</p>
          <p>{t.address}: {companyData?.address ?? '-'}</p>
          <p>{t.legalForm}: {translateLegalForm(companyData?.enterprise?.legalForm ?? '-', docLang)}</p>
        </div>

        <div className="mt-6 rounded-xl border border-indigo-400/30 bg-indigo-950/30 p-4">
          <p className="text-sm font-semibold text-indigo-200">{t.docLangTitle}</p>
          <p className="mt-1 text-xs text-slate-400">{t.docLangDesc}</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => onDocLangChange('fr')}
              className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                docLang === 'fr'
                  ? 'border-indigo-400 bg-indigo-400 text-slate-950'
                  : 'border-slate-600 bg-slate-950 text-slate-300 hover:border-indigo-400'
              }`}
            >
              🇫🇷 Français
            </button>
            <button
              type="button"
              onClick={() => onDocLangChange('nl')}
              className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                docLang === 'nl'
                  ? 'border-indigo-400 bg-indigo-400 text-slate-950'
                  : 'border-slate-600 bg-slate-950 text-slate-300 hover:border-indigo-400'
              }`}
            >
              🇧🇪 Nederlands
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {t.source}: E:\Mohammed el yakoubi\Legakte
        </p>
      </motion.aside>
    </motion.div>
  )
}

export default AddressInfoPage

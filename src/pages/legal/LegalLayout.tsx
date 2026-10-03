import { Link } from 'react-router-dom'
import { Leaf, ArrowLeft } from 'lucide-react'

/** Mise en page commune des pages juridiques publiques (CGU, confidentialité). */
export default function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-900 text-white">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-600" />
            </span>
            <span className="font-bold">GeoCollect <span className="text-primary-300 font-normal">EUDR</span></span>
          </Link>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary-100 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Retour à la connexion
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Dernière mise à jour : {updated}</p>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm mb-8">
          <b>Modèle à personnaliser.</b> Ce document est un modèle fourni avec la plateforme. Remplacez les mentions entre
          crochets [ ] par vos informations réelles et faites-le valider par un conseil juridique avant publication définitive.
        </div>

        <article className="space-y-6 text-sm leading-relaxed text-gray-700
          [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-8 [&_h2]:mb-2
          [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-4 [&_h3]:mb-1
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:mb-2 [&_a]:text-primary-700 [&_a]:underline">
          {children}
        </article>

        <footer className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/cgu" className="hover:text-gray-600">Conditions générales d'utilisation</Link>
          <Link to="/confidentialite" className="hover:text-gray-600">Politique de confidentialité</Link>
          <span>© {new Date().getFullYear()} GeoCollect EUDR</span>
        </footer>
      </main>
    </div>
  )
}

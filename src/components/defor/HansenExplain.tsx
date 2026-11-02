import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DeforestationOptions } from '../../api/deforestation'
import { RISK_LEVELS_TEXT } from '../../utils/deforExplain'

/** « Comprendre cette analyse » : méthode Hansen, statuts, niveaux de risque, matrice RDUE et limites, en clair. */
export default function HansenExplain({ opts }: { opts: DeforestationOptions }) {
  const [open, setOpen] = useState(false)
  const cutoff = opts.standard === 'EUDR' ? '31 décembre 2020' : '31 décembre 2013'
  const n = (v: number) => v.toLocaleString('fr-FR')
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/50">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-blue-900">
        <HelpCircle className="h-4 w-4" /> Comprendre cette analyse {open ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 text-sm text-gray-700 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold text-gray-900">Comment ça marche</p>
            <p><b>1.</b> Chaque parcelle est découpée en pixels de 30 m de la carte <b>Hansen Global Forest Change</b> (Université du Maryland, satellites Landsat).</p>
            <p><b>2.</b> Un pixel est « forêt » si son couvert arboré dépassait <b>{opts.treecover_min} %</b> en 2000 (définition de la FAO).</p>
            <p><b>3.</b> Pour chaque pixel forestier, la carte donne l'année où les arbres ont disparu. Seules les pertes <b>après le {cutoff}</b> (date butoir de la norme choisie) comptent.</p>
            <p><b>4.</b> La surface perdue est rapportée à la surface de la parcelle, puis classée :</p>
            <ul className="ml-5 list-disc space-y-1">
              <li><b className="text-green-700">Conforme</b> : perte nulle ou inférieure à {n(opts.tolerance_ha)} ha (bord de pixel, imprécision GPS).</li>
              <li><b className="text-amber-700">À risque</b> : perte au-delà de la tolérance, mais pas plus de {n(opts.alert_pct)} % de la parcelle : à vérifier sur image.</li>
              <li><b className="text-red-700">Non conforme</b> : perte de plus de {n(opts.alert_pct)} % de la parcelle.</li>
              <li><b className="text-gray-600">Indéterminé</b> : géométrie illisible ou hors de la zone couverte.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-gray-900">Niveau de risque</p>
            <p>{RISK_LEVELS_TEXT.map(([l, t]) => `${l} : ${t}`).join(' · ')}.</p>
            <p className="font-semibold text-gray-900">Matrice RDUE (Côte d'Ivoire)</p>
            <p>Deux critères indépendants : la <b>légalité</b> (une parcelle en forêt classée ou en parc est illégale ; une enclave ou une agro-forêt est admise) et le <b>zéro déforestation</b> (forêt ou agriculture au 31/12/2020). La parcelle n'est « potentiellement conforme » que si les deux sont respectés.</p>
            <p className="font-semibold text-gray-900">Limites</p>
            <p>Hansen est <b>une seule source</b> : le cacao sous ombrage peut être pris pour de la forêt, un nuage pour une perte. Cliquez une ligne du tableau pour lire l'explication de la parcelle. Pour un avis croisé entre quatre cartes (JRC, TMF, WorldCover, Hansen), utilisez la <Link to="/coop/due-diligence" className="font-semibold text-primary-700 underline">diligence raisonnée</Link>.</p>
          </div>
        </div>
      )}
    </section>
  )
}

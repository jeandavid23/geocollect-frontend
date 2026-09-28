import { useMemo, useState } from 'react'
import { X, Search } from 'lucide-react'
import { availableFunctions } from '../../utils/spreadsheet/engine'
import { EN_TO_FR } from '../../utils/spreadsheet/refs'

// Fonctions les plus utiles pour un registre de producteurs (nom français, syntaxe, rôle)
const COMMON: { fr: string; en: string; syntax: string; desc: string; cat: string }[] = [
  { cat: 'Calcul', fr: 'SOMME', en: 'SUM', syntax: 'SOMME(B2:B500)', desc: 'Additionne une plage (ex. total des hectares).' },
  { cat: 'Calcul', fr: 'MOYENNE', en: 'AVERAGE', syntax: 'MOYENNE(B2:B500)', desc: 'Moyenne des valeurs.' },
  { cat: 'Calcul', fr: 'MAX / MIN', en: 'MAX', syntax: 'MAX(B2:B500)', desc: 'Plus grande / plus petite valeur.' },
  { cat: 'Calcul', fr: 'ARRONDI', en: 'ROUND', syntax: 'ARRONDI(B2*1,5;2)', desc: 'Arrondit à n décimales.' },
  { cat: 'Calcul', fr: 'SOMMEPROD', en: 'SUMPRODUCT', syntax: 'SOMMEPROD(B2:B500;C2:C500)', desc: 'Somme des produits (ex. kg × prix).' },
  { cat: 'Comptage', fr: 'NB', en: 'COUNT', syntax: 'NB(B2:B500)', desc: 'Nombre de cellules contenant un nombre.' },
  { cat: 'Comptage', fr: 'NBVAL', en: 'COUNTA', syntax: 'NBVAL(A2:A500)', desc: 'Nombre de cellules non vides (ex. nombre de producteurs).' },
  { cat: 'Comptage', fr: 'NB.SI', en: 'COUNTIF', syntax: 'NB.SI(E2:E500;"Femme")', desc: 'Compte les cellules qui remplissent une condition.' },
  { cat: 'Comptage', fr: 'NB.SI.ENS', en: 'COUNTIFS', syntax: 'NB.SI.ENS(E2:E500;"Femme";G2:G500;"BEOUMI")', desc: 'Compte avec plusieurs conditions.' },
  { cat: 'Comptage', fr: 'SOMME.SI', en: 'SUMIF', syntax: 'SOMME.SI(G2:G500;"BEOUMI";K2:K500)', desc: 'Somme conditionnelle (ex. hectares d\'une section).' },
  { cat: 'Comptage', fr: 'SOMME.SI.ENS', en: 'SUMIFS', syntax: 'SOMME.SI.ENS(K2:K500;G2:G500;"BEOUMI";E2:E500;"Femme")', desc: 'Somme avec plusieurs conditions.' },
  { cat: 'Comptage', fr: 'MOYENNE.SI', en: 'AVERAGEIF', syntax: 'MOYENNE.SI(G2:G500;"BEOUMI";K2:K500)', desc: 'Moyenne conditionnelle.' },
  { cat: 'Logique', fr: 'SI', en: 'IF', syntax: 'SI(K2>4;"Grande";"Petite")', desc: 'Renvoie une valeur selon une condition.' },
  { cat: 'Logique', fr: 'SI.CONDITIONS', en: 'IFS', syntax: 'SI.CONDITIONS(K2<2;"<2 ha";K2<4;"2-4 ha";VRAI;">4 ha")', desc: 'Plusieurs conditions à la suite.' },
  { cat: 'Logique', fr: 'ET / OU', en: 'AND', syntax: 'SI(ET(K2>0;L2="Oui");"OK";"")', desc: 'Combine des conditions.' },
  { cat: 'Logique', fr: 'SIERREUR', en: 'IFERROR', syntax: 'SIERREUR(RECHERCHEV(A2;Livraisons!A:C;3;FAUX);0)', desc: 'Valeur de remplacement en cas d\'erreur.' },
  { cat: 'Recherche', fr: 'RECHERCHEV', en: 'VLOOKUP', syntax: 'RECHERCHEV(A2;Producteurs!A:K;11;FAUX)', desc: 'Cherche une valeur dans la 1re colonne et renvoie une autre colonne.' },
  { cat: 'Recherche', fr: 'RECHERCHEX', en: 'XLOOKUP', syntax: 'RECHERCHEX(A2;Producteurs!A:A;Producteurs!K:K;"absent")', desc: 'Recherche moderne, dans n\'importe quel sens.' },
  { cat: 'Recherche', fr: 'INDEX + EQUIV', en: 'INDEX', syntax: 'INDEX(K2:K500;EQUIV("CP-0012";A2:A500;0))', desc: 'Recherche par position.' },
  { cat: 'Texte', fr: 'CONCAT', en: 'CONCAT', syntax: 'CONCAT(B2;" ";C2)', desc: 'Assemble des textes (ex. nom + prénoms).' },
  { cat: 'Texte', fr: 'JOINDRE.TEXTE', en: 'TEXTJOIN', syntax: 'JOINDRE.TEXTE(", ";VRAI;F2:F20)', desc: 'Assemble une plage avec un séparateur.' },
  { cat: 'Texte', fr: 'MAJUSCULE', en: 'UPPER', syntax: 'MAJUSCULE(B2)', desc: 'Met en majuscules.' },
  { cat: 'Texte', fr: 'NOMPROPRE', en: 'PROPER', syntax: 'NOMPROPRE(C2)', desc: 'Première lettre de chaque mot en majuscule.' },
  { cat: 'Texte', fr: 'SUPPRESPACE', en: 'TRIM', syntax: 'SUPPRESPACE(B2)', desc: 'Retire les espaces en trop.' },
  { cat: 'Texte', fr: 'GAUCHE / DROITE / STXT', en: 'LEFT', syntax: 'GAUCHE(A2;3)', desc: 'Extrait des caractères.' },
  { cat: 'Texte', fr: 'NBCAR', en: 'LEN', syntax: 'NBCAR(D2)', desc: 'Nombre de caractères (ex. contrôle des numéros).' },
  { cat: 'Date', fr: 'AUJOURDHUI', en: 'TODAY', syntax: 'AUJOURDHUI()', desc: 'Date du jour.' },
  { cat: 'Date', fr: 'ANNEE', en: 'YEAR', syntax: 'ANNEE(AUJOURDHUI())-F2', desc: 'Année d\'une date (ex. calcul de l\'âge).' },
  { cat: 'Date', fr: 'DATEDIF', en: 'DATEDIF', syntax: 'DATEDIF(F2;AUJOURDHUI();"Y")', desc: 'Écart entre deux dates (années, mois, jours).' },
  { cat: 'Statistiques', fr: 'MEDIANE', en: 'MEDIAN', syntax: 'MEDIANE(K2:K500)', desc: 'Valeur médiane.' },
  { cat: 'Statistiques', fr: 'ECARTYPE', en: 'STDEV', syntax: 'ECARTYPE(K2:K500)', desc: 'Écart-type d\'un échantillon.' },
  { cat: 'Statistiques', fr: 'RANG', en: 'RANK', syntax: 'RANG(K2;K$2:K$500)', desc: 'Classement d\'une valeur.' },
  { cat: 'Statistiques', fr: 'GRANDE.VALEUR', en: 'LARGE', syntax: 'GRANDE.VALEUR(K2:K500;1)', desc: 'k-ième plus grande valeur.' },
]

interface Props {
  onInsert: (fnName: string) => void // insère « NOM( » dans la cellule en cours d'édition
  onClose: () => void
}

export default function FunctionsHelp({ onInsert, onClose }: Props) {
  const [q, setQ] = useState('')
  const all = useMemo(() => availableFunctions(), [])
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const common = COMMON.filter((f) => !q || norm(`${f.fr} ${f.en} ${f.desc}`).includes(norm(q)))
  const others = all.filter((n) => !q || norm(n).includes(norm(q)) || norm(EN_TO_FR[n] ?? '').includes(norm(q)))

  return (
    <aside className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="font-semibold text-gray-900 text-sm">Fonctions ({all.length})</p>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
      </div>
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SOMME.SI, RECHERCHEV, date…"
            className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Saisie en français ou en anglais, séparateur « ; » ou « , ». Les formules sont enregistrées en anglais, comme dans le fichier Excel.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {common.map((f) => (
          <button key={f.fr} onClick={() => onInsert(f.fr.split(' ')[0])}
            className="w-full text-left p-2.5 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50/40">
            <p className="text-xs"><span className="font-bold text-gray-900">{f.fr}</span> <span className="text-gray-400">· {f.en} · {f.cat}</span></p>
            <p className="font-mono text-[11px] text-primary-800 mt-0.5 break-all">={f.syntax}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{f.desc}</p>
          </button>
        ))}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Toutes les fonctions disponibles</p>
          <div className="flex flex-wrap gap-1">
            {others.map((n) => (
              <button key={n} onClick={() => onInsert(n)} title={EN_TO_FR[n] ? `En français : ${EN_TO_FR[n]}` : undefined}
                className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-primary-100 text-[11px] font-mono text-gray-700">
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

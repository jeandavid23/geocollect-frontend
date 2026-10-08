import type { Lot } from '../api/lots'
import { PRODUCT_LABEL, STATUS_LABEL } from '../api/lots'
import { buildTraces } from './traces'
import { downloadBlob } from './geoExport'

const fr = (n: number, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: d }).replace(/ | /g, ' ')
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('fr-FR') : '—')
// police standard des PDF (WinAnsi) : symboles hors jeu remplacés
const t = (v: unknown) => String(v ?? '').replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[→]/g, '->').replace(/[  ]/g, ' ')

/** Texte du QR code : identifie le lot et son contenu (lisible par n'importe quel lecteur, sans connexion). */
export function lotQrText(lot: Lot) {
  const c = lot.checks
  return [`LOT ${lot.code}`, `Coop: ${lot.cooperative_name}`, `Produit: ${PRODUCT_LABEL[lot.product]}`, `Campagne: ${lot.campaign}`,
    `Date: ${date(lot.lot_date)}`, `Poids net: ${fr(c?.net_weight_kg ?? lot.net_weight_kg)} kg`, `Sacs: ${lot.bags}`,
    `Producteurs: ${c?.producers.length ?? lot.lines.length}`, `Parcelles: ${c?.parcels.length ?? 0} (${fr(c?.total_area_ha ?? 0, 2)} ha)`,
    `Controles EUDR: ${c?.blocking ? `${c.blocking} bloquant(s)` : 'OK'}`, `Statut: ${STATUS_LABEL[lot.status]}`, 'GeoCollect EUDR'].join('\n')
}

/** Fiche de lot PDF (A4) : identification, contrôles EUDR, livraisons des producteurs, parcelles d'origine, QR code, signatures. */
export async function lotPdf(lot: Lot) {
  const [{ jsPDF }, { default: autoTable }, QR] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('qrcode')])
  const c = lot.checks
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const green: [number, number, number] = [24, 58, 37]
  const gold: [number, number, number] = [233, 201, 139]

  // En-tête
  doc.setFillColor(...green); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('FICHE DE LOT', 14, 13)
  doc.setFontSize(11); doc.setTextColor(...gold); doc.text(t(lot.code), 14, 20)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(t(`${lot.cooperative_name} · ${PRODUCT_LABEL[lot.product]} · campagne ${lot.campaign}`), 14, 26)
  const qr = await QR.toDataURL(lotQrText(lot), { margin: 0, width: 300, errorCorrectionLevel: 'M' })
  doc.setFillColor(255, 255, 255); doc.rect(W - 40, 3, 26, 26, 'F'); doc.addImage(qr, 'PNG', W - 39, 4, 24, 24)

  // Identification
  doc.setTextColor(30, 30, 30)
  autoTable(doc, {
    startY: 36, theme: 'grid', styles: { fontSize: 9, cellPadding: 1.8 }, headStyles: { fillColor: green },
    head: [['Identification du lot', '', '', '']],
    body: [
      ['Numéro de lot', t(lot.code), 'Statut', STATUS_LABEL[lot.status]],
      ['Produit', PRODUCT_LABEL[lot.product], 'Qualité / grade', t(lot.quality || '—')],
      ['Date de constitution', date(lot.lot_date), 'Campagne', t(lot.campaign)],
      ['Nombre de sacs', String(lot.bags), 'Poids brut (kg)', lot.gross_weight_kg ? fr(Number(lot.gross_weight_kg)) : '—'],
      ['Poids net livré (kg)', fr(c?.net_weight_kg ?? lot.net_weight_kg), 'Magasin', t(lot.warehouse || '—')],
      ['Acheteur / exportateur', t(lot.buyer || '—'), 'Destination', t(lot.destination || '—')],
      ['Transport', t(lot.transport || '—'), 'Établie par', t(lot.created_by_name || '—')],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 }, 2: { fontStyle: 'bold', cellWidth: 38 } },
    margin: { left: 14, right: 14 },
  })

  // Contrôles EUDR
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  const ok = !c?.blocking
  doc.setFillColor(...(ok ? [232, 243, 235] as [number, number, number] : [253, 236, 236] as [number, number, number]))
  doc.rect(14, y, W - 28, 14, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...(ok ? green : [153, 27, 27] as [number, number, number]))
  doc.text(ok ? 'Contrôles EUDR : aucune anomalie bloquante' : `Contrôles EUDR : ${c?.blocking} anomalie(s) bloquante(s)`, 18, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60)
  doc.text(t(`${c?.producers.length ?? 0} producteur(s) · ${c?.parcels.length ?? 0} parcelle(s) géolocalisée(s) · ${fr(c?.total_area_ha ?? 0, 2)} ha · ${c?.warnings ?? 0} point(s) d'attention`), 18, y + 11)
  y += 18
  if (c?.issues.length) {
    autoTable(doc, {
      startY: y, theme: 'plain', styles: { fontSize: 8, cellPadding: 1.2 }, margin: { left: 14, right: 14 },
      body: c.issues.map((i) => [i.level === 'bloquant' ? 'BLOQUANT' : 'Attention', t(i.producer), t(i.message)]),
      columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 40 } },
      didParseCell: (d) => { if (d.column.index === 0) d.cell.styles.textColor = String(d.cell.raw) === 'BLOQUANT' ? [185, 28, 28] : [161, 98, 7] },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  }

  // Livraisons
  const prod = new Map((c?.producers ?? []).map((p) => [p.producer, p]))
  autoTable(doc, {
    startY: y, theme: 'striped', headStyles: { fillColor: green, fontSize: 8.5 }, styles: { fontSize: 8, cellPadding: 1.5 },
    head: [['#', 'Producteur', 'Code', 'Village', 'Bon / reçu', 'Sacs', 'Poids (kg)', 'Parcelles', 'Surface (ha)', 'Contrôle']],
    body: lot.lines.map((l, i) => {
      const p = prod.get(l.producer)
      return [String(i + 1), t(l.producer_name), t(l.producer_code), t(l.village), t(l.receipt || '—'), String(l.bags), fr(Number(l.weight_kg)),
        String(p?.parcels ?? 0), fr(p?.area_ha ?? 0, 2), p?.status === 'ok' ? 'OK' : p?.status === 'bloquant' ? 'Bloquant' : 'À vérifier']
    }),
    foot: [['', 'Total', '', '', '', String(lot.lines.reduce((s, l) => s + l.bags, 0)), fr(c?.net_weight_kg ?? 0), String(c?.parcels.length ?? 0), fr(c?.total_area_ha ?? 0, 2), '']],
    footStyles: { fillColor: [241, 246, 242], textColor: [24, 58, 37], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  })

  // Parcelles d'origine
  if (c?.parcels.length) {
    doc.addPage()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...green); doc.text(t(`Parcelles d'origine du lot ${lot.code}`), 14, 16)
    autoTable(doc, {
      startY: 21, theme: 'striped', headStyles: { fillColor: green, fontSize: 8.5 }, styles: { fontSize: 8, cellPadding: 1.4 },
      head: [['Field ID', 'Producteur', 'Village', 'Surface (ha)', 'Statut EUDR', 'Score', 'Point (lat, lon)']],
      body: c.parcels.map((p) => {
        const g = p.geometry as GeoJSON.Polygon
        const ring = g?.type === 'Polygon' ? g.coordinates[0] : []
        const cx = ring.length ? ring.reduce((s, q) => s + q[0], 0) / ring.length : 0
        const cy = ring.length ? ring.reduce((s, q) => s + q[1], 0) / ring.length : 0
        const pr = c.producers.find((x) => x.producer === p.producer_id)
        return [t(p.field_id), t(pr?.name ?? ''), t(p.village), fr(p.area_hectares || 0, 2),
          p.eudr_status === 'compliant' ? 'Conforme' : p.eudr_status === 'non_compliant' ? 'Non conforme' : 'En attente',
          p.eudr_score != null ? `${p.eudr_score} %` : '—', ring.length ? `${cy.toFixed(6)}, ${cx.toFixed(6)}` : '—']
      }),
      margin: { left: 14, right: 14 },
    })
  }

  // Signatures (dernière page)
  const H = doc.internal.pageSize.getHeight()
  let sy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14
  if (sy > H - 45) { doc.addPage(); sy = 24 }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
  const cols = ['Responsable de la coopérative', 'Magasinier', 'Acheteur / exportateur']
  cols.forEach((label, i) => {
    const x = 14 + i * ((W - 28) / 3)
    doc.text(label, x, sy); doc.setDrawColor(180, 180, 180); doc.line(x, sy + 18, x + (W - 28) / 3 - 8, sy + 18)
    doc.setFontSize(7.5); doc.text('Nom, date et signature', x, sy + 22); doc.setFontSize(9)
  })

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(t(`Fiche de lot ${lot.code} · éditée le ${new Date().toLocaleString('fr-FR')} · GeoCollect EUDR — GeoLab Service · page ${i}/${n}`), 14, H - 7)
  }
  doc.save(`fiche_lot_${lot.code}.pdf`)
}

/** Fichier TRACES (GeoJSON EUDR) des parcelles d'origine du lot. */
export function lotTraces(lot: Lot) {
  const c = lot.checks
  if (!c?.parcels.length) return null
  const names = new Map(c.producers.map((p) => [p.producer, p.name]))
  const r = buildTraces(c.parcels.map((p) => ({
    id: p.field_id, geometry: p.geometry, producerName: names.get(p.producer_id) ?? '', productionPlace: p.village, areaHa: p.area_hectares,
  })), { country: 'CI', pointsUnder4ha: false, fillHoles: false }, `traces_${lot.code}`)
  if (r.files[0]) downloadBlob(new Blob([r.files[0].content], { type: 'application/geo+json' }), r.files[0].name)
  return r
}

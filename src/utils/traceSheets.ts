/**
 * Documents de traçabilité en PDF :
 *  - fiche de pesée : reçu de la livraison d'un producteur, en deux exemplaires (producteur, coopérative) ;
 *  - fiche d'accompagnement : document qui suit un lot pendant le transport jusqu'à l'acheteur.
 * Chaque document porte un QR code lisible sans connexion (numéro, poids, origine).
 */
import type { Delivery, ProcessingBatch, Trace, TransportSlip } from '../api/trace'
import { OPERATION_LABEL, SLIP_STATUS } from '../api/trace'
import type { Lot } from '../api/lots'
import { PRODUCT_LABEL } from '../api/lots'
import { date, fr, t } from './lotSheet'

type Rgb = [number, number, number]
const GREEN: Rgb = [24, 58, 37]
const GOLD: Rgb = [233, 201, 139]
const MARGIN = 14
type AutoTableDoc = { lastAutoTable: { finalY: number } }

async function libs() {
  const [{ jsPDF }, { default: autoTable }, QR] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('qrcode')])
  return { jsPDF, autoTable, QR }
}

const kg = (v: string | number | null | undefined) => (v == null || v === '' ? '—' : `${fr(Number(v))} kg`)
const fcfa = (v: string | number | null | undefined) => (v == null || v === '' ? '—' : `${fr(Number(v), 0)} FCFA`)

export function deliveryQrText(d: Delivery) {
  return [`PESEE ${d.number}`, `Coop: ${d.cooperative_name}`, `Producteur: ${d.producer_name} (${d.producer_code})`,
    `Date: ${date(d.delivery_date)}`, `Produit: ${PRODUCT_LABEL[d.product]}`, `Sacs: ${d.bags}`, `Net: ${fr(Number(d.net_kg))} kg`,
    `Campagne: ${d.campaign}`, d.status === 'annulee' ? 'ANNULEE' : 'Valide', 'GeoCollect EUDR'].join('\n')
}

/** Fiche de pesée : deux exemplaires identiques sur une page A4, à découper (producteur / coopérative). */
export async function deliveryPdf(d: Delivery) {
  const { jsPDF, autoTable, QR } = await libs()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const qr = await QR.toDataURL(deliveryQrText(d), { margin: 0, width: 260, errorCorrectionLevel: 'M' })

  const copy = (top: number, label: string) => {
    doc.setFillColor(...GREEN); doc.rect(MARGIN, top, W - 2 * MARGIN, 18, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('FICHE DE PESÉE', MARGIN + 4, top + 8)
    doc.setFontSize(10); doc.setTextColor(...GOLD); doc.text(t(d.number), MARGIN + 4, top + 14)
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(t(`${d.cooperative_name} · ${label}`), W - MARGIN - 4, top + 8, { align: 'right' })
    doc.text(t(`Campagne ${d.campaign}`), W - MARGIN - 4, top + 14, { align: 'right' })
    doc.addImage(qr, 'PNG', W - MARGIN - 30, top + 22, 28, 28)
    if (d.status === 'annulee') {
      doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(26)
      doc.text('ANNULÉE', W / 2, top + 70, { align: 'center', angle: 12 })
    }
    autoTable(doc, {
      startY: top + 22, theme: 'grid', styles: { fontSize: 9, cellPadding: 1.6 }, margin: { left: MARGIN, right: MARGIN + 34 },
      body: [
        ['Producteur', t(`${d.producer_name} — ${d.producer_code}`)], ['Village', t(d.village || '—')],
        ['Date de pesée', date(d.delivery_date)], ['Point de collecte', t(d.collection_point || '—')],
        ['Produit / qualité', t(`${PRODUCT_LABEL[d.product]}${d.quality ? ` — ${d.quality}` : ''}`)],
        ['Nombre de sacs', String(d.bags)], ['Poids brut', kg(d.gross_kg)], ['Tare des sacs', kg(d.tare_kg)],
        ['Réfaction (humidité, déchets)', kg(d.deduction_kg)],
        ['Humidité', d.moisture_pct ? `${fr(Number(d.moisture_pct))} %` : '—'],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 58 } },
    })
    const y = (doc as unknown as AutoTableDoc).lastAutoTable.finalY
    autoTable(doc, {
      startY: y, theme: 'grid', styles: { fontSize: 11, cellPadding: 2, fontStyle: 'bold' }, margin: { left: MARGIN, right: MARGIN + 34 },
      body: [['POIDS NET', kg(d.net_kg)], ['Prix / montant', t(`${fcfa(d.unit_price)}/kg — ${fcfa(d.amount)}`)]],
      columnStyles: { 0: { cellWidth: 58, fillColor: [241, 246, 242], textColor: GREEN } },
    })
    const sy = (doc as unknown as AutoTableDoc).lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60)
    const half = (W - 2 * MARGIN) / 2
    ;[`Peseur : ${d.weigher || '................................'}`, 'Producteur (signature ou empreinte)'].forEach((txt, i) => {
      const x = MARGIN + i * half
      doc.text(t(txt), x, sy); doc.setDrawColor(180, 180, 180); doc.line(x, sy + 12, x + half - 8, sy + 12)
    })
    doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(t(`Éditée le ${new Date().toLocaleString('fr-FR')} par ${d.created_by_name || '—'} · GeoCollect EUDR — traçabilité des volumes`), MARGIN, sy + 18)
  }

  copy(10, 'Exemplaire producteur')
  doc.setLineDashPattern([2, 2], 0); doc.setDrawColor(150, 150, 150); doc.line(4, H / 2, W - 4, H / 2); doc.setLineDashPattern([], 0)
  doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text('découper ici', W / 2, H / 2 - 1.5, { align: 'center' })
  copy(H / 2 + 6, 'Exemplaire coopérative')
  doc.save(`fiche_pesee_${d.number}.pdf`)
}

export function slipQrText(s: TransportSlip) {
  return [`FICHE ACCOMPAGNEMENT ${s.number}`, `Lot: ${s.lot_code}`, `Coop: ${s.cooperative_name}`, `Produit: ${PRODUCT_LABEL[s.lot_product]}`,
    `Sacs: ${s.bags}`, `Poids depart: ${fr(Number(s.gross_weight_kg))} kg`, `Camion: ${s.vehicle_plate}`, `Chauffeur: ${s.driver_name}`,
    `Plombs: ${s.seals || '-'}`, `Destination: ${s.destination}`, `Emise: ${new Date(s.issued_at).toLocaleString('fr-FR')}`, 'GeoCollect EUDR'].join('\n')
}

/** Fiche d'accompagnement (A4) : expédition, transport, contenu du lot par producteur, réception et signatures. */
export async function transportPdf(s: TransportSlip, lot: Lot | null) {
  const { jsPDF, autoTable, QR } = await libs()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const qr = await QR.toDataURL(slipQrText(s), { margin: 0, width: 300, errorCorrectionLevel: 'M' })

  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text("FICHE D'ACCOMPAGNEMENT", MARGIN, 13)
  doc.setFontSize(11); doc.setTextColor(...GOLD); doc.text(t(s.number), MARGIN, 20)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(t(`Lot ${s.lot_code} · ${PRODUCT_LABEL[s.lot_product]} · campagne ${s.lot_campaign} · ${SLIP_STATUS[s.status]}`), MARGIN, 26)
  doc.setFillColor(255, 255, 255); doc.rect(W - 40, 3, 26, 26, 'F'); doc.addImage(qr, 'PNG', W - 39, 4, 24, 24)

  const head = (title: string) => [[title, '', '', '']]
  const grid = (startY: number, title: string, body: string[][]) => {
    autoTable(doc, {
      startY, theme: 'grid', styles: { fontSize: 9, cellPadding: 1.7 }, headStyles: { fillColor: GREEN }, head: head(title), body,
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 2: { fontStyle: 'bold', cellWidth: 38 } }, margin: { left: MARGIN, right: MARGIN },
    })
    return (doc as unknown as AutoTableDoc).lastAutoTable.finalY + 4
  }
  let y = grid(36, 'Expédition', [
    ['Expéditeur', t(s.cooperative_name), 'Date et heure', t(new Date(s.issued_at).toLocaleString('fr-FR'))],
    ['Lieu de départ', t(s.origin || '—'), 'Destination', t(s.destination)],
    ['Destinataire', t(s.consignee || '—'), 'Établie par', t(s.created_by_name || '—')],
  ])
  y = grid(y, 'Transport', [
    ['Transporteur', t(s.carrier || '—'), 'Camion', t(s.vehicle_plate)],
    ['Remorque', t(s.trailer_plate || '—'), 'N° de plombs', t(s.seals || '—')],
    ['Chauffeur', t(s.driver_name), 'Téléphone', t(s.driver_phone || '—')],
    ['N° de permis', t(s.driver_licence || '—'), '', ''],
  ])
  y = grid(y, 'Chargement', [
    ['Nombre de sacs', String(s.bags), 'Poids au départ', kg(s.gross_weight_kg)],
    ['Lot (poids net)', lot ? kg(lot.checks?.net_weight_kg ?? lot.net_weight_kg) : '—', 'Contrôles EUDR du lot',
      lot?.checks ? (lot.checks.blocking ? `${lot.checks.blocking} bloquant(s)` : 'aucune anomalie bloquante') : 'lot validé'],
  ])

  if (lot?.lines.length) {
    autoTable(doc, {
      startY: y, theme: 'striped', headStyles: { fillColor: GREEN, fontSize: 8.5 }, styles: { fontSize: 8, cellPadding: 1.3 },
      head: [['Producteur', 'Code', 'Village', 'Fiches de pesée', 'Sacs', 'Poids net']],
      body: lot.lines.map((l) => [t(l.producer_name), t(l.producer_code), t(l.village), t(l.receipt || '—'), String(l.bags), kg(l.weight_kg)]),
      margin: { left: MARGIN, right: MARGIN },
    })
    y = (doc as unknown as AutoTableDoc).lastAutoTable.finalY + 6
  }
  if (y > H - 70) { doc.addPage(); y = 20 }

  // Réception (remplie à l'arrivée)
  doc.setDrawColor(...GREEN); doc.rect(MARGIN, y, W - 2 * MARGIN, 24)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GREEN); doc.text("Réception à l'arrivée", MARGIN + 3, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40)
  const got = s.received_weight_kg != null
  doc.text(t(`Poids reçu : ${got ? kg(s.received_weight_kg) : '........................ kg'}`), MARGIN + 3, y + 13)
  doc.text(t(`Écart : ${s.weight_gap_kg != null ? `${s.weight_gap_kg > 0 ? '+' : ''}${fr(s.weight_gap_kg)} kg` : '................ kg'}`), MARGIN + 75, y + 13)
  doc.text(t(`Date : ${s.received_at ? new Date(s.received_at).toLocaleString('fr-FR') : '..../..../........'}`), MARGIN + 130, y + 13)
  doc.text(t(`Plombs intacts : oui / non    Reçu par : ${s.received_by || '..............................'}`), MARGIN + 3, y + 20)
  y += 32

  const third = (W - 2 * MARGIN) / 3
  ;['Expéditeur (coopérative)', 'Transporteur / chauffeur', 'Destinataire'].forEach((label, i) => {
    const x = MARGIN + i * third
    doc.setFontSize(9); doc.setTextColor(60, 60, 60); doc.text(label, x, y)
    doc.setDrawColor(180, 180, 180); doc.line(x, y + 16, x + third - 8, y + 16)
    doc.setFontSize(7.5); doc.text('Nom, date, signature et cachet', x, y + 20)
  })

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(t(`Fiche d'accompagnement ${s.number} · lot ${s.lot_code} · éditée le ${new Date().toLocaleString('fr-FR')} · GeoCollect EUDR · page ${i}/${n}`), MARGIN, H - 7)
  }
  doc.save(`fiche_accompagnement_${s.number}.pdf`)
}

/** Certificat de traçabilité d'un lot d'usinage ou de transformation : produits, bilan matière et toute la chaîne d'origine. */
export async function processingPdf(b: ProcessingBatch, tr: Trace) {
  const { jsPDF, autoTable, QR } = await libs()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const qrText = [`${OPERATION_LABEL[b.operation].toUpperCase()} ${b.code}`, `Usine: ${b.plant}`, `Date: ${date(b.process_date)}`,
    ...b.outputs.map((o) => `${o.product_label}: ${fr(o.weight_kg)} kg`), `Lots d'origine: ${tr.lots.map((l) => l.code).join(', ')}`,
    `Producteurs: ${tr.producers.length}`, `Parcelles: ${tr.eudr.parcels} (${fr(tr.eudr.area_ha, 2)} ha)`, 'GeoCollect EUDR'].join('\n')
  const qr = await QR.toDataURL(qrText, { margin: 0, width: 300, errorCorrectionLevel: 'M' })

  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('CERTIFICAT DE TRAÇABILITÉ', MARGIN, 13)
  doc.setFontSize(11); doc.setTextColor(...GOLD); doc.text(t(`${OPERATION_LABEL[b.operation]} ${b.code}`), MARGIN, 20)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(t(`${b.plant} · ${date(b.process_date)} · coopérative(s) : ${b.cooperatives.join(', ')}`), MARGIN, 26)
  doc.setFillColor(255, 255, 255); doc.rect(W - 40, 3, 26, 26, 'F'); doc.addImage(qr, 'PNG', W - 39, 4, 24, 24)

  const table = (startY: number, head: string[], body: string[][], foot?: string[]) => {
    autoTable(doc, { startY, theme: 'striped', headStyles: { fillColor: GREEN, fontSize: 8.5 }, styles: { fontSize: 8, cellPadding: 1.4 },
      head: [head], body, foot: foot ? [foot] : undefined, footStyles: { fillColor: [241, 246, 242], textColor: GREEN, fontStyle: 'bold' },
      margin: { left: MARGIN, right: MARGIN } })
    return (doc as unknown as AutoTableDoc).lastAutoTable.finalY + 5
  }
  const section = (y: number, title: string) => {
    if (y > H - 40) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...GREEN); doc.text(t(title), MARGIN, y); return y + 3
  }
  let y = section(38, '1. Produits obtenus et bilan matière')
  y = table(y, ['Produit', 'Référence', 'Poids'], b.outputs.map((o) => [t(o.product_label), t(o.reference || '—'), kg(o.weight_kg)]),
    ['Total', `entrées ${fr(b.input_kg)} kg`, `${fr(b.output_kg)} kg (perte ${fr(b.loss_kg)} kg, ${fr(b.loss_pct)} %)`])
  y = section(y, '2. Chaîne de traitement (du produit vers l\'origine)')
  y = table(y, ['Étape', 'Référence', 'Lieu', 'Date'], [
    ...tr.batches.map((x) => [OPERATION_LABEL[x.operation], t(x.code), t(x.plant), date(x.process_date)]),
    ...tr.transport.map((s) => ['Transport', t(`${s.number} (lot ${s.lot__code})`), t(`${s.vehicle_plate} -> ${s.destination}`),
      t(`${date(s.issued_at)}${s.received_weight_kg != null ? ` · reçu ${fr(s.received_weight_kg)} kg` : ''}`)]),
    ...tr.lots.map((l) => ['Lot de coopérative', t(l.code), t(l.cooperative), date(l.lot_date)]),
  ])
  y = section(y, `3. Producteurs d'origine (${tr.producers.length})`)
  y = table(y, ['Producteur', 'Code', 'Village', 'Lots', 'Poids livré'],
    tr.producers.map((p) => [t(p.name), t(p.code), t(p.village), t(p.lots.join(', ')), kg(p.weight_kg)]))
  y = section(y, `4. Parcelles d'origine : ${tr.eudr.parcels} (${fr(tr.eudr.area_ha, 2)} ha) — ${tr.eudr.compliant_parcels} conforme(s), ${tr.eudr.non_compliant_parcels} non conforme(s)`)
  y = table(y, ['Parcelle', 'Village', 'Surface (ha)', 'Statut EUDR'], tr.parcels.map((p) => [t(p.field_id), t(p.village), fr(p.area_hectares || 0, 2),
    p.eudr_status === 'compliant' ? 'Conforme' : p.eudr_status === 'non_compliant' ? 'Non conforme' : 'En attente']))
  y = section(y, `5. Fiches de pesée (${tr.deliveries.length})`)
  table(y, ['N° de fiche', 'Date', 'Producteur', 'Lot', 'Poids net'],
    tr.deliveries.map((d) => [t(d.number), date(d.date), t(d.producer_code), t(d.lot), kg(d.net_kg)]))

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(t(`Certificat de traçabilité ${b.code} · édité le ${new Date().toLocaleString('fr-FR')} · GeoCollect EUDR · page ${i}/${n}`), MARGIN, H - 7)
  }
  doc.save(`tracabilite_${b.code}.pdf`)
}

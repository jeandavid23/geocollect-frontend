import type { Producer, Parcel } from '../types'

// Generate FIELD ID base: SECTION + zero-padded index
// e.g. BEOUMI000245
export function generateFieldIdBase(section: string, index: number): string {
  const sectionCode = section.toUpperCase().replace(/\s+/g, '').slice(0, 10)
  const padded = String(index).padStart(6, '0')
  return `${sectionCode}${padded}`
}

// Generate parcel FIELD ID: base + -M + parcel number
// e.g. BEOUMI000245-M001
export function generateParcelFieldId(base: string, parcelIndex: number): string {
  const padded = String(parcelIndex).padStart(3, '0')
  return `${base}-M${padded}`
}

// Get next parcel number for a producer
export function getNextParcelIndex(parcels: Parcel[], producerId: string): number {
  const producerParcels = parcels.filter((p) => p.producerId === producerId)
  return producerParcels.length + 1
}

// Check if producer already exists by name + village
export function findExistingProducer(
  producers: Producer[],
  firstName: string,
  lastName: string,
  village: string
): Producer | undefined {
  return producers.find(
    (p) =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastName.toLowerCase() === lastName.toLowerCase() &&
      p.village.toLowerCase() === village.toLowerCase()
  )
}

// Get next producer index for a section
export function getNextProducerIndex(
  producers: Producer[],
  section: string
): number {
  const sectionProducers = producers.filter((p) => p.section === section)
  return sectionProducers.length + 1
}

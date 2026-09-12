/**
 * Seed for the "Camión Multiuso" checklist, version 1.
 *
 * Transcribed from `Check List Camión-multiuso_2026.xlsx` with two deliberate
 * corrections. Do NOT restore the originals:
 *
 *   1. Section 3 skipped 3.5 in the source (12 items labelled up to 3.13).
 *      Renumbered contiguously as 3.1 - 3.12.
 *   2. Typos fixed: "Soladura" -> "Soldadura", "Vávulas" -> "Válvulas",
 *      "buene estado" -> "buen estado".
 *
 * Item labels stay in Spanish: they are printed verbatim onto a legal document.
 *
 * 5 sections, 51 items (12 + 8 + 12 + 13 + 6).
 */
import type { Template, TemplateSection } from '../domain/template'

/**
 * Ids are deterministic UUIDs, not `item-1-1` strings.
 *
 * The device and the server must agree on these forever: an answer points at
 * an item by id, and a signed inspection has to reprint identically years from
 * now. `supabase/seed.sql` is generated from this file with the same functions,
 * and a test fails if the two ever disagree.
 */
export const TEMPLATE_UUID = '00000000-0000-4000-8000-000000000001'
export const sectionUuid = (position: number): string =>
  `00000000-0000-4000-8000-0000000001${String(position).padStart(2, '0')}`
export const itemUuid = (position: number, index: number): string =>
  `00000000-0000-4000-8000-0000${String(position).padStart(4, '0')}${String(index).padStart(4, '0')}`

const section = (position: number, title: string, labels: string[]): TemplateSection => ({
  id: sectionUuid(position),
  position,
  code: String(position),
  title,
  items: labels.map((label, index) => ({
    id: itemUuid(position, index + 1),
    position: index + 1,
    code: `${position}.${index + 1}`,
    label,
  })),
})

export const CAMION_MULTIUSO_V1: Template = {
  id: TEMPLATE_UUID,
  name: 'Lista de Chequeo Camión Multiuso',
  version: 1,
  effectiveFrom: '2026-01-01',
  isActive: 1,
  sections: [
    section(1, 'Inspección exterior del camión', [
      'Neumáticos del. y tras. en buen estado',
      'Tuercas de ruedas correctamente instaladas',
      'Luces delanteras y traseras operativas',
      'Luces de freno y de señalización operativas',
      'Luces de emergencia operativas',
      'Espejos retrovisores laterales en buen estado',
      'Parabrisas y vidrios sin daños',
      'Limpiaparabrisas operativo',
      'Bocina / Claxon operativo',
      'Cinturones de seguridad en buen estado',
      'Chasis y carrocería sin daños estructurales',
      'Placa patente delantera y trasera legibles',
    ]),

    section(2, 'Estado cisterna / estanque', [
      'Estanque / Cisterna sin daños visibles',
      'Soldadura y uniones sin grietas visibles',
      'Tapas y registros correctamente asegurados',
      'Juntas y empaquetaduras en buen estado',
      'Válvulas sin fugas',
      'Mangueras y conexiones aseguradas',
      'Indicadores de nivel operativos',
      'Sistema de rebalse / protección en condiciones',
    ]),

    section(3, 'Sistema de succión / vacío', [
      'Bomba de vacío en buen estado',
      'Bomba sin ruidos o vibraciones anormales',
      'Correas, acoplamientos y protecciones en buen estado',
      'Mangueras de succión en buen estado',
      'Acoples y conexiones de succión en buen estado',
      'Abrazaderas y elementos de fijación instalados',
      'Válvulas de succión operativas',
      'Filtro / protección de bomba operativa',
      'Indicador / manómetro de vacío operativo',
      'Sistema de corte / protección sobrellenado operativo',
      'Sistema de descarga operativo',
      'No existen fugas en el circuito de vacío',
    ]),

    section(4, 'Sistema de hidrojet / alta presión', [
      'Bomba de alta presión en buen estado',
      'Nivel de aceite de la bomba adecuado',
      'Manguera de alta presión sin daños, operativa',
      'Manguera correctamente almacenada',
      'Conexiones y acoples de alta presión en buen estado',
      'Pistola de alta presión en buen estado',
      'Dispositivo de accionamiento en buen estado',
      'Boquillas adecuadas para trabajo en buen estado',
      'Manómetro de presión operativo',
      'Válvula de alivio / seguridad operativa',
      'Válvulas de control operativas',
      'Sistema de descarga / recirculación operativo',
      'No existen fugas de agua a alta presión',
    ]),

    section(5, 'Sistemas de seguridad', [
      'Extintor disponible, vigente e instalado',
      'Botiquín disponible y equipado',
      'Cuñas para ruedas disponibles',
      'Conos de seguridad disponibles',
      'Baliza / luz de emergencia operativa',
      'Alarma de retroceso operativa',
    ]),
  ],
}

/**
 * The printed document, laid out to match `Check List Camión-multiuso_2026.xlsx`.
 *
 * Prevención compares this against the paper form, so the structure follows the
 * source: header grid, ÍTEM / CUMPLE / OBSERVACIONES / RESPONSABLE / FECHA
 * columns, the failure-code legend, general observations, and the two
 * signature blocks.
 *
 * Fonts: built-in Helvetica only. Registering a web font would make the PDF
 * need the network, and the whole point is that it is produced in the field.
 */
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { AnswerValue } from '../../domain/inspection'
import type { InspectionDocument } from '../../application/inspection-document'

/**
 * Turn off hyphenation.
 *
 * react-pdf's default hyphenation rules are English and mangle Spanish:
 * "instal-adas", "op-erativa", "es-tado". Prevención reads this document next
 * to the paper form, so broken words read as a sloppy copy. Returning the word
 * whole makes it wrap at spaces instead.
 */
Font.registerHyphenationCallback((word) => [word])

const BORDER = '#000000'
const MUTED = '#f2f2f2'

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 7.5, fontFamily: 'Helvetica', color: '#000' },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 8 },

  metaGrid: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  metaCol: { flex: 1 },
  metaRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: BORDER },
  metaLabel: {
    width: 78,
    padding: 3,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: MUTED,
    borderRightWidth: 0.5,
    borderColor: BORDER,
  },
  metaValue: { flex: 1, padding: 3 },

  head: { flexDirection: 'row', borderWidth: 0.5, borderColor: BORDER, backgroundColor: MUTED },
  headCell: {
    padding: 3,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderColor: BORDER,
  },

  sectionRow: {
    flexDirection: 'row',
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: '#d9d9d9',
  },
  sectionTitle: { padding: 3, fontFamily: 'Helvetica-Bold' },

  row: {
    flexDirection: 'row',
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
  },
  cell: { padding: 3, borderRightWidth: 0.5, borderColor: BORDER },
  mark: { textAlign: 'center', fontFamily: 'Helvetica-Bold' },

  legend: { marginTop: 8, borderWidth: 0.5, borderColor: BORDER, padding: 4 },
  legendTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },

  obsBox: { marginTop: 8, borderWidth: 0.5, borderColor: BORDER, minHeight: 48, padding: 4 },

  signGrid: { flexDirection: 'row', marginTop: 10, gap: 10 },
  signBlock: { flex: 1, borderWidth: 0.5, borderColor: BORDER },
  signHead: {
    padding: 3,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: MUTED,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
  },
  signRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: BORDER },
  signLabel: {
    width: 46,
    padding: 3,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderColor: BORDER,
  },
  signValue: { flex: 1, padding: 3 },
  signImageBox: { height: 52, padding: 3, justifyContent: 'center' },
  signImage: { height: 44, objectFit: 'contain' },

  footer: { marginTop: 8, fontSize: 6.5, color: '#555', textAlign: 'center' },

  annexTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  annexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  annexCard: { width: '48%', borderWidth: 0.5, borderColor: BORDER, padding: 4, marginBottom: 8 },
  annexCaption: { fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  annexImage: { width: '100%', height: 190, objectFit: 'contain' },
})

// Column widths mirror the source spreadsheet's proportions.
const COL = { item: 168, si: 22, no: 22, na: 24, obs: 148, resp: 82, date: 52 }

const fmtDate = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
const fmtDay = (day: string | null) => {
  if (!day) return ''
  const [y, m, d] = day.split('-')
  return y && m && d ? `${d}/${m}/${y}` : day
}

const Meta = ({ label, value }: { label: string; value: string }) => (
  <View style={s.metaRow}>
    <Text style={s.metaLabel}>{label}</Text>
    <Text style={s.metaValue}>{value}</Text>
  </View>
)

const Mark = ({ value, expected }: { value: AnswerValue | null; expected: AnswerValue }) => (
  <Text>{value === expected ? 'X' : ''}</Text>
)

export interface EvidenceEntry {
  itemCode: string
  itemLabel: string
  src: string
}

interface Props {
  document: InspectionDocument
  declaredSignature: string | null
  approvedSignature: string | null
  evidence?: EvidenceEntry[]
}

export function InspectionPdf({
  document,
  declaredSignature,
  approvedSignature,
  evidence = [],
}: Props) {
  const { vehicle, tally } = document

  return (
    <Document title={`${document.title} — ${vehicle.plate}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>LISTA DE CHEQUEO CAMIÓN MULTIUSO</Text>

        <View style={s.metaGrid}>
          <View style={s.metaCol}>
            <Meta label="TIPO VEHÍCULO:" value={vehicle.type ?? ''} />
            <Meta label="PATENTE:" value={vehicle.plate} />
            <Meta label="CONDUCTOR:" value={vehicle.driverName ?? ''} />
            <Meta label="KILOMETRAJE:" value={vehicle.odometerKm?.toLocaleString('es-CL') ?? ''} />
          </View>
          <View style={s.metaCol}>
            <Meta label="MARCA:" value={vehicle.brand ?? ''} />
            <Meta label="MODELO:" value={vehicle.model ?? ''} />
            <Meta label="AÑO:" value={vehicle.year ? String(vehicle.year) : ''} />
            <Meta label="FECHA REVISIÓN:" value={fmtDate(vehicle.inspectedAt)} />
          </View>
        </View>

        <View style={s.head} fixed>
          <Text style={[s.headCell, { width: COL.item }]}>ÍTEM</Text>
          <Text style={[s.headCell, { width: COL.si }]}>SI</Text>
          <Text style={[s.headCell, { width: COL.no }]}>NO</Text>
          <Text style={[s.headCell, { width: COL.na }]}>N/A</Text>
          <Text style={[s.headCell, { width: COL.obs }]}>OBSERVACIONES</Text>
          <Text style={[s.headCell, { width: COL.resp }]}>RESPONSABLE</Text>
          <Text style={[s.headCell, { width: COL.date, borderRightWidth: 0 }]}>FECHA</Text>
        </View>

        {document.sections.map((section) => (
          <View key={section.code} wrap={false}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>
                {section.code}.- {section.title.toUpperCase()}
              </Text>
            </View>

            {section.rows.map((row) => (
              <View key={row.code} style={s.row} wrap={false}>
                <View style={[s.cell, { width: COL.item, flexDirection: 'row' }]}>
                  <Text style={{ width: 22 }}>{row.code}</Text>
                  <Text style={{ flex: 1 }}>{row.label}</Text>
                </View>
                <View style={[s.cell, s.mark, { width: COL.si }]}>
                  <Mark value={row.value} expected="YES" />
                </View>
                <View style={[s.cell, s.mark, { width: COL.no }]}>
                  <Mark value={row.value} expected="NO" />
                </View>
                <View style={[s.cell, s.mark, { width: COL.na }]}>
                  <Mark value={row.value} expected="NA" />
                </View>
                <Text style={[s.cell, { width: COL.obs }]}>{row.observation ?? ''}</Text>
                <Text style={[s.cell, { width: COL.resp }]}>{row.responsible ?? ''}</Text>
                <Text style={[s.cell, { width: COL.date, borderRightWidth: 0 }]}>
                  {fmtDay(row.dueDate)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={s.legend}>
          <Text style={s.legendTitle}>CÓDIGO DE FALLAS</Text>
          <Text>
            (SI) Cumple sin Observaciones · (NO) No cumple o tiene observaciones · (N/A) No aplica al
            equipo/máquina/vehículo
          </Text>
          <Text style={{ marginTop: 3 }}>
            Resumen: {tally.yes} cumple · {tally.no} no cumple · {tally.na} no aplica ·{' '}
            {document.findingCount} {document.findingCount === 1 ? 'hallazgo' : 'hallazgos'}
          </Text>
        </View>

        <View style={s.obsBox}>
          <Text style={s.legendTitle}>OBSERVACIONES:</Text>
          <Text>{document.generalObservations ?? ''}</Text>
        </View>

        <View style={s.signGrid}>
          <View style={s.signBlock}>
            <Text style={s.signHead}>DECLARADO POR:</Text>
            <View style={s.signRow}>
              <Text style={s.signLabel}>NOMBRE</Text>
              <Text style={s.signValue}>{document.declaredBy?.name ?? ''}</Text>
              <Text style={s.signLabel}>FECHA</Text>
              <Text style={s.signValue}>{fmtDate(document.declaredBy?.date ?? null)}</Text>
            </View>
            <View style={s.signRow}>
              <Text style={s.signLabel}>CARGO</Text>
              <Text style={s.signValue}>{document.declaredBy?.role ?? ''}</Text>
            </View>
            <View style={s.signImageBox}>
              <Text style={{ fontSize: 6, color: '#666' }}>FIRMA</Text>
              {declaredSignature && <Image src={declaredSignature} style={s.signImage} />}
            </View>
          </View>

          <View style={s.signBlock}>
            <Text style={s.signHead}>APROBADO POR:</Text>
            <View style={s.signRow}>
              <Text style={s.signLabel}>NOMBRE</Text>
              <Text style={s.signValue}>{document.approvedBy?.name ?? ''}</Text>
              <Text style={s.signLabel}>FECHA</Text>
              <Text style={s.signValue}>{fmtDate(document.approvedBy?.date ?? null)}</Text>
            </View>
            <View style={s.signRow}>
              <Text style={s.signLabel}>CARGO</Text>
              <Text style={s.signValue}>{document.approvedBy?.role ?? ''}</Text>
            </View>
            <View style={s.signImageBox}>
              <Text style={{ fontSize: 6, color: '#666' }}>FIRMA</Text>
              {approvedSignature && <Image src={approvedSignature} style={s.signImage} />}
            </View>
          </View>
        </View>

        <Text style={s.footer} fixed>
          {document.title} · v{document.templateVersion} · {vehicle.plate} · Generado sin conexión
          en terreno
        </Text>
      </Page>

      {/*
        Evidence lives on its own pages so the form above stays faithful to the
        spreadsheet Prevención compares it against.
      */}
      {evidence.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.annexTitle}>
            ANEXO — EVIDENCIA FOTOGRÁFICA · {vehicle.plate} · {fmtDate(vehicle.inspectedAt)}
          </Text>

          <View style={s.annexGrid}>
            {evidence.map((entry, index) => (
              <View key={`${entry.itemCode}-${index}`} style={s.annexCard} wrap={false}>
                <Text style={s.annexCaption}>
                  {entry.itemCode} {entry.itemLabel}
                </Text>
                <Image src={entry.src} style={s.annexImage} />
              </View>
            ))}
          </View>

          <Text style={s.footer} fixed>
            {document.title} · v{document.templateVersion} · {vehicle.plate} · Anexo fotográfico
          </Text>
        </Page>
      )}
    </Document>
  )
}

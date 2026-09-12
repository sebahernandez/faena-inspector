import type { DocumentSignatures, PdfExporter } from '../../application/ports'
import type { InspectionDocument } from '../../application/inspection-document'

/**
 * react-pdf accepts images as data URLs. Blobs are read here rather than in the
 * component so the layout stays synchronous and testable.
 */
const toDataUrl = (blob: Blob | null): Promise<string | null> =>
  blob
    ? new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    : Promise.resolve(null)

export function createReactPdfExporter(): PdfExporter {
  return {
    async render(document: InspectionDocument, signatures: DocumentSignatures): Promise<Blob> {
      // Loaded on demand: the renderer is heavy and the checklist screens must
      // stay fast. The chunk is still precached, so this works offline.
      const [{ pdf }, { InspectionPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./InspectionPdf'),
      ])

      const [declared, approved] = await Promise.all([
        toDataUrl(signatures.declared),
        toDataUrl(signatures.approved),
      ])

      return pdf(
        InspectionPdf({ document, declaredSignature: declared, approvedSignature: approved }),
      ).toBlob()
    },
  }
}

/**
 * Hands the PDF to the phone.
 *
 * Share sheet first — that is how the file reaches WhatsApp or the supervisor's
 * email straight from the field. Falls back to a download when the browser
 * cannot share files (desktop, older Android).
 */
export async function sharePdf(blob: Blob, fileName: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: 'application/pdf' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'shared'
    } catch (error) {
      // The user dismissing the sheet is not a failure — do not fall through.
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

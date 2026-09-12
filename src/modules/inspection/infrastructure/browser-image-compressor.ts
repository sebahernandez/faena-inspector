import imageCompression from 'browser-image-compression'
import { IMAGE_QUALITY, MAX_IMAGE_DIMENSION } from '../domain/evidence'
import type { ImageCompressor } from '../application/ports'

/**
 * Shrinks a camera photo before it is ever stored.
 *
 * A modern phone camera produces 4–8 MB per shot. Three of those on each of a
 * handful of findings is enough to push the browser into evicting data — and
 * what it evicts is a signed inspection. Compression here is not about speed,
 * it is about not destroying the document.
 */
export function createBrowserImageCompressor(): ImageCompressor {
  return {
    async compress(file) {
      const asFile =
        file instanceof File ? file : new File([file], 'evidence.jpg', { type: file.type || 'image/jpeg' })

      return imageCompression(asFile, {
        maxWidthOrHeight: MAX_IMAGE_DIMENSION,
        initialQuality: IMAGE_QUALITY,
        useWebWorker: true,
        fileType: 'image/jpeg',
        // Strips EXIF, which also removes the GPS coordinates a phone stamps
        // into every photo. Nobody asked for the crew's location history.
        preserveExif: false,
      })
    },
  }
}

import { useEffect, useRef, useState } from 'react'
import SignaturePadLib from 'signature_pad'

interface Props {
  onChange: (isEmpty: boolean) => void
  /** Registered by the parent so it can pull the PNG at submit time. */
  onReady: (api: { toBlob: () => Promise<Blob | null>; clear: () => void }) => void
}

export function SignaturePad({ onChange, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // A canvas drawn at CSS size on a high-DPI phone produces a blurry,
    // jagged signature. Scale the backing store to the device pixel ratio.
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      padRef.current?.clear()
    }

    const pad = new SignaturePadLib(canvas, { backgroundColor: 'rgba(255,255,255,0)' })
    padRef.current = pad
    resize()

    const handleEnd = () => {
      const isEmpty = pad.isEmpty()
      setEmpty(isEmpty)
      onChange(isEmpty)
    }
    pad.addEventListener('endStroke', handleEnd)
    window.addEventListener('resize', resize)

    onReady({
      toBlob: () =>
        new Promise((resolve) => {
          if (pad.isEmpty()) return resolve(null)
          canvas.toBlob((blob) => resolve(blob), 'image/png')
        }),
      clear: () => {
        pad.clear()
        setEmpty(true)
        onChange(true)
      },
    })

    return () => {
      pad.removeEventListener('endStroke', handleEnd)
      window.removeEventListener('resize', resize)
      pad.off()
    }
  }, [onChange, onReady])

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={canvasRef} className="h-48 w-full touch-none" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Firme aquí con el dedo
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => padRef.current && (padRef.current.clear(), setEmpty(true), onChange(true))}
        className="text-sm text-slate-500 underline"
      >
        Borrar firma
      </button>
    </div>
  )
}

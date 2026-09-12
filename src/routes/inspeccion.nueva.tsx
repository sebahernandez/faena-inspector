import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { actions, queries } from '@/app/container'

export const Route = createFileRoute('/inspeccion/nueva')({ component: NewInspection })

const formSchema = z.object({
  plate: z.string().trim().min(4, 'Ingresa la patente'),
  driverName: z.string().trim(),
  odometerKm: z.string().trim(),
  brand: z.string().trim(),
  model: z.string().trim(),
  year: z.string().trim(),
})

type FormValues = z.infer<typeof formSchema>

const orNull = (value: string) => (value === '' ? null : value)
const numberOrNull = (value: string) => (value === '' ? null : Number(value))

function NewInspection() {
  const navigate = useNavigate()
  const template = useLiveQuery(queries.activeTemplate, [], null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { plate: '', driverName: '', odometerKm: '', brand: '', model: '', year: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!template) return
    const created = await actions.startInspection({
      templateId: template.id,
      templateVersion: template.version,
      plate: values.plate,
      vehicleType: 'Camión multiuso',
      driverName: orNull(values.driverName),
      odometerKm: numberOrNull(values.odometerKm),
      brand: orNull(values.brand),
      model: orNull(values.model),
      year: numberOrNull(values.year),
    })
    await navigate({ to: '/inspeccion/$id', params: { id: created.id } })
  })

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <h1 className="text-xl font-semibold">Datos del vehículo</h1>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Patente</span>
        <input
          {...register('plate')}
          className={`${field} uppercase`}
          autoCapitalize="characters"
          placeholder="ABCD12"
        />
        {errors.plate && <span className="mt-1 block text-sm text-red-600">{errors.plate.message}</span>}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Conductor</span>
        <input {...register('driverName')} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Kilometraje</span>
        <input {...register('odometerKm')} className={field} inputMode="numeric" />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Marca</span>
          <input {...register('brand')} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Modelo</span>
          <input {...register('model')} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Año</span>
          <input {...register('year')} className={field} inputMode="numeric" />
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !template}
        className="min-h-12 w-full rounded-lg bg-slate-900 font-semibold text-white disabled:opacity-50"
      >
        Comenzar inspección
      </button>
    </form>
  )
}

/**
 * Use-case tests run against an in-memory fake repository.
 *
 * No browser, no database, no network — this is the payoff of keeping the
 * domain and application layers free of infrastructure.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { Answer, Inspection } from '../../domain/inspection'
import type { Clock, DeclaredBy, IdGenerator, InspectionRepository } from '../ports'
import { startInspection } from './start-inspection'
import { answerItem, InspectionNotEditableError, InspectionNotFoundError } from './answer-item'
import { IncompleteInspectionError, submitInspection } from './submit-inspection'
import { updateHeader } from './update-header'
import { discardDraft } from './discard-draft'

class FakeRepository implements InspectionRepository {
  inspections = new Map<string, Inspection>()
  answers = new Map<string, Answer>()
  submitted: { id: string; declaredBy: DeclaredBy }[] = []

  async create(inspection: Inspection) {
    this.inspections.set(inspection.id, inspection)
  }
  async find(id: string) {
    return this.inspections.get(id) ?? null
  }
  async update(id: string, patch: Partial<Inspection>) {
    const current = this.inspections.get(id)
    if (current) this.inspections.set(id, { ...current, ...patch })
  }
  async putAnswer(a: Answer) {
    this.answers.set(`${a.inspectionId}:${a.itemId}`, a)
  }
  async listAnswers(inspectionId: string) {
    return [...this.answers.values()].filter((a) => a.inspectionId === inspectionId)
  }
  async submit(id: string, _signature: Blob, declaredBy: DeclaredBy) {
    this.submitted.push({ id, declaredBy })
    await this.update(id, { status: 'submitted', syncState: 'queued' })
  }
  async discard(id: string) {
    this.inspections.delete(id)
    for (const key of [...this.answers.keys()]) {
      if (key.startsWith(`${id}:`)) this.answers.delete(key)
    }
  }
}

const clock: Clock = { now: () => new Date('2026-03-01T12:00:00.000Z') }

let seq = 0
const ids: IdGenerator = { next: () => `id-${++seq}` }

let repository: FakeRepository

beforeEach(() => {
  repository = new FakeRepository()
  seq = 0
})

describe('startInspection', () => {
  it('creates a local draft that has not left the device', async () => {
    const created = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: 'abcd12' },
      { repository, clock, ids },
    )

    expect(created.status).toBe('draft')
    expect(created.syncState).toBe('local')
    expect(await repository.find(created.id)).not.toBeNull()
  })

  it('normalises the plate', async () => {
    const created = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: '  abcd12 ' },
      { repository, clock, ids },
    )
    expect(created.plate).toBe('ABCD12')
  })

  it('freezes the template version so the document reprints identically', async () => {
    const created = await startInspection(
      { templateId: 'tpl', templateVersion: 7, plate: 'AB1234' },
      { repository, clock, ids },
    )
    expect(created.templateVersion).toBe(7)
  })
})

describe('answerItem', () => {
  const start = () =>
    startInspection({ templateId: 'tpl', templateVersion: 1, plate: 'AB1234' }, { repository, clock, ids })

  it('records a YES', async () => {
    const { id } = await start()
    const saved = await answerItem({ inspectionId: id, itemId: 'item-1-1', value: 'YES' }, { repository, clock })
    expect(saved.value).toBe('YES')
  })

  it('keeps responsible and due date on a NO — a NO is a task', async () => {
    const { id } = await start()
    const saved = await answerItem(
      {
        inspectionId: id,
        itemId: 'item-1-1',
        value: 'NO',
        observation: 'Neumático liso',
        responsible: 'J. Pérez',
        dueDate: '2026-03-15',
      },
      { repository, clock },
    )

    expect(saved.responsible).toBe('J. Pérez')
    expect(saved.dueDate).toBe('2026-03-15')
  })

  it('clears responsible and due date when the answer is not a NO', async () => {
    const { id } = await start()
    const saved = await answerItem(
      { inspectionId: id, itemId: 'item-1-1', value: 'YES', responsible: 'J. Pérez', dueDate: '2026-03-15' },
      { repository, clock },
    )

    expect(saved.responsible).toBeNull()
    expect(saved.dueDate).toBeNull()
  })

  it('refuses an unknown inspection', async () => {
    await expect(
      answerItem({ inspectionId: 'nope', itemId: 'item-1-1', value: 'YES' }, { repository, clock }),
    ).rejects.toBeInstanceOf(InspectionNotFoundError)
  })

  it('refuses to edit a submitted inspection', async () => {
    const { id } = await start()
    await repository.update(id, { status: 'submitted' })

    await expect(
      answerItem({ inspectionId: id, itemId: 'item-1-1', value: 'YES' }, { repository, clock }),
    ).rejects.toBeInstanceOf(InspectionNotEditableError)
  })
})

describe('submitInspection', () => {
  const signature = new Blob(['png'], { type: 'image/png' })
  const declaredBy: DeclaredBy = { name: 'J. Pérez', role: 'Operador' }

  it('refuses an incomplete inspection', async () => {
    const { id } = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: 'AB1234' },
      { repository, clock, ids },
    )
    await answerItem({ inspectionId: id, itemId: 'item-1-1', value: 'YES' }, { repository, clock })

    await expect(
      submitInspection({ inspectionId: id, signature, declaredBy, totalItems: 51 }, { repository, clock }),
    ).rejects.toBeInstanceOf(IncompleteInspectionError)
  })

  it('submits a complete inspection without touching the network', async () => {
    const { id } = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: 'AB1234' },
      { repository, clock, ids },
    )
    await answerItem({ inspectionId: id, itemId: 'a', value: 'YES' }, { repository, clock })
    await answerItem({ inspectionId: id, itemId: 'b', value: 'NA' }, { repository, clock })

    await submitInspection({ inspectionId: id, signature, declaredBy, totalItems: 2 }, { repository, clock })

    expect(repository.submitted).toEqual([{ id, declaredBy }])
    expect((await repository.find(id))?.status).toBe('submitted')
  })

  it('refuses to submit twice', async () => {
    const { id } = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: 'AB1234' },
      { repository, clock, ids },
    )
    await answerItem({ inspectionId: id, itemId: 'a', value: 'YES' }, { repository, clock })
    await submitInspection({ inspectionId: id, signature, declaredBy, totalItems: 1 }, { repository, clock })

    await expect(
      submitInspection({ inspectionId: id, signature, declaredBy, totalItems: 1 }, { repository, clock }),
    ).rejects.toBeInstanceOf(InspectionNotEditableError)
  })
})

describe('updateHeader', () => {
  const start = () =>
    startInspection({ templateId: 'tpl', templateVersion: 1, plate: 'AB1234' }, { repository, clock, ids })

  it('normalises the plate on edit', async () => {
    const { id } = await start()
    await updateHeader(id, { plate: ' xyz789 ' }, { repository, clock })
    expect((await repository.find(id))?.plate).toBe('XYZ789')
  })

  it('stores general observations', async () => {
    const { id } = await start()
    await updateHeader(id, { generalObservations: 'Revisar en taller' }, { repository, clock })
    expect((await repository.find(id))?.generalObservations).toBe('Revisar en taller')
  })

  it('refuses to edit a submitted inspection', async () => {
    const { id } = await start()
    await repository.update(id, { status: 'submitted' })
    await expect(updateHeader(id, { driverName: 'Otro' }, { repository, clock })).rejects.toBeInstanceOf(
      InspectionNotEditableError,
    )
  })
})

describe('discardDraft', () => {
  it('removes the draft and its answers', async () => {
    const { id } = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: 'AB1234' },
      { repository, clock, ids },
    )
    await answerItem({ inspectionId: id, itemId: 'a', value: 'YES' }, { repository, clock })

    await discardDraft(id, { repository })

    expect(await repository.find(id)).toBeNull()
    expect(await repository.listAnswers(id)).toEqual([])
  })

  it('never discards a submitted inspection — it is a legal document', async () => {
    const { id } = await startInspection(
      { templateId: 'tpl', templateVersion: 1, plate: 'AB1234' },
      { repository, clock, ids },
    )
    await repository.update(id, { status: 'submitted' })

    await expect(discardDraft(id, { repository })).rejects.toBeInstanceOf(InspectionNotEditableError)
    expect(await repository.find(id)).not.toBeNull()
  })
})

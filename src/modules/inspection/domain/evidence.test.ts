import { describe, expect, it } from 'vitest'
import {
  hasRoomForPhoto,
  MAX_PHOTOS_PER_FINDING,
  remainingSlots,
  storagePressure,
} from './evidence'

describe('photo cap', () => {
  it('allows up to the cap', () => {
    expect(hasRoomForPhoto(0)).toBe(true)
    expect(hasRoomForPhoto(MAX_PHOTOS_PER_FINDING - 1)).toBe(true)
  })

  it('refuses past the cap — a phone that hoards photos evicts signed documents', () => {
    expect(hasRoomForPhoto(MAX_PHOTOS_PER_FINDING)).toBe(false)
    expect(hasRoomForPhoto(MAX_PHOTOS_PER_FINDING + 5)).toBe(false)
  })

  it('reports the slots left', () => {
    expect(remainingSlots(0)).toBe(MAX_PHOTOS_PER_FINDING)
    expect(remainingSlots(MAX_PHOTOS_PER_FINDING)).toBe(0)
    expect(remainingSlots(99)).toBe(0)
  })
})

describe('storagePressure', () => {
  it('is fine with room to spare', () => {
    expect(storagePressure(10, 100)).toBe('ok')
    expect(storagePressure(69, 100)).toBe('ok')
  })

  it('warns well before the browser would start evicting', () => {
    expect(storagePressure(70, 100)).toBe('warning')
    expect(storagePressure(89, 100)).toBe('warning')
  })

  it('is critical while there is still room to act', () => {
    expect(storagePressure(90, 100)).toBe('critical')
    expect(storagePressure(100, 100)).toBe('critical')
  })

  it('stays quiet when the browser reports no quota at all', () => {
    expect(storagePressure(1000, 0)).toBe('ok')
  })
})

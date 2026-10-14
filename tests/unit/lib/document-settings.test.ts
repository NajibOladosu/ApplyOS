import { describe, expect, it } from 'vitest'
import {
  docSettingsToTwips,
  normalizeDocSettings,
} from '@/lib/editor/document-settings'

describe('document margin settings', () => {
  it('preserves valid editor margins independently', () => {
    expect(normalizeDocSettings({
      marginTopMm: 8,
      marginRightMm: 14,
      marginBottomMm: 22,
      marginLeftMm: 28,
    })).toEqual({
      marginTopMm: 8,
      marginRightMm: 14,
      marginBottomMm: 22,
      marginLeftMm: 28,
    })
  })

  it('uses safe defaults and clamps margins to the editor range', () => {
    expect(normalizeDocSettings({
      marginTopMm: -10,
      marginRightMm: Number.NaN,
      marginBottomMm: 100,
    })).toEqual({
      marginTopMm: 0,
      marginRightMm: 20,
      marginBottomMm: 50,
      marginLeftMm: 20,
    })
  })

  it('converts millimetres to DOCX twips', () => {
    expect(docSettingsToTwips({
      marginTopMm: 12,
      marginRightMm: 14,
      marginBottomMm: 20,
      marginLeftMm: 28,
    })).toEqual({
      top: 680,
      right: 794,
      bottom: 1134,
      left: 1587,
    })
  })
})

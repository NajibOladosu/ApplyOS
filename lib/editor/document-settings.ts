import {
  DEFAULT_DOC_SETTINGS,
  type DocSettings,
} from '@/modules/applications/components/editor/types'

const MIN_MARGIN_MM = 0
const MAX_MARGIN_MM = 50
const TWIPS_PER_MM = 1440 / 25.4

const normalizeMargin = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(MAX_MARGIN_MM, Math.max(MIN_MARGIN_MM, value))
}

export function normalizeDocSettings(
  settings?: Partial<DocSettings> | null,
): DocSettings {
  return {
    marginTopMm: normalizeMargin(
      settings?.marginTopMm,
      DEFAULT_DOC_SETTINGS.marginTopMm,
    ),
    marginRightMm: normalizeMargin(
      settings?.marginRightMm,
      DEFAULT_DOC_SETTINGS.marginRightMm,
    ),
    marginBottomMm: normalizeMargin(
      settings?.marginBottomMm,
      DEFAULT_DOC_SETTINGS.marginBottomMm,
    ),
    marginLeftMm: normalizeMargin(
      settings?.marginLeftMm,
      DEFAULT_DOC_SETTINGS.marginLeftMm,
    ),
  }
}

export function docSettingsToTwips(
  settings?: Partial<DocSettings> | null,
): { top: number; right: number; bottom: number; left: number } {
  const normalized = normalizeDocSettings(settings)
  return {
    top: Math.round(normalized.marginTopMm * TWIPS_PER_MM),
    right: Math.round(normalized.marginRightMm * TWIPS_PER_MM),
    bottom: Math.round(normalized.marginBottomMm * TWIPS_PER_MM),
    left: Math.round(normalized.marginLeftMm * TWIPS_PER_MM),
  }
}

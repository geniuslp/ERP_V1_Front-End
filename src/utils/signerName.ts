// Font size (pt) for a name printed in a signature box when there is no signature image: as large as fits the
// box width (about 85% of it), never smaller than minPt, never larger than maxPt. A rough character width of
// 0.5em keeps long Thai/Latin mixed names inside the box.
const PT_TO_MM = 25.4 / 72

export const signerNameFontPt = (name: string | null | undefined, boxMm: number, maxPt = 14, minPt = 9): number => {
  const len = Math.max(1, (name ?? '').length)
  const fit = (boxMm * 0.85) / (len * 0.5 * PT_TO_MM)
  return Math.round(Math.min(maxPt, Math.max(minPt, fit)) * 10) / 10
}

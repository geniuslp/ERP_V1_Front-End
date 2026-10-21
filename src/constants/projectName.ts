// VO (งานเพิ่ม) projects must have a name that starts with this locked prefix.
export const VO_NAME_PREFIX = 'Q - '

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Matches a prefix the user typed/pasted themselves, tolerating spacing ("Q - ", "Q-", "Q -").
const VO_PREFIX_RE = new RegExp(
  `^${escapeRe(VO_NAME_PREFIX.replace(/\s*-\s*$/, ''))}\\s*-\\s*`,
)

/** Editable part of a project name: drops the exact stored prefix; a name without it is returned as-is. */
export const stripVoPrefix = (name: string): string =>
  name.startsWith(VO_NAME_PREFIX) ? name.slice(VO_NAME_PREFIX.length) : name

/** Prefix + typed text ('' when nothing is typed). Trims leading spaces and never doubles the prefix. */
export const buildVoName = (typed: string): string => {
  const t = typed.replace(/^\s+/, '').replace(VO_PREFIX_RE, '').replace(/^\s+/, '')
  return t ? VO_NAME_PREFIX + t : ''
}

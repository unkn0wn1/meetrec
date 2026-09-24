export function parseLibraryDeleteOptions(value: unknown): { removeCloud: boolean } {
  if (value == null) return { removeCloud: false }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Choose whether to remove cloud copies.')
  }
  const flag = (value as { removeCloud?: unknown }).removeCloud
  if (flag == null || flag === false) return { removeCloud: false }
  if (flag === true) return { removeCloud: true }
  throw new Error('Choose whether to remove cloud copies.')
}

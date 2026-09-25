const SLUG_MAX = 60

export function artifactName(input: {
  startedAt: string
  title: string | null
  id: string
  kind: 'audio' | 'transcript' | 'summary'
  audioExtension?: 'mp3' | 'wav'
}): string {
  const date = utcDate(input.startedAt)
  const slug = slugTitle(input.title)
  const short = shortId(input.id)
  const ext =
    input.kind === 'audio'
      ? (input.audioExtension ?? 'mp3')
      : input.kind === 'transcript'
        ? 'json'
        : 'md'
  return `${date}-${slug}-${short}-${input.kind}.${ext}`
}

export function slugTitle(title: string | null): string {
  const slug = (title ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  return slug || 'recording'
}

export function shortId(id: string): string {
  const suffix = id.split('-').at(-1) ?? ''
  const tail = suffix
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toLowerCase()
  return tail || 'rec'
}

function utcDate(startedAt: string): string {
  const parsed = Date.parse(startedAt)
  if (Number.isNaN(parsed)) return 'undated'
  return new Date(parsed).toISOString().slice(0, 10)
}

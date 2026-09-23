import { writeFile } from 'node:fs/promises'
import { recordingLayout } from '../recording/layout'
import type { RecordingMeta } from '../recording/meta'
import { writeMeta } from '../recording/store'

export async function saveSummary(input: {
  recordingsDir: string
  meta: RecordingMeta
  markdown: string
  topic: string | null
}): Promise<RecordingMeta> {
  const layout = recordingLayout(input.recordingsDir, input.meta.id)
  await writeFile(
    layout.summaryPath,
    input.markdown.endsWith('\n') ? input.markdown : `${input.markdown}\n`,
    'utf8'
  )
  const next: RecordingMeta = {
    ...input.meta,
    topic: input.topic
  }
  await writeMeta(input.recordingsDir, next)
  return next
}

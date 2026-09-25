export const QMD_COLLECTION = 'meetings'
export const QMD_WARMUP_QUERY = 'a'

export function helpLists(help: string, needle: string): boolean {
  return stripAnsi(help).includes(needle)
}

export function collectionListed(stdout: string, name: string): boolean {
  return stripAnsi(stdout)
    .split(/\r?\n/)
    .some((line) => {
      const plain = line.trim()
      return plain === name || plain.startsWith(`${name} `) || plain.includes(`qmd://${name}/`)
    })
}

export function qmdHelpArgs(): string[] {
  return ['--help']
}

export function qmdCollectionListArgs(): string[] {
  return ['collection', 'list']
}

export function qmdCollectionAddArgs(exportDir: string): string[] {
  return ['collection', 'add', exportDir, '--name', QMD_COLLECTION, '--mask', '**/*.md']
}

export function qmdCollectionRemoveArgs(): string[] {
  return ['collection', 'remove', QMD_COLLECTION]
}

export function qmdUpdateArgs(): string[] {
  return ['update']
}

export function qmdEmbedArgs(): string[] {
  return ['embed', '-c', QMD_COLLECTION]
}

export function qmdPullArgs(): string[] {
  return ['pull', '--progress']
}

export function qmdDoctorArgs(): string[] {
  return ['doctor']
}

export function qmdQueryArgs(text: string): string[] {
  return ['query', text, '--format', 'json', '-c', QMD_COLLECTION, '-n', '20']
}

export function qmdWarmupArgs(): string[] {
  return qmdQueryArgs(QMD_WARMUP_QUERY)
}

function stripAnsi(text: string): string {
  let plain = ''
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) !== 27) {
      plain += text[index] ?? ''
      continue
    }
    while (index < text.length && text[index] !== 'm') index += 1
  }
  return plain
}

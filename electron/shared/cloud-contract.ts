export interface CloudUploadResult {
  ok: boolean
  message: string
}

export interface CloudUploadInput {
  recordingId: string
  provider: 'google' | 'microsoft'
}

export interface CloudSetUploadInput {
  provider: 'google' | 'microsoft'
  enabled: boolean
}

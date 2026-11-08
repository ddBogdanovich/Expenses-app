import type { Preferences } from './settings-api'

export type SettingsFeedback = 'success' | 'error' | 'conflict' | 'uncertain' | null
export type SettingsDraft = { saved: Preferences; selected: string | null; input: string; pending: boolean; message: SettingsFeedback }

// App scopes this bounded in-memory store to its currently verified owner.
// It outlives temporary protected-page unmounts and never uses browser storage.
export class SettingsMemory {
  private draft: SettingsDraft | undefined
  read() { return this.draft }
  write(draft: SettingsDraft) { this.draft = draft }
  clear() { this.draft = undefined }
}

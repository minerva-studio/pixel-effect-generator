/** Unity export settings shared between ProjectMenu and ExportPanel. */
export interface UnityExportSettingsState {
  readonly pixelsPerUnit: number
  readonly stableGuid: string
}

/** Default Unity export settings; never affects generator pixel frames. */
export const DEFAULT_UNITY_EXPORT_SETTINGS: UnityExportSettingsState = {
  pixelsPerUnit: 32,
  stableGuid: '',
}

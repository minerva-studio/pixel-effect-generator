import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

interface NumberControlProps {
  readonly label: string
  readonly description: string
  readonly value: number
  readonly minimum: number
  readonly maximum: number
  readonly step?: number
  readonly scale?: number
  readonly unit?: string
  readonly onChange: (value: number) => void
}

interface SelectControlProps<Value extends string> {
  readonly label: string
  readonly description: string
  readonly value: Value
  readonly options: readonly { readonly value: Value; readonly label: string }[]
  readonly onChange: (value: Value) => void
}

/**
 * Renders one scaled numeric parameter with synchronized slider and number input.
 * The number input keeps an in-progress draft while typing and only clamps to
 * the configured range when the edit is committed (blur or Enter), so values
 * such as 180 can be typed freely even when the minimum is higher than a prefix.
 */
export function NumberControl({ label, description, value, minimum, maximum, step = 1, scale = 1, unit = '', onChange }: NumberControlProps) {
  const { t } = useI18n()
  const rangeId = useId()
  const hintId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const displayedValue = normalizeDisplayValue(value * scale, step * scale)
  const displayedMinimum = minimum * scale
  const displayedMaximum = maximum * scale
  const displayedStep = step * scale
  const updateDisplayedValue = (nextValue: number) => {
    const clamped = Number.isFinite(nextValue)
      ? Math.min(displayedMaximum, Math.max(displayedMinimum, nextValue))
      : value
    onChange(clamped / scale)
  }
  const commitDraft = (raw: string) => {
    setDraft(null)
    updateDisplayedValue(Number(raw))
  }

  useEffect(() => {
    setDraft(null)
  }, [value])

  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <label htmlFor={rangeId}>{label}</label>
          <InfoHint label={label} description={description} hintId={hintId} />
        </span>
      </div>
      <div className="field-inputs">
        <input
          id={rangeId}
          aria-label={t('controls.value', { label })}
          type="range"
          min={displayedMinimum}
          max={displayedMaximum}
          step={displayedStep}
          value={displayedValue}
          onChange={(event) => updateDisplayedValue(Number(event.target.value))}
        />
        <span className="number-field">
          <input
            aria-label={t('controls.value', { label })}
            type="number"
            min={displayedMinimum}
            max={displayedMaximum}
            step={displayedStep}
            value={draft ?? String(displayedValue)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commitDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraft(event.currentTarget.value)
              }
            }}
          />
          <small>{unit}</small>
        </span>
      </div>
    </div>
  )
}

/** Renders one compact mode dropdown with the same field layout as sliders. */
export function SelectControl<Value extends string>({ label, description, value, options, onChange }: SelectControlProps<Value>) {
  const { t } = useI18n()
  const selectId = useId()
  const hintId = useId()
  return (
    <div className="parameter-field">
      <div className="field-copy">
        <span className="field-title">
          <label htmlFor={selectId}>{label}</label>
          <InfoHint label={label} description={description} hintId={hintId} />
        </span>
      </div>
      <div className="select-field">
        <select
          id={selectId}
          aria-label={t('controls.value', { label })}
          value={value}
          onChange={(event) => onChange(event.target.value as Value)}
        >
          {options.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

/** Reveals compact field guidance on hover, focus, or touch focus. */
export function InfoHint({ label, description, hintId }: { readonly label: string; readonly description: string; readonly hintId: string }) {
  const { t } = useI18n()
  return (
    <span className="info-hint">
      <button type="button" aria-label={t('controls.about', { label })} aria-describedby={hintId}>i</button>
      <span className="info-tooltip" id={hintId} role="tooltip">{description}</span>
    </span>
  )
}

export function normalizeDisplayValue(value: number, step: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return Number(value.toFixed(decimals))
}

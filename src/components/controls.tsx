import { useId } from 'react'

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

/** Renders one scaled numeric parameter with synchronized slider and number input. */
export function NumberControl({ label, description, value, minimum, maximum, step = 1, scale = 1, unit = '', onChange }: NumberControlProps) {
  const rangeId = useId()
  const hintId = useId()
  const displayedValue = normalizeDisplayValue(value * scale, step * scale)
  const displayedMinimum = minimum * scale
  const displayedMaximum = maximum * scale
  const displayedStep = step * scale
  const updateDisplayedValue = (nextValue: number) => {
    const clamped = Math.min(displayedMaximum, Math.max(displayedMinimum, nextValue))
    onChange(clamped / scale)
  }

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
          aria-label={label}
          type="range"
          min={displayedMinimum}
          max={displayedMaximum}
          step={displayedStep}
          value={displayedValue}
          onChange={(event) => updateDisplayedValue(Number(event.target.value))}
        />
        <span className="number-field">
          <input
            aria-label={`${label} value`}
            type="number"
            min={displayedMinimum}
            max={displayedMaximum}
            step={displayedStep}
            value={displayedValue}
            onChange={(event) => updateDisplayedValue(Number(event.target.value))}
          />
          <small>{unit}</small>
        </span>
      </div>
    </div>
  )
}

/** Renders one compact mode dropdown with the same field layout as sliders. */
export function SelectControl<Value extends string>({ label, description, value, options, onChange }: SelectControlProps<Value>) {
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
          aria-label={label}
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
  return (
    <span className="info-hint">
      <button type="button" aria-label={`About ${label}`} aria-describedby={hintId}>i</button>
      <span className="info-tooltip" id={hintId} role="tooltip">{description}</span>
    </span>
  )
}

export function normalizeDisplayValue(value: number, step: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return Number(value.toFixed(decimals))
}

import React from 'react'
import {
  lockQuantityInput,
  RESOURCE_QUANTITY_STEP,
} from '../lib/resourceQuantity'

interface ResourceQuantityInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'step'> {
  value: string
  onValueChange: (value: string) => void
}

/** SCU quantity field locked to max 3 decimal places — no float rounding surprises. */
export default function ResourceQuantityInput({
  value,
  onValueChange,
  className,
  min,
  ...rest
}: ResourceQuantityInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      min={min}
      value={value}
      onChange={(e) => onValueChange(lockQuantityInput(e.target.value))}
      className={className}
      data-step={RESOURCE_QUANTITY_STEP}
    />
  )
}

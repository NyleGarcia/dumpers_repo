import React from 'react'
import { isWholeUnitResource } from '../config/resourceTypes'
import {
  GEM_QUANTITY_STEP,
  lockGemQuantityInput,
  lockQuantityInput,
  RESOURCE_QUANTITY_STEP,
} from '../lib/resourceQuantity'

interface ResourceQuantityInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'step' | 'inputMode'> {
  value: string
  onValueChange: (value: string) => void
  resourceKey?: string
}

/** Quantity field — 3-decimal SCU for ores/salvage, whole integers for gems/harvest. */
export default function ResourceQuantityInput({
  value,
  onValueChange,
  resourceKey,
  className,
  min,
  ...rest
}: ResourceQuantityInputProps) {
  const wholeUnit = resourceKey ? isWholeUnitResource(resourceKey) : false
  const step = wholeUnit ? GEM_QUANTITY_STEP : RESOURCE_QUANTITY_STEP

  return (
    <input
      {...rest}
      type="text"
      inputMode={wholeUnit ? 'numeric' : 'decimal'}
      autoComplete="off"
      min={wholeUnit ? (min ?? 1) : min}
      value={value}
      onChange={(e) =>
        onValueChange(wholeUnit ? lockGemQuantityInput(e.target.value) : lockQuantityInput(e.target.value))
      }
      className={className}
      data-step={step}
    />
  )
}

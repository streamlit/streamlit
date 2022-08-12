import React from "react"
import { LabelVisibilityOptions } from "src/lib/utils"
import { StyledWidgetLabel } from "./styled-components"

export interface LabelProps {
  // Label body text. If nullsy, WidgetLabel won't show. But if empty string it will.
  label?: string | null

  // Used to specify other elements that should go inside the label container, like a help icon.
  children?: React.ReactNode

  // Used to specify whether widget disabled or enabled.
  disabled?: boolean | null

  // Used to specify whether widget is visible or not.
  labelVisibility?: LabelVisibilityOptions
}

export function WidgetLabel({
  label,
  children,
  disabled,
  labelVisibility,
}: LabelProps): React.ReactElement {
  if (label == null) {
    return <></>
  }

  return (
    // we use aria-hidden to disable ARIA for StyleWidgetLabel, because each
    // widget should have its own aria-label and/or implement accessibility.
    <StyledWidgetLabel
      aria-hidden="true"
      disabled={disabled}
      labelVisibility={labelVisibility}
    >
      {label}
      {children}
    </StyledWidgetLabel>
  )
}

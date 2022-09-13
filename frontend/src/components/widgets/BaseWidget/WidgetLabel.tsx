/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

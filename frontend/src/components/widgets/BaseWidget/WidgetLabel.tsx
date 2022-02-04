/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { StyledWidgetLabel } from "./styled-components"

export interface LabelProps {
  // Label body text. If nullsy, WidgetLabel won't show. But if empty string it will.
  label?: string | null

  // Used to specify other elements that should go inside the label container, like a help icon.
  children?: React.ReactNode

  // Used to specify whether widget disabled or enabled.
  disabled?: boolean | null
}

export function WidgetLabel({
  label,
  children,
  disabled,
}: LabelProps): React.ReactElement {
  if (label == null) {
    return <></>
  }

  return (
    <StyledWidgetLabel disabled={disabled}>
      {label}
      {children}
    </StyledWidgetLabel>
  )
}

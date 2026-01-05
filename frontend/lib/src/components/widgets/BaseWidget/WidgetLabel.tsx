/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { isNullOrUndefined, LabelVisibilityOptions } from "~lib/util/utils"

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

  // Associates the label with the input field programmatically. Makes it possible to focus input by clicking on label.
  htmlFor?: string
}

export function WidgetLabel({
  label,
  children,
  disabled,
  labelVisibility,
  htmlFor,
}: LabelProps): React.ReactElement {
  if (isNullOrUndefined(label)) {
    return <></>
  }

  return (
    <StyledWidgetLabel
      data-testid="stWidgetLabel"
      disabled={disabled}
      labelVisibility={labelVisibility}
      htmlFor={htmlFor}
    >
      {/* Accessibility contract:
          Widget inputs must expose their own accessible name (e.g. via aria-label
          and/or aria-labelledby). We hide the visual label text from assistive tech
          to avoid duplicate announcements, while keeping any children (e.g. help
          icons) accessible. */}
      <span aria-hidden="true">
        <StreamlitMarkdown source={label} allowHTML={false} isLabel />
      </span>
      {children}
    </StyledWidgetLabel>
  )
}

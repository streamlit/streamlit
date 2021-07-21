/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

export {
  StyledWidgetInstructions,
  StyledWidgetLabel,
  StyledWidgetLabelHelp,
  StyledWidgetLabelHelpInline,
} from "./styled-components"

interface Props {
  visible: boolean
  children: React.ReactNode
}

export function WidgetLabel({ visible, children }: Props): React.ReactElement {
  if (!visible) {
    return <></>
  }

  return <StyledWidgetLabel>{children}</StyledWidgetLabel>
}

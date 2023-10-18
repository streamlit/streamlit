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

import React, { ReactElement } from "react"
import classNames from "classnames"
import { isPresetTheme } from "@streamlit/lib/src/theme"
import { Spinner as SpinnerProto } from "@streamlit/lib/src/proto"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"

import {
  StyledSpinner,
  StyledSpinnerContainer,
  ThemedStyledSpinner,
} from "./styled-components"

export interface SpinnerProps {
  width: number
  element: SpinnerProto
}

function Spinner({ width, element }: SpinnerProps): ReactElement {
  const { activeTheme } = React.useContext(LibContext)
  const usingCustomTheme = !isPresetTheme(activeTheme)
  const { cache } = element

  return (
    <StyledSpinner
      className={classNames({ stSpinner: true, cacheSpinner: cache })}
      data-testid="stSpinner"
      width={width}
      cache={cache}
    >
      <StyledSpinnerContainer>
        <ThemedStyledSpinner usingCustomTheme={usingCustomTheme} />
        <StreamlitMarkdown source={element.text} allowHTML={false} />
      </StyledSpinnerContainer>
    </StyledSpinner>
  )
}

export default Spinner

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
import { useTheme } from "@emotion/react"
import { EmotionTheme, isPresetTheme } from "src/theme"
import { Spinner as SpinnerProto } from "src/autogen/proto"
import StreamlitMarkdown from "src/lib/components/shared/StreamlitMarkdown"
import { AppContext } from "src/lib/components/core/AppContext"
import {
  StyledSpinnerContainer,
  ThemedStyledSpinner,
} from "./styled-components"

export interface SpinnerProps {
  width: number
  element: SpinnerProto
}

function Spinner({ width, element }: SpinnerProps): ReactElement {
  const theme: EmotionTheme = useTheme()
  const { activeTheme } = React.useContext(AppContext)
  const usingCustomTheme = !isPresetTheme(activeTheme)
  const styleProp = { width }

  return (
    <div className="stSpinner" style={styleProp}>
      <StyledSpinnerContainer>
        <ThemedStyledSpinner
          $size={theme.iconSizes.twoXL}
          $usingCustomTheme={usingCustomTheme}
        />
        <StreamlitMarkdown source={element.text} allowHTML={false} />
      </StyledSpinnerContainer>
    </div>
  )
}

export default Spinner

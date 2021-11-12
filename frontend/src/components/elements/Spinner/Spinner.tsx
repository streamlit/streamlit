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

import React, { ReactElement } from "react"
import { useTheme } from "emotion-theming"
import { Theme } from "src/theme"
import { Spinner as SpinnerProto } from "src/autogen/proto"
import { Spinner as UISpinner } from "baseui/spinner"
import AlertContainer, { Kind } from "src/components/shared/AlertContainer"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { StyledSpinnerContainer } from "./styled-components"

export interface SpinnerProps {
  width: number
  element: SpinnerProto
}

function Spinner({ width, element }: SpinnerProps): ReactElement {
  const theme: Theme = useTheme()

  return (
    <div className="stSpinner">
      <AlertContainer width={width} kind={Kind.INFO}>
        <StyledSpinnerContainer>
          <UISpinner
            size={theme.iconSizes.twoXL}
            overrides={{
              Svg: {
                style: ({ $theme }: { $theme: any }) => ({
                  marginTop: theme.spacing.none,
                  marginBottom: theme.spacing.none,
                  marginRight: theme.spacing.none,
                  marginLeft: theme.spacing.none,
                }),
              },
              ActivePath: {
                style: ({ $theme }: { $theme: any }) => ({
                  fill: theme.colors.blue,
                }),
              },
            }}
          />
          <StreamlitMarkdown source={element.text} allowHTML={false} />
        </StyledSpinnerContainer>
      </AlertContainer>
    </div>
  )
}

export default Spinner

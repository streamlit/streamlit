/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { memo, ReactElement } from "react"

import { Progress as ProgressProto } from "@streamlit/protobuf"

import ProgressBar from "~lib/components/shared/ProgressBar"
import { StyledProgressLabelContainer } from "~lib/components/elements/Progress/styled-components"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"

export interface ProgressProps {
  element: ProgressProto
}

function Progress({ element }: Readonly<ProgressProps>): ReactElement {
  return (
    <div className="stProgress" data-testid="stProgress">
      <StyledProgressLabelContainer>
        <StreamlitMarkdown source={element.text} allowHTML={false} isLabel />
      </StyledProgressLabelContainer>

      <ProgressBar value={element.value} />
    </div>
  )
}

export default memo(Progress)

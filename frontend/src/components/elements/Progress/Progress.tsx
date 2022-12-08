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
import { Progress as ProgressProto } from "src/autogen/proto"
import ProgressBar from "src/components/shared/ProgressBar"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { StyledTruncateText } from "./styled-components"

export interface ProgressProps {
  width: number
  element: ProgressProto
}

function Progress({ element, width }: ProgressProps): ReactElement {
  return (
    <div className="stProgress">
      <StyledTruncateText>
        <StreamlitMarkdown source={element.text} allowHTML={false} isLabel />
      </StyledTruncateText>

      <ProgressBar value={element.value} width={width} />
    </div>
  )
}

export default Progress

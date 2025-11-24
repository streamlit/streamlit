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

import CopyButton from "./CopyButton"
import {
  StyledCode,
  StyledCodeBlock,
  StyledCopyButtonContainer,
  StyledPre,
} from "./styled-components"

export interface StreamlitErrorCodeBlockProps {
  children: string | string[]
}

function StreamlitErrorCodeBlock({
  children,
}: Readonly<StreamlitErrorCodeBlockProps>): ReactElement {
  const shouldShowCopyButton =
    typeof children === "string" && children.trim().length > 0

  return (
    <StyledCodeBlock
      className="stErrorCodeBlock"
      data-testid="stErrorCodeBlock"
    >
      <StyledPre wrapLines={false}>
        <StyledCode wrapLines={false}>{children}</StyledCode>
      </StyledPre>
      {shouldShowCopyButton && (
        <StyledCopyButtonContainer>
          <CopyButton text={children} />
        </StyledCopyButtonContainer>
      )}
    </StyledCodeBlock>
  )
}

export default memo(StreamlitErrorCodeBlock)

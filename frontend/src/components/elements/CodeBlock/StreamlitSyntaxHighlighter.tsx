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

import { StyledPre } from "./styled-components"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import React, { ReactElement } from "react"

export interface StyledSyntaxHighlighterProps {
  children: string | string[]
  language: string
  showLineNumbers?: boolean | undefined
}

export const StreamlitSyntaxHighlighter = ({
  language,
  showLineNumbers,
  children,
}: StyledSyntaxHighlighterProps): ReactElement => {
  return (
    <StyledPre>
      <SyntaxHighlighter
        language={language}
        PreTag="div"
        customStyle={{ backgroundColor: "transparent" }}
        style={{}}
        lineNumberStyle={{}}
        showLineNumbers={showLineNumbers}
      >
        {children}
      </SyntaxHighlighter>
    </StyledPre>
  )
}

export default StreamlitSyntaxHighlighter

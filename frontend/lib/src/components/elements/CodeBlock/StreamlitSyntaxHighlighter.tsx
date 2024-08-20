/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"

import CopyButton from "./CopyButton"
import {
  StyledCodeBlock,
  StyledCopyButtonContainer,
  StyledPre,
} from "./styled-components"

export interface StreamlitSyntaxHighlighterProps {
  children: string | string[]
  language?: string
  showLineNumbers?: boolean
  wrapLines?: boolean | undefined
}

export default function StreamlitSyntaxHighlighter({
  language,
  showLineNumbers,
  wrapLines,
  children,
}: Readonly<StreamlitSyntaxHighlighterProps>): ReactElement {
  return (
    <StyledCodeBlock className="stCode" data-testid="stCode">
      <StyledPre>
        <SyntaxHighlighter
          language={language}
          PreTag="div"
          customStyle={{ backgroundColor: "transparent" }}
          // We set an empty style object here because we have our own CSS styling that
          // reacts on our theme.
          style={{}}
          lineNumberStyle={{}}
          showLineNumbers={showLineNumbers}
          wrapLongLines={wrapLines}
        >
          {children}
        </SyntaxHighlighter>
      </StyledPre>
      {typeof children === "string" && children.trim() !== "" && (
        <StyledCopyButtonContainer>
          <CopyButton text={children} />
        </StyledCopyButtonContainer>
      )}
    </StyledCodeBlock>
  )
}

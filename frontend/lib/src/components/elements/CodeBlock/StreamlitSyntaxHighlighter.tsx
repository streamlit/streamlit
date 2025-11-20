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

import React, { memo, ReactElement, useCallback, useMemo } from "react"

import {
  createElement,
  Prism as SyntaxHighlighter,
} from "react-syntax-highlighter"

import CopyButton from "./CopyButton"
import {
  StyledCodeBlock,
  StyledCopyButtonContainer,
  StyledPre,
} from "./styled-components"

export interface StreamlitSyntaxHighlighterProps {
  children?: string | string[]
  language?: string
  showLineNumbers?: boolean
  wrapLines?: boolean
  height?: number
}

function StreamlitSyntaxHighlighter({
  language,
  showLineNumbers,
  wrapLines,
  children,
}: Readonly<StreamlitSyntaxHighlighterProps>): ReactElement {
  const renderer = useCallback(
    ({ rows, stylesheet, useInlineStyles }: any): any =>
      rows.map((row: any, index: any): any => {
        const rowChildren = row.children

        if (rowChildren) {
          const lineNumberElement = rowChildren.shift()

          if (lineNumberElement) {
            row.children = [
              lineNumberElement,
              {
                children: rowChildren,
                properties: { className: [] },
                tagName: "span",
                type: "element",
              },
            ]
          }
        }

        return createElement({
          node: row,
          stylesheet,
          useInlineStyles,
          key: index,
        })
      }),
    []
  )

  const text = useMemo(() => {
    if (children == null) {
      return ""
    }

    let value: string

    if (Array.isArray(children)) {
      value = children.join("")
    } else if (typeof children === "string") {
      value = children
    } else {
      return ""
    }

    const trimmed = value.trim()

    if (trimmed === "undefined" || trimmed === "" || trimmed === "null") {
      return ""
    }

    return value
  }, [children])

  return (
    <StyledCodeBlock className="stCode" data-testid="stCode">
      <StyledPre wrapLines={wrapLines ?? false}>
        <SyntaxHighlighter
          language={language}
          PreTag="div"
          customStyle={{ backgroundColor: "transparent" }}
          style={{}}
          lineNumberStyle={{}}
          showLineNumbers={showLineNumbers}
          wrapLongLines={wrapLines}
          renderer={showLineNumbers && wrapLines ? renderer : undefined}
        >
          {text}
        </SyntaxHighlighter>
      </StyledPre>
      {text.trim() !== "" && (
        <StyledCopyButtonContainer>
          <CopyButton text={text} />
        </StyledCopyButtonContainer>
      )}
    </StyledCodeBlock>
  )
}

export default memo(StreamlitSyntaxHighlighter)

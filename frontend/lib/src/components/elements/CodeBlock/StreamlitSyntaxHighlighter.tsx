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
  SyntaxHighlighterProps,
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

interface RendererInput {
  rows: SyntaxHighlighterProps["children"] extends Array<infer R> ? R[] : never
  stylesheet: Record<string, unknown>
  useInlineStyles: boolean
}

function StreamlitSyntaxHighlighter({
  language,
  showLineNumbers,
  wrapLines,
  children,
}: Readonly<StreamlitSyntaxHighlighterProps>): ReactElement {
  const renderer = useCallback(
    (input: RendererInput): ReactElement[] =>
      input.rows.map((row, index): ReactElement => {
        // @ts-expect-error: react-syntax-highlighter internal node shape
        const rowChildren = row.children as unknown[]

        if (Array.isArray(rowChildren)) {
          const lineNumberElement = rowChildren.shift()

          if (lineNumberElement) {
            // @ts-expect-error: react-syntax-highlighter internal node shape
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
          // @ts-expect-error: node type provided by syntax-highlighter
          node: row,
          stylesheet: input.stylesheet,
          useInlineStyles: input.useInlineStyles,
          key: index,
        })
      }),
    []
  )

  const text = useMemo(() => {
    if (children === undefined || children === null) {
      return ""
    }

    let value: string

    if (Array.isArray(children)) {
      value = children.join("")
    } else {
      value = children
    }

    const trimmed = value.trim()

    if (trimmed === "" || trimmed === "undefined" || trimmed === "null") {
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

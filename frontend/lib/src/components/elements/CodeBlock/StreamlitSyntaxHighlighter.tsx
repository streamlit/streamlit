/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, ReactNode, useCallback, useMemo } from "react"

import {
  createElement,
  Prism as SyntaxHighlighter,
  SyntaxHighlighterProps,
} from "react-syntax-highlighter"

import { isNullOrUndefined } from "@streamlit/utils"

import CopyButton from "./CopyButton"
import {
  StyledCodeBlock,
  StyledCopyButtonContainer,
  StyledPre,
} from "./styled-components"

export interface StreamlitSyntaxHighlighterProps {
  children: string | string[] | undefined | null
  language?: string
  showLineNumbers?: boolean
  wrapLines?: boolean
  height?: number
}

/** Extracted Renderer Props from `react-syntax-highlighter`'s internal
 * structure since it isn't exported */
type RendererProps = Parameters<
  NonNullable<SyntaxHighlighterProps["renderer"]>
>[0]

function StreamlitSyntaxHighlighter({
  language,
  showLineNumbers,
  wrapLines,
  children,
}: Readonly<StreamlitSyntaxHighlighterProps>): ReactElement {
  const renderer = useCallback(
    ({ rows, stylesheet, useInlineStyles }: RendererProps): ReactNode => {
      return rows.map((row, index) => {
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
      })
    },
    []
  )

  const text = useMemo(() => {
    if (isNullOrUndefined(children)) {
      return ""
    }

    return Array.isArray(children) ? children.join("") : children
  }, [children])

  const isEmpty = !text || text.trim().length === 0

  return (
    <StyledCodeBlock className="stCode" data-testid="stCode">
      <StyledPre wrapLines={wrapLines ?? false}>
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
          // Fix bug with wrapLongLines+showLineNumbers (see link below) by
          // using a renderer that wraps individual lines of code in their
          // own spans.
          // https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/376
          renderer={showLineNumbers && wrapLines ? renderer : undefined}
        >
          {text}
        </SyntaxHighlighter>
      </StyledPre>
      {!isEmpty && (
        <StyledCopyButtonContainer>
          <CopyButton text={text} />
        </StyledCopyButtonContainer>
      )}
    </StyledCodeBlock>
  )
}

export default memo(StreamlitSyntaxHighlighter)

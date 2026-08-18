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

import CodeBlockCopyToolbar from "./CodeBlockCopyToolbar"
import { StyledCodeBlock, StyledPre } from "./styled-components"

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

/**
 * Line count above which syntax highlighting is skipped.
 *
 * `react-syntax-highlighter`'s `processLines` recurses once per line, so a
 * long-enough input overflows the call stack and the entire code block fails to
 * render instead of merely rendering slowly. See
 * https://github.com/streamlit/streamlit/issues/11996.
 *
 * Line count is what matters here, not byte size: 20MB spread over 20k lines
 * renders fine, while 3.2MB over 120k lines overflows. Measured in this repo's
 * jsdom test environment the overflow begins between 110k and 120k lines. The
 * usable stack differs between Node and browsers, so this limit deliberately sits
 * well below the observed edge rather than next to it, and still leaves an order
 * of magnitude of headroom over any realistic source file.
 */
export const MAX_HIGHLIGHTED_LINES = 50000

/**
 * Returns whether `text` has more than `limit` lines.
 *
 * Counts incrementally and stops at the limit, so an oversized input costs no
 * more than an ordinary one and nothing the size of the input is allocated --
 * `split("\n").length` on a 20MB string would build a 20k-element array just to
 * read its length.
 */
function exceedsLineLimit(text: string, limit: number): boolean {
  let lines = 1
  let index = text.indexOf("\n")

  while (index !== -1) {
    lines++
    if (lines > limit) {
      return true
    }
    index = text.indexOf("\n", index + 1)
  }

  return false
}

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
  const shouldShowCopyButton = !isEmpty

  const isTooLongToHighlight = useMemo(
    () => exceedsLineLimit(text, MAX_HIGHLIGHTED_LINES),
    [text]
  )

  return (
    <StyledCodeBlock
      className="stCode"
      data-testid="stCode"
      tabIndex={shouldShowCopyButton ? 0 : undefined}
    >
      <StyledPre wrapLines={wrapLines ?? false}>
        {isTooLongToHighlight ? (
          // Highlighting would overflow the stack, so show the code unhighlighted
          // rather than failing to render it at all. Line numbers are dropped too,
          // since they come from the highlighter's own row structure.
          <code data-testid="stCodeUnhighlighted">{text}</code>
        ) : (
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
        )}
      </StyledPre>
      {shouldShowCopyButton && <CodeBlockCopyToolbar text={text} />}
    </StyledCodeBlock>
  )
}

export default memo(StreamlitSyntaxHighlighter)

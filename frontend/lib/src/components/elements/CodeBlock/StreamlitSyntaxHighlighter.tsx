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
import { StyledCode, StyledCodeBlock, StyledPre } from "./styled-components"

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
 * `react-syntax-highlighter`'s `processLines` flattens unwrapped rows with
 * `[].concat.apply([], newTree)`, spreading one argument per line. Past roughly 120k
 * arguments the engine rejects the call, so the whole code block fails to render.
 * See https://github.com/streamlit/streamlit/issues/11996.
 *
 * Line count is the threshold because it is the argument count; byte size is not. The
 * cap applies on both wrap paths: only the unwrapped path can throw, but highlighting
 * this many lines pins the main thread either way.
 *
 * The safe ceiling is engine-specific, so this cites the tightest known limit rather
 * than the one measured here: JavaScriptCore hard-caps `apply` at 65,536 arguments,
 * where V8 tolerates roughly 110k-120k (the boundary observed in jsdom). 50k
 * therefore clears Safari with only ~1.3x of headroom -- do not raise it toward the
 * V8 number without re-checking JavaScriptCore, or the crash comes back there.
 */
export const MAX_HIGHLIGHTED_LINES = 50000

/**
 * Returns whether `text` has more than `limit` lines.
 *
 * Stops at the first extra newline, so a huge input is no more expensive to check
 * than a small one, and does not allocate an array of lines the way
 * `split("\n").length` would.
 */
export function exceedsLineLimit(text: string, limit: number): boolean {
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
          // Too many lines to hand to the highlighter -- see MAX_HIGHLIGHTED_LINES.
          // Render the code unhighlighted instead of risking not rendering it at
          // all. Line numbers go too, since they come from the highlighter's own row
          // structure.
          <StyledCode
            wrapLines={wrapLines ?? false}
            data-testid="stCodeUnhighlighted"
          >
            {text}
          </StyledCode>
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

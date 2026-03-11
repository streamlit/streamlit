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
 * Maximum text size where we still allow syntax highlighting.
 * If the text is larger than WRAP_LINES_THRESHOLD but smaller than
 * MAX_HIGHLIGHT_SIZE, we force wrapLines=true. This avoids creating
 * a very deep React tree in react-syntax-highlighter, which can
 * cause stack overflow errors.
 *
 * See: https://github.com/streamlit/streamlit/issues/11996
 */

const WRAP_LINES_THRESHOLD = 5_000_000 // ~5MB

/**
 * Maximum text size where we still use react-syntax-highlighter.
 * If the text is bigger than this limit, we stop using the highlighter
 * and render plain <pre><code> instead to avoid
 * "Maximum call stack size exceeded".
 *
 * See: https://github.com/streamlit/streamlit/issues/11996
 * See: https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/357
 */

const MAX_HIGHLIGHT_SIZE = 10_000_000 // ~10MB

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

  // Case 2: If the text is very large (>10MB), we don't use
  // react-syntax-highlighter. Instead we render plain <pre><code>
  // to avoid the "Maximum call stack size exceeded" error.

  const exceedsHighlightLimit = text.length > MAX_HIGHLIGHT_SIZE

  // Case 1: If the text is large (>5MB), we force wrapLines=true.
  // This makes the code processed line by line instead of creating
  // one huge tree, which could cause a stack overflow.

  const shouldForceWrapLines =
    !exceedsHighlightLimit && text.length > WRAP_LINES_THRESHOLD
  const effectiveWrapLines = wrapLines || shouldForceWrapLines

  if (exceedsHighlightLimit) {
    return (
      <StyledCodeBlock
        className="stCode"
        data-testid="stCode"
        tabIndex={shouldShowCopyButton ? 0 : undefined}
      >
        <StyledPre wrapLines={wrapLines ?? false}>
          <div style={{ backgroundColor: "transparent" }}>
            <code>{text}</code>
          </div>
        </StyledPre>
        {shouldShowCopyButton && <CodeBlockCopyToolbar text={text} />}
      </StyledCodeBlock>
    )
  }

  return (
    <StyledCodeBlock
      className="stCode"
      data-testid="stCode"
      tabIndex={shouldShowCopyButton ? 0 : undefined}
    >
      <StyledPre wrapLines={effectiveWrapLines}>
        <SyntaxHighlighter
          language={language}
          PreTag="div"
          customStyle={{ backgroundColor: "transparent" }}
          // We set an empty style object here because we have our own CSS styling that
          // reacts on our theme.
          style={{}}
          lineNumberStyle={{}}
          showLineNumbers={showLineNumbers}
          wrapLongLines={effectiveWrapLines}
          // Fix bug with wrapLongLines+showLineNumbers (see link below) by
          // using a renderer that wraps individual lines of code in their
          // own spans.
          // https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/376
          renderer={
            showLineNumbers && effectiveWrapLines ? renderer : undefined
          }
        >
          {text}
        </SyntaxHighlighter>
      </StyledPre>
      {shouldShowCopyButton && <CodeBlockCopyToolbar text={text} />}
    </StyledCodeBlock>
  )
}

export default memo(StreamlitSyntaxHighlighter)

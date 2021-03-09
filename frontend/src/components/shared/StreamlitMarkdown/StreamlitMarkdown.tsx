/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, {
  ReactElement,
  ReactNode,
  Fragment,
  PureComponent,
  CSSProperties,
} from "react"
import ReactMarkdown from "react-markdown"
// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"
// @ts-ignore
import Tex from "@matejmazur/react-katex"
// @ts-ignore
import RemarkMathPlugin from "remark-math"
// @ts-ignore
import RemarkEmoji from "remark-emoji"
import CodeBlock from "components/elements/CodeBlock/"
import { StyledStreamlitMarkdown } from "./styled-components"

import "katex/dist/katex.min.css"

export interface Props {
  /**
   * The Markdown formatted text to render.
   */
  source: string

  /**
   * True if HTML is allowed in the source string. If this is false,
   * any HTML will be escaped in the output.
   */
  allowHTML: boolean
  style?: CSSProperties
}

/**
 * Wraps the <ReactMarkdown> component to include our standard
 * renderers and AST plugins (for syntax highlighting, HTML support, etc).
 */
class StreamlitMarkdown extends PureComponent<Props> {
  public componentDidCatch = (): void => {
    const { source } = this.props

    throw Object.assign(new Error(), {
      name: "Error parsing Markdown or HTML in this string",
      message: <p>{source}</p>,
      stack: null,
    })
  }

  public render = (): ReactNode => {
    const { source, allowHTML, style } = this.props

    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
      inlineMath: (props: { value: string }): ReactElement => (
        <Tex>{props.value}</Tex>
      ),
      math: (props: { value: string }): ReactElement => (
        <Tex block>{props.value}</Tex>
      ),
    }

    const plugins = [RemarkMathPlugin, RemarkEmoji]
    const astPlugins = allowHTML ? [htmlParser()] : []

    return (
      <StyledStreamlitMarkdown style={style} data-testid="stMarkdownContainer">
        <ReactMarkdown
          source={source}
          escapeHtml={!allowHTML}
          astPlugins={astPlugins}
          plugins={plugins}
          renderers={renderers}
        />
      </StyledStreamlitMarkdown>
    )
  }
}

interface LinkProps {
  children: ReactElement
  href: string
  title?: string
}

interface LinkReferenceProps {
  children: [ReactElement]
  href: string
  title?: string
}

// Using target="_blank" without rel="noopener noreferrer" is a security risk:
// see https://mathiasbynens.github.io/rel-noopener
export function linkWithTargetBlank(props: LinkProps): ReactElement {
  const { href, title, children } = props

  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

// Handle rendering a link through a reference, ex [text](href)
// Don't convert to a link if only `[text]` and missing `(href)`
export function linkReferenceHasParens(
  props: LinkReferenceProps
): ReactElement | null {
  const { href, title, children } = props

  if (!href) {
    return children.length ? (
      <Fragment>[{children[0].props.children}]</Fragment>
    ) : null
  }

  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default StreamlitMarkdown

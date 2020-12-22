/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import React, { ReactElement, ReactNode, Fragment, PureComponent } from "react"
import ReactMarkdown from "react-markdown"
// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"
// @ts-ignore
import { BlockMath, InlineMath } from "react-katex"
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
}

function createAnchorFromText(text: string | null): string {
  const newAnchor = text
    ?.toLowerCase()
    .split(/[^A-Za-z0-9]/)
    .filter(Boolean)
    .join("-")
  return newAnchor || ""
}

function HeadingWithAnchor({
  tag,
  anchor: propsAnchor,
  children,
}: any): ReactElement {
  const [anchor, setAnchor] = React.useState<string | null>(null)
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (anchor === null && ref.current !== null) {
      let newAnchor = null
      if (propsAnchor !== null) {
        newAnchor = propsAnchor
      } else {
        newAnchor = createAnchorFromText(ref.current.textContent)
      }

      if (newAnchor) {
        setAnchor(newAnchor)
        if (window.location.hash.slice(1) === newAnchor) {
          ref.current.scrollIntoView(true)
        }
      }
    }
  }, [ref.current])

  return React.createElement(
    tag,
    { ref },
    <>
      {anchor && <a data-anchor={anchor} />}
      {children}
    </>
  )
}

function CustomHeading(props: any): ReactElement {
  const { level, children } = props
  return <HeadingWithAnchor tag={`h${level}`}>{children}</HeadingWithAnchor>
}

function CustomParsedHtml(props: any): ReactElement {
  const { element } = props

  const headingElements = ["h1", "h2", "h3", "h4", "h5", "h6"]
  if (!headingElements.includes(element.type)) {
    return (ReactMarkdown.renderers.parsedHtml as any)(props)
  }

  return (
    <HeadingWithAnchor
      tag={element.type}
      anchor={element.props["data-anchor"]}
    >
      {element.props.children}
    </HeadingWithAnchor>
  )
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
    const { source, allowHTML } = this.props

    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
      inlineMath: (props: { value: string }): ReactElement => (
        <InlineMath>{props.value}</InlineMath>
      ),
      math: (props: { value: string }): ReactElement => (
        <BlockMath>{props.value}</BlockMath>
      ),
      heading: CustomHeading,
      parsedHtml: CustomParsedHtml,
    }

    const plugins = [RemarkMathPlugin, RemarkEmoji]
    const astPlugins = allowHTML ? [htmlParser()] : []

    return (
      <StyledStreamlitMarkdown data-testid="stMarkdownContainer">
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
}

interface LinkReferenceProps {
  children: [ReactElement]
  href: string
}

// Using target="_blank" without rel="noopener noreferrer" is a security risk:
// see https://mathiasbynens.github.io/rel-noopener
export function linkWithTargetBlank(props: LinkProps): ReactElement {
  return (
    <a href={props.href} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  )
}

// Handle rendering a link through a reference, ex [text](href)
// Don't convert to a link if only `[text]` and missing `(href)`
export function linkReferenceHasParens(
  props: LinkReferenceProps
): ReactElement | null {
  const { href, children } = props

  if (!href) {
    return children.length ? (
      <Fragment>[{children[0].props.children}]</Fragment>
    ) : null
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default StreamlitMarkdown

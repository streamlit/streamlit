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
  /**
   * Element "id" attribute for title, header, and subheader elements.
   * Default: set to "slugified" (a-b-c) heading text.
   * Optional: set to anchor parameter (second argument).
   */
  anchor?: string
}

/**
 * Wraps the <ReactMarkdown> component to include our standard
 * renderers and AST plugins (for syntax highlighting, HTML support, etc).
 */
export class StreamlitMarkdown extends PureComponent<Props> {
  public componentDidCatch = (): void => {
    const { source } = this.props

    throw Object.assign(new Error(), {
      name: "Error parsing Markdown or HTML in this string",
      message: <p>{source}</p>,
      stack: null,
    })
  }

  public render = (): ReactNode => {
    const { source, anchor, allowHTML } = this.props

    // not sure of the best way to get these props into the renderer
    // this was my quick fix to get things working
    const headingWithAnchorTag = (props: HeadingProps): ReactElement => {
      return (
        <Fragment>
          <a href={`#${anchor}`}>#</a>
          {React.createElement(
            `h${props.level}`,
            { id: anchor },
            props.children
          )}
        </Fragment>
      )
    }

    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
      heading: headingWithAnchorTag,
      inlineMath: (props: { value: string }): ReactElement => (
        <InlineMath>{props.value}</InlineMath>
      ),
      math: (props: { value: string }): ReactElement => (
        <BlockMath>{props.value}</BlockMath>
      ),
    }

    const plugins = [RemarkMathPlugin, RemarkEmoji]
    const astPlugins = allowHTML ? [htmlParser()] : []

    return (
      <ReactMarkdown
        source={source}
        escapeHtml={!allowHTML}
        astPlugins={astPlugins}
        plugins={plugins}
        renderers={renderers}
      />
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

interface HeadingProps {
  children: [ReactElement]
  level: number
  anchor: string
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

// Heading renderer that adds "id" tag to title, header, and subheader elements
// This allows for linking within a document. By default set to "slugified" (a-b-c)
// value of the text, or the passed value as the second parameter of said elements
// export function alt_headingWithAnchorTag(props: HeadingProps): ReactElement {
//   // if heading is h4 or above: return heading element without anchor
//   if (props.level > 3) {
//     return React.createElement(`h${props.level}`, {}, props.children)
//   }

//   let anchor = props.children[0].props.children

//   if (!anchor) {
//     anchor = props.children[0].props.children
//       .trim()
//       .toLowerCase()
//       .split(" ")
//       .join("-")
//   } else {
//     anchor = anchor
//       .trim()
//       .toLowerCase()
//       .split(" ")
//       .join("-")
//   }

//   const headingElement = React.createElement(
//     `h${props.level}`,
//     { id: anchor },
//     props.children
//   )

//   // return the heading element inside an <a> tag with added link
//   return React.createElement("a", { href: `#${anchor}` }, headingElement)
// }

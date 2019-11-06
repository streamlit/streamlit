import CodeBlock from "components/elements/CodeBlock"
import React, { ReactElement, ReactNode } from "react"
import ReactMarkdown from "react-markdown"

// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"
// @ts-ignore
import { InlineMath, BlockMath } from "react-katex"
// @ts-ignore
import RemarkMathPlugin from "remark-math"

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

/**
 * Wraps the <ReactMarkdown> component to include our standard
 * renderers and AST plugins (for syntax highlighting, HTML support, etc).
 */
export class StreamlitMarkdown extends React.PureComponent<Props> {
  public render(): ReactNode {
    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
      inlineMath: (props: { value: string }) => (
        <InlineMath>{props.value}</InlineMath>
      ),
      math: (props: { value: string }) => <BlockMath>{props.value}</BlockMath>,
    }

    const plugins = [RemarkMathPlugin]

    const astPlugins = this.props.allowHTML ? [htmlParser()] : []

    return (
      <ReactMarkdown
        source={this.props.source}
        escapeHtml={!this.props.allowHTML}
        astPlugins={astPlugins}
        plugins={plugins}
        renderers={renderers}
      />
    )
  }
}

interface LinkProps {
  href: string
  children: ReactElement
}

interface LinkReferenceProps {
  href: string
  children: [ReactElement]
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
export function linkReferenceHasParens(props: LinkReferenceProps): any {
  const { href, children } = props

  if (!href) {
    return children.length ? `[${children[0].props.children}]` : ""
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

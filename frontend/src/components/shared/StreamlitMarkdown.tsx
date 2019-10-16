import CodeBlock from "components/elements/CodeBlock"
import React, { ReactElement, ReactNode } from "react"
import ReactMarkdown from "react-markdown"

// Ignoring typeScript for this module as it has no ts support
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"

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
 * Wraps the <ReactMarkdown>
 */
export class StreamlitMarkdown extends React.PureComponent<Props> {
  public render(): ReactNode {
    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
    }

    const astPlugins = this.props.allowHTML ? [htmlParser()] : []

    return (
      <ReactMarkdown
        source={this.props.source}
        escapeHtml={!this.props.allowHTML}
        astPlugins={astPlugins}
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
const linkWithTargetBlank = (props: LinkProps): ReactElement => (
  <a href={props.href} target="_blank" rel="noopener noreferrer">
    {props.children}
  </a>
)

// Handle rendering a link through a reference, ex [text](href)
// Don't convert to a link if only `[text]` and missing `(href)`
const linkReferenceHasParens = (props: LinkReferenceProps): any => {
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

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
  HTMLProps,
} from "react"
import ReactMarkdown from "react-markdown"
import { once } from "lodash"
// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"
// @ts-ignore
import Tex from "@matejmazur/react-katex"
// @ts-ignore
import RemarkMathPlugin from "remark-math"
import { Link as LinkIcon } from "react-feather"
// @ts-ignore
import RemarkEmoji from "remark-emoji"
import PageLayoutContext from "src/components/core/PageLayoutContext"
import CodeBlock from "src/components/elements/CodeBlock/"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"
import {
  StyledStreamlitMarkdown,
  StyledLinkIconContainer,
  StyledLinkIcon,
  StyledHeaderContent,
} from "./styled-components"

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
  isCaption?: boolean
}

/**
 * Creates a slug suitable for use as an anchor given a string.
 * Splits the string on non-alphanumeric characters, and joins with a dash.
 */
export function createAnchorFromText(text: string | null): string {
  const newAnchor = text
    ?.toLowerCase()
    .split(/[^A-Za-z0-9]/)
    .filter(Boolean)
    .join("-")
  return newAnchor || ""
}

// wrapping in `once` ensures we only scroll once
const scrollNodeIntoView = once((node: HTMLElement): void => {
  node.scrollIntoView(true)
})

interface HeadingWithAnchorProps {
  tag: string
  anchor?: string
  children: [ReactElement]
  tagProps?: HTMLProps<HTMLHeadingElement>
}

interface CustomHeadingProps {
  level: string | number
  children: [ReactElement]
}

interface CustomParsedHtmlProps {
  type: ReactElement
  element: {
    type: string
    props: {
      "data-anchor": string
      children: [ReactElement]
    }
  }
}

export function HeadingWithAnchor({
  tag,
  anchor: propsAnchor,
  children,
  tagProps,
}: HeadingWithAnchorProps): ReactElement {
  const isSidebar = React.useContext(IsSidebarContext)
  const [elementId, setElementId] = React.useState(propsAnchor)
  const [target, setTarget] = React.useState<HTMLElement | null>(null)

  const {
    addReportFinishedHandler,
    removeReportFinishedHandler,
  } = React.useContext(PageLayoutContext)

  if (isSidebar) {
    return React.createElement(tag, tagProps, children)
  }

  const onReportFinished = React.useCallback(() => {
    if (target !== null) {
      // wait a bit for everything on page to finish loading
      window.setTimeout(() => {
        scrollNodeIntoView(target)
      }, 300)
    }
  }, [target])

  React.useEffect(() => {
    addReportFinishedHandler(onReportFinished)
    return () => {
      removeReportFinishedHandler(onReportFinished)
    }
  }, [addReportFinishedHandler, removeReportFinishedHandler, onReportFinished])

  const ref = React.useCallback(
    node => {
      if (node === null) {
        return
      }

      const anchor = propsAnchor || createAnchorFromText(node.textContent)
      setElementId(anchor)
      if (window.location.hash.slice(1) === anchor) {
        setTarget(node)
      }
    },
    [propsAnchor]
  )

  return React.createElement(
    tag,
    { ...tagProps, ref, id: elementId },
    <StyledLinkIconContainer>
      {elementId && (
        <StyledLinkIcon href={`#${elementId}`}>
          <LinkIcon size="18" />
        </StyledLinkIcon>
      )}
      <StyledHeaderContent>{children}</StyledHeaderContent>
    </StyledLinkIconContainer>
  )
}

function CustomHeading({ level, children }: CustomHeadingProps): ReactElement {
  return <HeadingWithAnchor tag={`h${level}`}>{children}</HeadingWithAnchor>
}

function CustomParsedHtml(props: CustomParsedHtmlProps): ReactElement {
  const {
    element: { type, props: elementProps },
  } = props

  const isSidebar = React.useContext(IsSidebarContext)

  const headingElements = ["h1", "h2", "h3", "h4", "h5", "h6"]
  if (isSidebar || !headingElements.includes(type)) {
    // casting to any because ReactMarkdown's types are funky
    // but this just means "call the original renderer provided by ReactMarkdown"
    return (ReactMarkdown.renderers.parsedHtml as any)(props)
  }

  const { "data-anchor": anchor, children, ...rest } = elementProps
  return (
    <HeadingWithAnchor tag={type} anchor={anchor} tagProps={rest}>
      {children}
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
    const { source, allowHTML, style, isCaption } = this.props

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
      heading: CustomHeading,
      parsedHtml: CustomParsedHtml,
    }

    const plugins = [RemarkMathPlugin, RemarkEmoji]
    const astPlugins = allowHTML ? [htmlParser()] : []

    const renderMarkdown = (): ReactElement => (
      <ReactMarkdown
        source={source}
        escapeHtml={!allowHTML}
        astPlugins={astPlugins}
        plugins={plugins}
        renderers={renderers}
      />
    )

    return (
      <StyledStreamlitMarkdown style={style} data-testid="stMarkdownContainer">
        {isCaption ? <small>{renderMarkdown()}</small> : renderMarkdown()}
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
  // if it's a #hash link, don't open in new tab
  if (props.href.startsWith("#")) {
    const { children, ...rest } = props
    return <a {...rest}>{children}</a>
  }

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

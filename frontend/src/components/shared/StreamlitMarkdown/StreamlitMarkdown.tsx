/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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
  PureComponent,
  CSSProperties,
  HTMLProps,
  FunctionComponent,
} from "react"
import ReactMarkdown, { PluggableList } from "react-markdown"
import {
  Components,
  ReactMarkdownProps,
} from "react-markdown/src/ast-to-react"
import { once } from "lodash"
import remarkMathPlugin from "remark-math"
import rehypeRaw from "rehype-raw"
import rehypeKatex from "rehype-katex"
import { Link as LinkIcon } from "react-feather"
import remarkEmoji from "remark-emoji"
import remarkGfm from "remark-gfm"
import PageLayoutContext from "src/components/core/PageLayoutContext"
import CodeBlock, { CodeTag } from "src/components/elements/CodeBlock/"
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
  children: ReactNode[]
  tagProps?: HTMLProps<HTMLHeadingElement>
}

export const HeadingWithAnchor: FunctionComponent<HeadingWithAnchorProps> = ({
  tag,
  anchor: propsAnchor,
  children,
  tagProps,
}) => {
  const isSidebar = React.useContext(IsSidebarContext)
  const [elementId, setElementId] = React.useState(propsAnchor)
  const [target, setTarget] = React.useState<HTMLElement | null>(null)

  const {
    addScriptFinishedHandler,
    removeScriptFinishedHandler,
  } = React.useContext(PageLayoutContext)

  if (isSidebar) {
    return React.createElement(tag, tagProps, children)
  }

  const onScriptFinished = React.useCallback(() => {
    if (target !== null) {
      // wait a bit for everything on page to finish loading
      window.setTimeout(() => {
        scrollNodeIntoView(target)
      }, 300)
    }
  }, [target])

  React.useEffect(() => {
    addScriptFinishedHandler(onScriptFinished)
    return () => {
      removeScriptFinishedHandler(onScriptFinished)
    }
  }, [addScriptFinishedHandler, removeScriptFinishedHandler, onScriptFinished])

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

type HeadingProps = JSX.IntrinsicElements["h1"] &
  ReactMarkdownProps & { level: number; "data-anchor"?: string }

export const CustomHeading: FunctionComponent<HeadingProps> = ({
  node,
  children,
  level,
  ...rest
}) => {
  const anchor = rest["data-anchor"]
  return (
    <HeadingWithAnchor tag={node.tagName} anchor={anchor} tagProps={rest}>
      {children}
    </HeadingWithAnchor>
  )
}

/**
 * Wraps the <ReactMarkdown> component to include our standard
 * renderers and AST plugins (for syntax highlighting, HTML support, etc).
 */
class StreamlitMarkdown extends PureComponent<Props> {
  static contextType = IsSidebarContext

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
    const isInSidebar = this.context

    const renderers: Components = {
      pre: CodeBlock,
      code: CodeTag,
      a: LinkWithTargetBlank,
      h1: CustomHeading,
      h2: CustomHeading,
      h3: CustomHeading,
      h4: CustomHeading,
      h5: CustomHeading,
      h6: CustomHeading,
    }

    const plugins = [remarkMathPlugin, remarkEmoji, remarkGfm]
    const rehypePlugins: PluggableList = [rehypeKatex]
    if (allowHTML) {
      rehypePlugins.push(rehypeRaw)
    }

    const renderMarkdown = (): ReactElement => (
      <ReactMarkdown
        remarkPlugins={plugins}
        rehypePlugins={rehypePlugins}
        components={renderers}
      >
        {source}
      </ReactMarkdown>
    )

    return (
      <StyledStreamlitMarkdown
        isCaption={Boolean(isCaption)}
        isInSidebar={isInSidebar}
        style={style}
        data-testid={isCaption ? "stCaptionContainer" : "stMarkdownContainer"}
      >
        {renderMarkdown()}
      </StyledStreamlitMarkdown>
    )
  }
}

interface LinkProps {
  node: any
  children: ReactNode[]
  href?: string
  title?: string
}

// Using target="_blank" without rel="noopener noreferrer" is a security risk:
// see https://mathiasbynens.github.io/rel-noopener
export function LinkWithTargetBlank(props: LinkProps): ReactElement {
  // if it's a #hash link, don't open in new tab
  const { href } = props
  if (href && href.startsWith("#")) {
    const { children, node, ...rest } = props
    return <a {...rest}>{children}</a>
  }

  const { title, children } = props
  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default StreamlitMarkdown

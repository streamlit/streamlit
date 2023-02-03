/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, {
  ReactElement,
  ReactNode,
  PureComponent,
  CSSProperties,
} from "react"
import { visit } from "unist-util-visit"
import { useTheme } from "@emotion/react"
import ReactMarkdown from "react-markdown"
import { PluggableList } from "react-markdown/lib/react-markdown"
import { Components } from "react-markdown/lib/ast-to-react"
import remarkDirective from "remark-directive"
import remarkMathPlugin from "remark-math"
import rehypeRaw from "rehype-raw"
import rehypeKatex from "rehype-katex"
import remarkEmoji from "remark-emoji"
import remarkGfm from "remark-gfm"
import CodeBlock, { CodeTag } from "src/components/elements/CodeBlock/"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"
import ErrorBoundary from "src/components/shared/ErrorBoundary/"
import { CustomHeading } from "src/components/shared/Heading"
import {
  getMdBlue,
  getMdGreen,
  getMdOrange,
  getMdRed,
  getMdViolet,
} from "src/theme/index"

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
  isCaption?: boolean

  /**
   * Only allows italics, bold, strikethrough, and emojis in button/download button labels,
   * does not allow colored text
   */
  isButton?: boolean

  /**
   * Only allows italics, bold, strikethrough, emojis, links, and code in widget/expander/tab labels
   */
  isLabel?: boolean

  /**
   * Checkbox has larger label font sizing - same allowed elements as other widgets ^,
   * does not allow colored text
   */
  isCheckbox?: boolean

  /**
   * Does not allow colored text
   */
  isExpander?: boolean
  isTabs?: boolean
}

// Note: React markdown limits hrefs to specific protocols ('http', 'https',
// 'mailto', 'tel') We are essentially allowing any URL (a data URL). It can
// be considered a security flaw, but developers can choose to expose it.
function transformLinkUri(href: string): string {
  return href
}

interface LinkProps {
  node: any
  children: ReactNode[]
  href?: string
  title?: string
  target?: string
  rel?: string
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

  const { title, children, node, target, rel, ...rest } = props
  return (
    <a
      href={href}
      title={title}
      target={target || "_blank"}
      rel={rel || "noopener noreferrer"}
      {...rest}
    >
      {children}
    </a>
  )
}

export interface RenderedMarkdownProps {
  /**
   * The Markdown formatted text to render.
   */
  source: string

  /**
   * True if HTML is allowed in the source string. If this is false,
   * any HTML will be escaped in the output.
   */
  allowHTML: boolean

  overrideComponents?: Components

  /**
   * Only allows italics, bold, strikethrough, and emojis in button/download button labels,
   * does not allow colored text
   */
  isButton?: boolean

  /**
   * Only allows italics, bold, strikethrough, emojis, links, and code in widget/expander/tab labels
   */
  isLabel?: boolean

  /**
   * Does not allow colored text
   */
  isCheckbox?: boolean
  isExpander?: boolean
  isTabs?: boolean
}

export function RenderedMarkdown({
  allowHTML,
  source,
  overrideComponents,
  isLabel,
  isButton,
  isCheckbox,
  isExpander,
  isTabs,
}: RenderedMarkdownProps): ReactElement {
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
    ...(overrideComponents || {}),
  }
  const theme = useTheme()
  const colorMapping = new Map(
    Object.entries({
      red: getMdRed(theme),
      blue: getMdBlue(theme),
      green: getMdGreen(theme),
      violet: getMdViolet(theme),
      orange: getMdOrange(theme),
    })
  )
  function remarkColoring() {
    return (tree: any) => {
      // @ts-ignore
      visit(tree, node => {
        if (node.type === "textDirective") {
          const nodeName = String(node.name)
          if (colorMapping.has(nodeName)) {
            const data = node.data || (node.data = {})
            data.hName = "span"
            data.hProperties = {
              style: `color: ${colorMapping.get(nodeName)}`,
            }
          }
        }
      })
    }
  }
  const plugins = [
    remarkMathPlugin,
    remarkEmoji,
    remarkGfm,
    remarkDirective,
    remarkColoring,
  ]
  const rehypePlugins: PluggableList = [rehypeKatex]

  if (allowHTML) {
    rehypePlugins.push(rehypeRaw)
  }

  // limits allowed markdown, default is allow all
  let allowed
  if (isLabel) {
    allowed = ["p", "em", "strong", "del", "code", "a", "span"]
  }
  if (isButton || isCheckbox || isExpander || isTabs) {
    allowed = ["p", "em", "strong", "del"]
  }

  return (
    <ErrorBoundary>
      <ReactMarkdown // @ts-ignore
        remarkPlugins={plugins}
        rehypePlugins={rehypePlugins}
        components={renderers}
        transformLinkUri={transformLinkUri}
        allowedElements={allowed}
      >
        {source}
      </ReactMarkdown>
    </ErrorBoundary>
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

  public render(): ReactNode {
    const {
      source,
      allowHTML,
      style,
      isCaption,
      isLabel,
      isButton,
      isCheckbox,
      isExpander,
      isTabs,
    } = this.props
    const isInSidebar = this.context

    return (
      <StyledStreamlitMarkdown
        isCaption={Boolean(isCaption)}
        isInSidebar={isInSidebar}
        isLabel={isLabel}
        isCheckbox={isCheckbox}
        style={style}
        data-testid={isCaption ? "stCaptionContainer" : "stMarkdownContainer"}
      >
        <RenderedMarkdown
          source={source}
          allowHTML={allowHTML}
          isLabel={isLabel}
          isCheckbox={isCheckbox}
          isButton={isButton}
          isExpander={isExpander}
          isTabs={isTabs}
        />
      </StyledStreamlitMarkdown>
    )
  }
}

export default StreamlitMarkdown

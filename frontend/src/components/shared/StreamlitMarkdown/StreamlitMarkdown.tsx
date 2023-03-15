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
  CSSProperties,
  Fragment,
  FunctionComponent,
  HTMLProps,
  PureComponent,
  ReactElement,
  ReactNode,
} from "react"
import { visit } from "unist-util-visit"
import { useTheme } from "@emotion/react"
import ReactMarkdown from "react-markdown"
import { PluggableList } from "react-markdown/lib/react-markdown"
import {
  Components,
  ReactMarkdownProps,
} from "react-markdown/lib/ast-to-react"
import { once, omit } from "lodash"
import remarkDirective from "remark-directive"
import remarkMathPlugin from "remark-math"
import rehypeRaw from "rehype-raw"
import rehypeKatex from "rehype-katex"
import { Link as LinkIcon } from "react-feather"
import remarkEmoji from "remark-emoji"
import remarkGfm from "remark-gfm"
import AppContext from "src/components/core/AppContext"
import CodeBlock from "src/components/elements/CodeBlock/"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"
import { Heading as HeadingProto } from "src/autogen/proto"
import ErrorBoundary from "src/components/shared/ErrorBoundary/"
import {
  getMdBlue,
  getMdGreen,
  getMdOrange,
  getMdRed,
  getMdViolet,
} from "src/theme/index"

import {
  InlineTooltipIcon,
  StyledLabelHelpWrapper,
} from "src/components/shared/TooltipIcon"

import {
  StyledHeaderContainer,
  StyledHeaderContent,
  StyledLinkIcon,
  StyledLinkIconContainer,
  StyledStreamlitMarkdown,
} from "./styled-components"

import "katex/dist/katex.min.css"
import { StyledCopyButtonContainer } from "src/components/elements/CodeBlock/styled-components"
import CopyButton from "src/components/elements/CodeBlock/CopyButton"
import StreamlitSyntaxHighlighter from "src/components/elements/CodeBlock/StreamlitSyntaxHighlighter"

enum Tags {
  H1 = "h1",
  H2 = "h2",
  H3 = "h3",
}

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
   * Indicates widget labels & restricts allowed elements
   */
  isLabel?: boolean

  /**
   * Does not allow links
   */
  isButton?: boolean

  /**
   * Checkbox has larger label font sizing
   */
  isCheckbox?: boolean
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

// Note: React markdown limits hrefs to specific protocols ('http', 'https',
// 'mailto', 'tel') We are essentially allowing any URL (a data URL). It can
// be considered a security flaw, but developers can choose to expose it.
function transformLinkUri(href: string): string {
  return href
}

// wrapping in `once` ensures we only scroll once
const scrollNodeIntoView = once((node: HTMLElement): void => {
  node.scrollIntoView(true)
})

interface HeadingWithAnchorProps {
  tag: string
  anchor?: string
  children: ReactNode[] | ReactNode
  tagProps?: HTMLProps<HTMLHeadingElement>
}

export interface HeadingProtoProps {
  width: number
  element: HeadingProto
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

  const { addScriptFinishedHandler, removeScriptFinishedHandler } =
    React.useContext(AppContext)
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
  ...rest
}) => {
  const anchor = rest["data-anchor"]
  return (
    <StyledHeaderContainer>
      <HeadingWithAnchor tag={node.tagName} anchor={anchor} tagProps={rest}>
        {children}
      </HeadingWithAnchor>
    </StyledHeaderContainer>
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
   * Indicates widget labels & restricts allowed elements
   */
  isLabel?: boolean

  /**
   * Does not allow links
   */
  isButton?: boolean
}

export type CustomCodeTagProps = JSX.IntrinsicElements["code"] &
  ReactMarkdownProps & { inline?: boolean }

/**
 * Renders code tag with highlighting based on requested language.
 */
export const CustomCodeTag: FunctionComponent<CustomCodeTagProps> = ({
  inline,
  className,
  children,
  ...props
}) => {
  const match = /language-(\w+)/.exec(className || "")
  const codeText = String(children).trim().replace(/\n$/, "")

  const language = (match && match[1]) || ""
  return !inline ? (
    <>
      {codeText && (
        <StyledCopyButtonContainer>
          <CopyButton text={codeText} />
        </StyledCopyButtonContainer>
      )}
      <StreamlitSyntaxHighlighter language={language} showLineNumbers={false}>
        {codeText}
      </StreamlitSyntaxHighlighter>
    </>
  ) : (
    <code className={className} {...omit(props, "node")}>
      {children}
    </code>
  )
}

export function RenderedMarkdown({
  allowHTML,
  source,
  overrideComponents,
  isLabel,
  isButton,
}: RenderedMarkdownProps): ReactElement {
  const renderers: Components = {
    pre: CodeBlock,
    code: CustomCodeTag,
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

  // Sets disallowed markdown for widget labels
  let disallowed
  if (isLabel) {
    // Restricts images, table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
    disallowed = [
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "input",
      "hr",
      "blockquote",
    ]

    if (isButton) {
      // Button labels additionally restrict links
      disallowed.push("a")
    }
  }

  return (
    <ErrorBoundary>
      <ReactMarkdown
        remarkPlugins={plugins}
        rehypePlugins={rehypePlugins}
        components={renderers}
        transformLinkUri={transformLinkUri}
        disallowedElements={disallowed}
        // unwrap and render children from invalid markdown
        unwrapDisallowed={true}
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
    } = this.props
    const isInSidebar = this.context

    return (
      <StyledStreamlitMarkdown
        isCaption={Boolean(isCaption)}
        isInSidebar={isInSidebar}
        isLabel={isLabel}
        isButton={isButton}
        isCheckbox={isCheckbox}
        style={style}
        data-testid={isCaption ? "stCaptionContainer" : "stMarkdownContainer"}
      >
        <RenderedMarkdown
          source={source}
          allowHTML={allowHTML}
          isLabel={isLabel}
          isButton={isButton}
        />
      </StyledStreamlitMarkdown>
    )
  }
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
    const { children, ...rest } = props
    return <a {...omit(rest, "node")}>{children}</a>
  }

  const { title, children, target, rel, ...rest } = props
  return (
    <a
      href={href}
      title={title}
      target={target || "_blank"}
      rel={rel || "noopener noreferrer"}
      {...omit(rest, "node")}
    >
      {children}
    </a>
  )
}

function makeMarkdownHeading(tag: string, markdown: string): string {
  switch (tag.toLowerCase()) {
    case Tags.H1: {
      return `# ${markdown}`
    }
    case Tags.H2: {
      return `## ${markdown}`
    }
    case Tags.H3: {
      return `### ${markdown}`
    }
    default: {
      throw new Error(`Unrecognized tag for header: ${tag}`)
    }
  }
}

export function Heading(props: HeadingProtoProps): ReactElement {
  const { width, element } = props
  const { tag, anchor, body, help } = element
  const isSidebar = React.useContext(IsSidebarContext)
  // st.header can contain new lines which are just interpreted as new
  // markdown to be rendered as such.
  const [heading, ...rest] = body.split("\n")

  return (
    <div className="stMarkdown" style={{ width }}>
      <StyledStreamlitMarkdown
        isCaption={Boolean(false)}
        isInSidebar={isSidebar}
        style={{ width }}
        data-testid="stMarkdownContainer"
      >
        <StyledHeaderContainer>
          <HeadingWithAnchor tag={tag} anchor={anchor}>
            {help ? (
              <StyledLabelHelpWrapper>
                <RenderedMarkdown
                  source={makeMarkdownHeading(tag, heading)}
                  allowHTML={false}
                  // this is purely an inline string
                  overrideComponents={{
                    p: Fragment,
                    h1: Fragment,
                    h2: Fragment,
                    h3: Fragment,
                    h4: Fragment,
                    h5: Fragment,
                    h6: Fragment,
                  }}
                />
                <InlineTooltipIcon content={help} />
              </StyledLabelHelpWrapper>
            ) : (
              <RenderedMarkdown
                source={makeMarkdownHeading(tag, heading)}
                allowHTML={false}
                // this is purely an inline string
                overrideComponents={{
                  p: Fragment,
                  h1: Fragment,
                  h2: Fragment,
                  h3: Fragment,
                  h4: Fragment,
                  h5: Fragment,
                  h6: Fragment,
                }}
              />
            )}
          </HeadingWithAnchor>
        </StyledHeaderContainer>
        {/* Only the first line of the body is used as a heading, the remaining text is added as regular mardkown below. */}
        {rest.length > 0 && (
          <RenderedMarkdown source={rest.join("\n")} allowHTML={false} />
        )}
      </StyledStreamlitMarkdown>
    </div>
  )
}

export default StreamlitMarkdown

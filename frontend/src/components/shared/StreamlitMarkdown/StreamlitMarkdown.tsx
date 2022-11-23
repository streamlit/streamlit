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
import AppContext from "src/components/core/AppContext"
import {
  CodeBlock,
  CodeBlockWithColoredText,
  CodeTag,
  CodeTagWithColoredText,
} from "src/components/elements/CodeBlock/"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"
import { Heading as HeadingProto } from "src/autogen/proto"
import ErrorBoundary from "src/components/shared/ErrorBoundary/"

import {
  StyledStreamlitMarkdown,
  StyledLinkIconContainer,
  StyledLinkIcon,
  StyledHeaderContent,
  StyledHeaderContainer,

  // These are the variables and components which are used to color markdown
  ColorNames,
  ColorStartRegex,
  SentenceWithColorRegex,
  StyledBlueSpan,
  StyledCyanSpan,
  StyledTealSpan,
  StyledRedSpan,
  StyledVioletSpan,
  StyledOrangeSpan,
} from "./styled-components"

import "katex/dist/katex.min.css"
import remarkColoredText from "./RemarkColoredText"

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
   * Only allows italics, bold, strikethrough, and emojis in button/download button labels, does not allow colored text
   */
  isButton?: boolean

  /**
   * Only allows italics, bold, strikethrough, emojis, links, and code in widget/expander/tab labels
   */
  isLabel?: boolean

  /**
   * Checkbox has larger label font sizing - same allowed elements as other widgets ^, does not allow colored text
   */
  isCheckbox?: boolean

  /**
   * Does not allow colored text
   */
  isExpander?: boolean
  isTabs?: boolean
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

type TypeCheckIfChildrenIncludesValidColors = (children: Array<any>) => boolean
export const CheckIfChildrenIncludesValidColors: TypeCheckIfChildrenIncludesValidColors =
  children => {
    if (!children || children.length === 0) {
      return false
    }
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child && child.toString().length > 0) {
        const match = child.toString().match(SentenceWithColorRegex)
        if (match) {
          const colorMatch = match[0].match(ColorStartRegex)
          if (colorMatch) {
            const color = colorMatch[0]
              .replace("[", "")
              .replace("]", "")
              .toLowerCase()
            if (color && ColorNames.includes(color)) {
              return true
            }
          }
        }
      }
    }
    return false
  }

type TypePrepareColoredSpanJSXElements = (
  children: Array<any>
) => Array<JSX.Element>
export const PrepareColoredSpanJSXElements: TypePrepareColoredSpanJSXElements =
  children => {
    if (!CheckIfChildrenIncludesValidColors(children)) {
      return children
    }
    let idx = 0
    const components: Array<JSX.Element> = []
    children.forEach(child => {
      if (
        child &&
        (typeof child === "string" || child instanceof String) &&
        child.toString().length > 0
      ) {
        let text = child.toString()
        let match = text.match(SentenceWithColorRegex)
        if (!match) {
          components.push(<span key={idx++}>{text}</span>)
        }
        // I've never managed to infinite loop this version of the code,
        // however for safety, let's limit number of iterations to 1 000 000
        let numOfIterations = 0
        while (match && match.index !== undefined) {
          if (numOfIterations++ > 1000000) {
            break
          }
          const prefix = text.substring(0, match.index)
          if (prefix.length > 0) {
            components.push(<span key={idx++}>{prefix}</span>)
            text = text.substring(match.index)
          }
          match = text.match(SentenceWithColorRegex)
          if (match) {
            const colorMatch = match[0].match(ColorStartRegex)
            if (colorMatch) {
              const color = colorMatch[0]
                .replace("[", "")
                .replace("]", "")
                .toLowerCase()
              if (color === "blue") {
                components.push(
                  <StyledBlueSpan data-testid="stMdBlue" key={idx++}>
                    {match[1]}
                  </StyledBlueSpan>
                )
              } else if (color === "cyan") {
                components.push(
                  <StyledCyanSpan data-testid="stMdCyan" key={idx++}>
                    {match[1]}
                  </StyledCyanSpan>
                )
              } else if (color === "teal") {
                components.push(
                  <StyledTealSpan data-testid="stMdTeal" key={idx++}>
                    {match[1]}
                  </StyledTealSpan>
                )
              } else if (color === "red") {
                components.push(
                  <StyledRedSpan data-testid="stMdRed" key={idx++}>
                    {match[1]}
                  </StyledRedSpan>
                )
              } else if (color === "violet") {
                components.push(
                  <StyledVioletSpan data-testid="stMdViolet" key={idx++}>
                    {match[1]}
                  </StyledVioletSpan>
                )
              } else if (color === "orange") {
                components.push(
                  <StyledOrangeSpan data-testid="stMdOrange" key={idx++}>
                    {match[1]}
                  </StyledOrangeSpan>
                )
              }
              text = text.substring(match[0].length)
            }
          }
          match = text.match(SentenceWithColorRegex)
          if (!match && text.length > 0) {
            components.push(<span key={idx++}>{text}</span>)
          }
        }
      } else if (child && child.type === "strong") {
        components.push(
          <strong>
            {PrepareColoredSpanJSXElements(child.props.children).map(c => c)}
          </strong>
        )
      } else if (child) {
        components.push(child)
      }
    })
    return components
  }

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
  level,
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
export const CustomHeadingWithColoredText: FunctionComponent<HeadingProps> = ({
  node,
  children,
  level,
  ...rest
}) => {
  const anchor = rest["data-anchor"]
  if (!children || children.length === 0) {
    return (
      <StyledHeaderContainer>
        <HeadingWithAnchor tag={node.tagName} anchor={anchor} tagProps={rest}>
          {children}
        </HeadingWithAnchor>
      </StyledHeaderContainer>
    )
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return (
      <StyledHeaderContainer>
        <HeadingWithAnchor tag={node.tagName} anchor={anchor} tagProps={rest}>
          {children}
        </HeadingWithAnchor>
      </StyledHeaderContainer>
    )
  }
  return (
    <StyledHeaderContainer>
      <HeadingWithAnchor tag={node.tagName} anchor={anchor} tagProps={rest}>
        {PrepareColoredSpanJSXElements(children).map(c => c)}
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
   * Only allows italics, bold, strikethrough, and emojis in button/download button labels, does not allow colored text
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

type PColoredTextProps = JSX.IntrinsicElements["p"] & ReactMarkdownProps
export const PColoredText: FunctionComponent<PColoredTextProps> = ({
  node,
  children,
  ...rest
}) => {
  if (!children || children.length === 0) {
    return <p>{children}</p>
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return <p>{children}</p>
  }
  return <p>{PrepareColoredSpanJSXElements(children).map(c => c)}</p>
}

type SpanColoredTextProps = JSX.IntrinsicElements["span"] & ReactMarkdownProps
export const SpanColoredText: FunctionComponent<SpanColoredTextProps> = ({
  node,
  children,
  ...rest
}) => {
  if (!children || children.length === 0) {
    return <span>{children}</span>
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return <span>{children}</span>
  }
  return <span>{PrepareColoredSpanJSXElements(children).map(c => c)}</span>
}

type StrongColoredTextProps = JSX.IntrinsicElements["strong"] &
  ReactMarkdownProps
export const StrongColoredText: FunctionComponent<StrongColoredTextProps> = ({
  node,
  children,
  ...rest
}) => {
  if (!children || children.length === 0) {
    return <strong>{children}</strong>
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return <strong>{children}</strong>
  }
  return <strong>{PrepareColoredSpanJSXElements(children).map(c => c)}</strong>
}

type DelColoredTextProps = JSX.IntrinsicElements["del"] & ReactMarkdownProps
export const DelColoredText: FunctionComponent<DelColoredTextProps> = ({
  node,
  children,
  ...rest
}) => {
  if (!children || children.length === 0) {
    return <del>{children}</del>
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return <del>{children}</del>
  }
  return <del>{PrepareColoredSpanJSXElements(children).map(c => c)}</del>
}

type EmColoredTextProps = JSX.IntrinsicElements["em"] & ReactMarkdownProps
export const EmColoredText: FunctionComponent<EmColoredTextProps> = ({
  node,
  children,
  ...rest
}) => {
  if (!children || children.length === 0) {
    return <em>{children}</em>
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return <em>{children}</em>
  }
  return <em>{PrepareColoredSpanJSXElements(children).map(c => c)}</em>
}

type LIColoredTextProps = JSX.IntrinsicElements["li"] & ReactMarkdownProps
export const LIColoredText: FunctionComponent<LIColoredTextProps> = ({
  node,
  children,
  ...rest
}) => {
  if (!children || children.length === 0) {
    return <li>{children}</li>
  }
  if (!CheckIfChildrenIncludesValidColors(children)) {
    return <li>{children}</li>
  }
  return <li>{PrepareColoredSpanJSXElements(children).map(c => c)}</li>
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
  const enableColoredText = !(isButton || isCheckbox || isExpander || isTabs)
  const plugins = [remarkMathPlugin, remarkEmoji, remarkGfm]
  let renderers: Components
  if (enableColoredText) {
    plugins.push(remarkColoredText)
    renderers = {
      pre: CodeBlockWithColoredText,
      code: CodeTagWithColoredText,
      a: LinkWithTargetBlankWithColoredText,
      p: PColoredText,
      li: LIColoredText,
      em: EmColoredText,
      del: DelColoredText,
      h1: CustomHeadingWithColoredText,
      h2: CustomHeadingWithColoredText,
      h3: CustomHeadingWithColoredText,
      h4: CustomHeadingWithColoredText,
      h5: CustomHeadingWithColoredText,
      h6: CustomHeadingWithColoredText,
      strong: StrongColoredText,
      ...(overrideComponents || {}),
    }
  } else {
    renderers = {
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
  }
  const rehypePlugins: PluggableList = [rehypeKatex]

  if (allowHTML) {
    rehypePlugins.push(rehypeRaw)
  }

  // limits allowed markdown, default is allow all
  let allowed
  if (isLabel) {
    allowed = ["p", "em", "strong", "del", "code", "a"]
  }
  if (isButton || isCheckbox || isExpander || isTabs) {
    allowed = ["p", "em", "strong", "del"]
  }

  return (
    <ErrorBoundary>
      <ReactMarkdown
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
export function LinkWithTargetBlankWithColoredText(
  props: LinkProps
): ReactElement {
  // if it's a #hash link, don't open in new tab
  const { href } = props
  if (href && href.startsWith("#")) {
    const { children, node, ...rest } = props
    if (!children || children.length === 0) {
      return <a {...rest}>{children}</a>
    }
    if (!CheckIfChildrenIncludesValidColors(children)) {
      return <a {...rest}>{children}</a>
    }
    return (
      <a {...rest}>{PrepareColoredSpanJSXElements(children).map(c => c)}</a>
    )
  }

  const { title, children, node, target, rel, ...rest } = props
  if (
    !children ||
    children.length === 0 ||
    !CheckIfChildrenIncludesValidColors(children)
  ) {
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
  return (
    <a
      href={href}
      title={title}
      target={target || "_blank"}
      rel={rel || "noopener noreferrer"}
      {...rest}
    >
      {PrepareColoredSpanJSXElements(children).map(c => c)}
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
  const { width } = props
  const { tag, anchor, body } = props.element
  const isSidebar = React.useContext(IsSidebarContext)
  // st.header can contain new lines which are just interpreted as new
  // markdown to be rendered as such.
  const [heading, ...rest] = body.split("\n")

  return (
    <div className="stMarkdown" style={{ width }}>
      <StyledHeaderContainer>
        <HeadingWithAnchor tag={tag} anchor={anchor}>
          <RenderedMarkdown
            source={makeMarkdownHeading(tag, heading)}
            allowHTML={false}
            // this is purely an inline string
            overrideComponents={{
              p: SpanColoredText,
              h1: SpanColoredText,
              h2: SpanColoredText,
              h3: SpanColoredText,
              h4: SpanColoredText,
              h5: SpanColoredText,
              h6: SpanColoredText,
            }}
          />
        </HeadingWithAnchor>
      </StyledHeaderContainer>
      {/* Only the first line of the body is used as a heading, the remaining text is added as regular mardkown below. */}
      {rest.length > 0 && (
        <StyledStreamlitMarkdown
          isCaption={Boolean(false)}
          isInSidebar={isSidebar}
          style={{ width }}
          data-testid="stMarkdownContainer"
        >
          <RenderedMarkdown source={rest.join("\n")} allowHTML={false} />
        </StyledStreamlitMarkdown>
      )}
    </div>
  )
}

export default StreamlitMarkdown

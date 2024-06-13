/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import once from "lodash/once"
import omit from "lodash/omit"
import remarkDirective from "remark-directive"
import remarkMathPlugin from "remark-math"
import rehypeRaw from "rehype-raw"
import rehypeKatex from "rehype-katex"
import { Link2 as LinkIcon } from "react-feather"
import remarkEmoji from "remark-emoji"
import remarkGfm from "remark-gfm"
import { findAndReplace } from "mdast-util-find-and-replace"

import CodeBlock from "@streamlit/lib/src/components/elements/CodeBlock"
import IsDialogContext from "@streamlit/lib/src/components/core/IsDialogContext"
import IsSidebarContext from "@streamlit/lib/src/components/core/IsSidebarContext"
import ErrorBoundary from "@streamlit/lib/src/components/shared/ErrorBoundary"
import { InlineTooltipIcon } from "@streamlit/lib/src/components/shared/TooltipIcon"
import {
  getMarkdownTextColors,
  getMarkdownBgColors,
} from "@streamlit/lib/src/theme"

import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import {
  StyledLinkIcon,
  StyledHeadingActionElements,
  StyledStreamlitMarkdown,
  StyledHeadingWithActionElements,
} from "./styled-components"

import "katex/dist/katex.min.css"
import xxhash from "xxhashjs"
import StreamlitSyntaxHighlighter from "@streamlit/lib/src/components/elements/CodeBlock/StreamlitSyntaxHighlighter"

export enum Tags {
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
   * Make the label bold
   */
  boldLabel?: boolean

  /**
   * Checkbox labels have larger font sizing
   */
  largerLabel?: boolean

  /**
   * Does not allow links
   */
  disableLinks?: boolean

  /**
   * Toast has smaller font sizing & special CSS
   */
  isToast?: boolean
}

/**
 * Creates a slug suitable for use as an anchor given a string.
 * Splits the string on non-alphanumeric characters, and joins with a dash.
 */
export function createAnchorFromText(text: string | null): string {
  let newAnchor = ""
  // Check if the text is valid ASCII characters - necessary for fully functional anchors (issue #5291)
  const isASCII = text && /^[\x00-\x7F]*$/.test(text)

  if (isASCII) {
    newAnchor = text
      ?.toLowerCase()
      .split(/[^\p{L}\p{N}]+/gu) // split on non-alphanumeric characters
      .filter(Boolean) // filter out falsy values using Boolean constructor
      .join("-")
  } else if (text) {
    // if the text is not valid ASCII, use a hash of the text
    newAnchor = xxhash.h32(text, 0xabcd).toString(16)
  }
  return newAnchor
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

interface HeadingActionElements {
  elementId?: string
  help?: string
  hideAnchor?: boolean
}

const HeaderActionElements: FunctionComponent<HeadingActionElements> = ({
  elementId,
  help,
  hideAnchor,
}) => {
  if (!help && hideAnchor) {
    return <></>
  }

  return (
    <StyledHeadingActionElements data-testid="stHeaderActionElements">
      {help && <InlineTooltipIcon content={help} />}
      {elementId && !hideAnchor && (
        <StyledLinkIcon href={`#${elementId}`}>
          <LinkIcon size="18" />
        </StyledLinkIcon>
      )}
    </StyledHeadingActionElements>
  )
}

interface HeadingWithActionElementsProps {
  tag: string
  anchor?: string
  hideAnchor?: boolean
  children: ReactNode[] | ReactNode
  tagProps?: HTMLProps<HTMLHeadingElement>
  help?: string
}

export const HeadingWithActionElements: FunctionComponent<
  React.PropsWithChildren<HeadingWithActionElementsProps>
> = ({ tag, anchor: propsAnchor, help, hideAnchor, children, tagProps }) => {
  const isInSidebar = React.useContext(IsSidebarContext)
  const isInDialog = React.useContext(IsDialogContext)
  const [elementId, setElementId] = React.useState(propsAnchor)
  const [target, setTarget] = React.useState<HTMLElement | null>(null)

  const { addScriptFinishedHandler, removeScriptFinishedHandler } =
    React.useContext(LibContext)
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
    (node: any) => {
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

  const isInSidebarOrDialog = isInSidebar || isInDialog
  const actionElements = (
    <HeaderActionElements
      elementId={elementId}
      help={help}
      hideAnchor={hideAnchor || isInSidebarOrDialog}
    />
  )

  const attributes = isInSidebarOrDialog ? {} : { ref, id: elementId }
  // We nest the action-elements (tooltip, link-icon) into the header element (e.g. h1),
  // so that it appears inline. For context: we also tried setting the h's display attribute to 'inline', but
  // then we would need to add padding to the outer container and fiddle with the vertical alignment.
  const headerElementWithActions = React.createElement(
    tag,
    {
      ...tagProps,
      ...attributes,
    },
    <>
      {children}
      {actionElements}
    </>
  )

  // we don't want to apply styling, so return the "raw" header
  if (isInSidebarOrDialog) {
    return headerElementWithActions
  }

  return (
    <StyledHeadingWithActionElements data-testid="stHeadingWithActionElements">
      {headerElementWithActions}
    </StyledHeadingWithActionElements>
  )
}

type HeadingProps = JSX.IntrinsicElements["h1"] &
  ReactMarkdownProps & { level: number; "data-anchor"?: string }

export const CustomHeading: FunctionComponent<
  React.PropsWithChildren<HeadingProps>
> = ({ node, children, ...rest }) => {
  const anchor = rest["data-anchor"]
  return (
    <HeadingWithActionElements
      tag={node.tagName}
      anchor={anchor}
      tagProps={rest}
    >
      {children}
    </HeadingWithActionElements>
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
  disableLinks?: boolean
}

export type CustomCodeTagProps = JSX.IntrinsicElements["code"] &
  ReactMarkdownProps & { inline?: boolean }

/**
 * Renders code tag with highlighting based on requested language.
 */
export const CustomCodeTag: FunctionComponent<
  React.PropsWithChildren<CustomCodeTagProps>
> = ({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || "")
  const codeText = String(children).trim().replace(/\n$/, "")

  const language = (match && match[1]) || ""
  return !inline ? (
    <StreamlitSyntaxHighlighter language={language} showLineNumbers={false}>
      {codeText}
    </StreamlitSyntaxHighlighter>
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
  disableLinks,
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
  const { red, orange, yellow, green, blue, violet, purple, gray } =
    getMarkdownTextColors(theme)
  const {
    redbg,
    orangebg,
    yellowbg,
    greenbg,
    bluebg,
    violetbg,
    purplebg,
    graybg,
  } = getMarkdownBgColors(theme)
  const colorMapping = new Map(
    Object.entries({
      red: `color: ${red}`,
      blue: `color: ${blue}`,
      green: `color: ${green}`,
      violet: `color: ${violet}`,
      orange: `color: ${orange}`,
      gray: `color: ${gray}`,
      grey: `color: ${gray}`,
      // Gradient from red, orange, yellow, green, blue, violet, purple
      rainbow: `color: transparent; background-clip: text; -webkit-background-clip: text; background-image: linear-gradient(to right,
        ${red}, ${orange}, ${yellow}, ${green}, ${blue}, ${violet}, ${purple});`,
      "red-background": `background-color: ${redbg}`,
      "blue-background": `background-color: ${bluebg}`,
      "green-background": `background-color: ${greenbg}`,
      "violet-background": `background-color: ${violetbg}`,
      "orange-background": `background-color: ${orangebg}`,
      "gray-background": `background-color: ${graybg}`,
      "grey-background": `background-color: ${graybg}`,
      // Gradient from red, orange, yellow, green, blue, violet, purple
      "rainbow-background": `background: linear-gradient(to right,
        ${redbg}, ${orangebg}, ${yellowbg}, ${greenbg}, ${bluebg}, ${violetbg}, ${purplebg});`,
    })
  )
  function remarkColoring() {
    return (tree: any) => {
      visit(tree, "textDirective", (node, _index, _parent) => {
        const nodeName = String(node.name)
        if (colorMapping.has(nodeName)) {
          const data = node.data || (node.data = {})
          const style = colorMapping.get(nodeName)
          data.hName = "span"
          data.hProperties = data.hProperties || {}
          data.hProperties.style = style
          // Add class for background color for custom styling
          if (
            style &&
            (/background-color:/.test(style) || /background:/.test(style))
          ) {
            data.hProperties.className =
              (data.hProperties.className || "") + " has-background-color"
          }
        } else {
          // Convert unsupported text directives to plain text to avoid them being ignored/not rendered
          // See https://github.com/streamlit/streamlit/issues/8726, https://github.com/streamlit/streamlit/issues/5968
          node.type = "text"
          node.value = `:${nodeName}`
          node.data = {}
        }
      })
    }
  }

  function remarkMaterialIcons() {
    return (tree: any) => {
      function replace(_full_match: string, icon_name: string): any {
        return {
          type: "text",
          // value: full_match, // Is this needed?
          data: {
            hName: "span",
            hProperties: {
              role: "img",
              ariaLabel: icon_name + " icon",
              style: {
                "font-family": "Material Symbols Outlined",
                "user-select": "none",
                display: "inline-block",
                "vertical-align": "bottom",
                "font-weight": "normal",
                "white-space": "nowrap",
                "word-wrap": "normal",
              },
            },

            hChildren: [{ type: "text", value: icon_name }],
          },
        }
      }

      findAndReplace(tree, [[/:material_(\w+):/g, replace]])
      return tree
    }
  }

  const plugins = [
    remarkMathPlugin,
    remarkMaterialIcons,
    remarkEmoji,
    remarkGfm,
    remarkDirective,
    remarkColoring,
  ]

  const rehypePlugins: PluggableList = [
    rehypeKatex,
    ...(allowHTML ? [rehypeRaw] : []),
  ]

  // :material/ is detected as an directive (from remark_directive)
  // However, the directive logic ignores emoji shortcodes. As a workaround,
  // we can make it look like an emoji shortcode by replacing the / with _.
  const parsedString = source.replaceAll(":material/", ":material_")
  // Sets disallowed markdown for widget labels
  const disallowed = [
    // Restricts images, table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
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
    // additionally restrict links
    ...(disableLinks ? ["a"] : []),
  ]

  return (
    <ErrorBoundary>
      <ReactMarkdown
        remarkPlugins={plugins}
        rehypePlugins={rehypePlugins}
        components={renderers}
        transformLinkUri={transformLinkUri}
        disallowedElements={isLabel ? disallowed : []}
        // unwrap and render children from invalid markdown
        unwrapDisallowed={true}
      >
        {parsedString}
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

  context!: React.ContextType<typeof IsSidebarContext>

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
      boldLabel,
      largerLabel,
      disableLinks,
      isToast,
    } = this.props
    const isInSidebar = this.context

    return (
      <StyledStreamlitMarkdown
        isCaption={Boolean(isCaption)}
        isInSidebar={isInSidebar}
        isLabel={isLabel}
        boldLabel={boldLabel}
        largerLabel={largerLabel}
        isToast={isToast}
        style={style}
        data-testid={isCaption ? "stCaptionContainer" : "stMarkdownContainer"}
      >
        <RenderedMarkdown
          source={source}
          allowHTML={allowHTML}
          isLabel={isLabel}
          disableLinks={disableLinks}
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

export default StreamlitMarkdown

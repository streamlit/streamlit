/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  type FC,
  type HTMLProps,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import slugify from "@sindresorhus/slugify"
import { type Element, type Root } from "hast"
import omit from "lodash/omit"
import once from "lodash/once"
import { findAndReplace } from "mdast-util-find-and-replace"
import { Link2 as LinkIcon } from "react-feather"
import ReactMarkdown, {
  Components,
  Options as ReactMarkdownProps,
} from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkDirective from "remark-directive"
import remarkEmoji from "remark-emoji"
import remarkGfm from "remark-gfm"
import remarkMathPlugin from "remark-math"
import { PluggableList } from "unified"
import { visit } from "unist-util-visit"
import xxhash from "xxhashjs"

import streamlitLogo from "~lib/assets/img/streamlit-logo/streamlit-mark-color.svg"
import IsDialogContext from "~lib/components/core/IsDialogContext"
import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import StreamlitSyntaxHighlighter from "~lib/components/elements/CodeBlock/StreamlitSyntaxHighlighter"
import { StyledInlineCode } from "~lib/components/elements/CodeBlock/styled-components"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary"
import { InlineTooltipIcon } from "~lib/components/shared/TooltipIcon"
import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  convertRemToPx,
  EmotionTheme,
  getMarkdownBgColors,
  getMarkdownTextColors,
} from "~lib/theme"

import {
  StyledHeadingActionElements,
  StyledHeadingWithActionElements,
  StyledLinkIcon,
  StyledPreWrapper,
  StyledStreamlitMarkdown,
} from "./styled-components"

import "katex/dist/katex.min.css"

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

  /**
   * Inherit font family, size, and weight from parent
   */
  inheritFont?: boolean
}

/**
 * A rehype plugin to add an `inline` property to code blocks.
 * This is used to distinguish between inline code and code blocks.
 * It is needed for versions of react-markdown from v9 onwards.
 */
function rehypeSetCodeInlineProperty() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, _index, parent) => {
      if (node.tagName !== "code") {
        return
      }

      if (parent && parent.type === "element" && parent.tagName === "pre") {
        node.properties = { ...node.properties, inline: false }
      } else {
        node.properties = { ...node.properties, inline: true }
      }
    })
  }
}

/**
 * Creates a URL-friendly anchor ID from a text string.
 *
 * @param text {string | null} - The text to convert into an anchor ID. Can be null.
 * @returns A URL-safe string suitable for use as an HTML anchor ID:
 *   - If text is null or empty, returns an empty string
 *   - If text contains valid characters that can be slugified, returns a version using `@sindresorhus/slugify`
 *   - If slugification results in an empty string, falls back to an xxhash of the original text
 *
 * @example
 * createAnchorFromText("Hello World!") // Returns "hello-world"
 * createAnchorFromText("---") // Returns xxhash of "---"
 * createAnchorFromText(null) // Returns ""
 */
export function createAnchorFromText(text: string | null): string {
  if (!text) {
    return ""
  }

  /**
   * @see https://www.npmjs.com/package/@sindresorhus/slugify
   * @see https://www.npmjs.com/package/@sindresorhus/transliterate
   */
  const newAnchor = slugify(text)

  if (newAnchor.length > 0) {
    return newAnchor
  }

  // If slugify is not able to create a slug, fallback to hash
  return xxhash.h32(text, 0xabcd).toString(16)
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

const HeaderActionElements: FC<HeadingActionElements> = ({
  elementId,
  help,
  hideAnchor,
}) => {
  const theme = useEmotionTheme()
  if (!help && hideAnchor) {
    return <></>
  }

  return (
    <StyledHeadingActionElements data-testid="stHeaderActionElements">
      {help && <InlineTooltipIcon content={help} />}
      {elementId && !hideAnchor && (
        <StyledLinkIcon href={`#${elementId}`}>
          {/* Convert size to px because using rem works but logs a console error (at least on webkit) */}
          <LinkIcon size={convertRemToPx(theme.iconSizes.base)} />
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

export const HeadingWithActionElements: FC<HeadingWithActionElementsProps> = ({
  tag,
  anchor: propsAnchor,
  help,
  hideAnchor,
  children,
  tagProps,
}) => {
  const isInSidebar = useContext(IsSidebarContext)
  const isInDialog = useContext(IsDialogContext)
  const [elementId, setElementId] = useState(propsAnchor)

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node === null) {
        return
      }

      const anchor = propsAnchor || createAnchorFromText(node.textContent)
      setElementId(anchor)
      const windowHash = window.location.hash.slice(1)
      if (windowHash && windowHash === anchor) {
        scrollNodeIntoView(node)
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
  const Tag = tag
  // We nest the action-elements (tooltip, link-icon) into the header element (e.g. h1),
  // so that it appears inline. For context: we also tried setting the h's display attribute to 'inline', but
  // then we would need to add padding to the outer container and fiddle with the vertical alignment.
  const headerElementWithActions = (
    <Tag {...tagProps} {...attributes}>
      {children}
      {actionElements}
    </Tag>
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
  ReactMarkdownProps & {
    level: number
    "data-anchor"?: string
    node: Element
  }

export const CustomHeading: FC<HeadingProps> = ({
  node,
  children,
  ...rest
}) => {
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
export const CustomCodeTag: FC<CustomCodeTagProps> = ({
  inline,
  className,
  children,
  ...props
}) => {
  const match = /language-(\w+)/.exec(className || "")

  const codeText = String(children).replace(/^\n/, "").replace(/\n$/, "")

  const language = (match && match[1]) || ""
  return !inline ? (
    <StreamlitSyntaxHighlighter language={language} showLineNumbers={false}>
      {codeText}
    </StreamlitSyntaxHighlighter>
  ) : (
    <StyledInlineCode className={className} {...omit(props, "node")}>
      {children}
    </StyledInlineCode>
  )
}

/**
 * Renders pre tag with added margin.
 */
export const CustomPreTag: FC<ReactMarkdownProps> = ({ children }) => {
  return (
    <StyledPreWrapper data-testid="stMarkdownPre">{children}</StyledPreWrapper>
  )
}

export const CustomMediaTag: FC<
  JSX.IntrinsicElements["img" | "video" | "audio"] &
    ReactMarkdownProps & { node: Element }
> = ({ node, ...props }) => {
  const crossOrigin = useCrossOriginAttribute(props.src)
  const Tag = node.tagName

  const attributes = {
    ...props,
    crossOrigin,
  }
  return <Tag {...attributes} />
}

// These are common renderers that don't depend on props or context
const BASE_RENDERERS = {
  pre: CustomPreTag,
  code: CustomCodeTag,
  h1: CustomHeading,
  h2: CustomHeading,
  h3: CustomHeading,
  h4: CustomHeading,
  h5: CustomHeading,
  h6: CustomHeading,
  img: CustomMediaTag,
  video: CustomMediaTag,
  audio: CustomMediaTag,
}

/**
 * Create a color mapping based on the theme.
 * Extracted from RenderedMarkdown to reduce re-calculations.
 */
function createColorMapping(theme: EmotionTheme): Map<string, string> {
  const { red, orange, yellow, green, blue, violet, purple, gray, primary } =
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
    primarybg,
  }: Record<string, string> = getMarkdownBgColors(theme)

  return new Map(
    Object.entries({
      red: `color: ${red}`,
      orange: `color: ${orange}`,
      yellow: `color: ${yellow}`,
      blue: `color: ${blue}`,
      green: `color: ${green}`,
      violet: `color: ${violet}`,
      gray: `color: ${gray}`,
      grey: `color: ${gray}`,
      primary: `color: ${primary}`,
      // Gradient from red, orange, yellow, green, blue, violet, purple
      rainbow: `color: transparent; background-clip: text; -webkit-background-clip: text; background-image: linear-gradient(to right,
        ${red}, ${orange}, ${yellow}, ${green}, ${blue}, ${violet}, ${purple});`,
      "red-background": `background-color: ${redbg}`,
      "orange-background": `background-color: ${orangebg}`,
      "yellow-background": `background-color: ${yellowbg}`,
      "blue-background": `background-color: ${bluebg}`,
      "green-background": `background-color: ${greenbg}`,
      "violet-background": `background-color: ${violetbg}`,
      "gray-background": `background-color: ${graybg}`,
      "grey-background": `background-color: ${graybg}`,
      "primary-background": `background-color: ${primarybg}`,
      // Gradient from red, orange, yellow, green, blue, violet, purple
      "rainbow-background": `background: linear-gradient(to right,
        ${redbg}, ${orangebg}, ${yellowbg}, ${greenbg}, ${bluebg}, ${violetbg}, ${purplebg});`,
    })
  )
}

/**
 * Factory function to create the color and small text directive plugin
 */
function createRemarkColoringAndSmall(
  theme: EmotionTheme,
  colorMapping: Map<string, string>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  return () => (tree: any) => {
    visit(tree, "textDirective", (node, _index, _parent) => {
      const nodeName = String(node.name)

      // Handle small text directive (:small[])
      if (nodeName === "small") {
        const data = node.data || (node.data = {})
        data.hName = "span"
        data.hProperties = data.hProperties || {}
        data.hProperties.style = `font-size: ${theme.fontSizes.sm};`
        return
      }

      // Handle badge directives (:color-badge[])
      const badgeMatch = nodeName.match(/^(.+)-badge$/)
      if (badgeMatch && colorMapping.has(badgeMatch[1])) {
        const color = badgeMatch[1]

        // rainbow-badge is not supported because the rainbow text effect uses
        // background-clip: text with a transparent color, which conflicts with
        // having a background color for the badge.
        // We *could* support it by using a nested span structure, but that breaks
        // the material icon handling below.
        // We can support that in the future if we want to, but I think a
        // rainbow-colored badge shouldn't be a common use case anyway.
        if (color === "rainbow") {
          return
        }

        const textColor = colorMapping.get(color)
        const bgColor = colorMapping.get(`${color}-background`)

        if (textColor && bgColor) {
          const data = node.data || (node.data = {})
          data.hName = "span"
          data.hProperties = data.hProperties || {}
          data.hProperties.className = "stMarkdownBadge"
          data.hProperties.style = `${bgColor}; ${textColor}; font-size: ${theme.fontSizes.sm};`
          return
        }
      }

      // Handle color directives (:color[] or :color-background[])
      if (colorMapping.has(nodeName)) {
        const data = node.data || (node.data = {})
        const style = colorMapping.get(nodeName)
        data.hName = "span"
        data.hProperties = data.hProperties || {}
        data.hProperties.style = style
        // Add class name specific to colored text used for button hover selector
        // to override text color
        data.hProperties.className = "stMarkdownColoredText"
        // Add class for background color for custom styling
        if (
          style &&
          (/background-color:/.test(style) || /background:/.test(style))
        ) {
          data.hProperties.className = "stMarkdownColoredBackground"
        }
        return
      }

      // Handle unsupported directives
      // We convert unsupported text directives to plain text to avoid them being
      // ignored / not rendered. See https://github.com/streamlit/streamlit/issues/8726,
      // https://github.com/streamlit/streamlit/issues/5968
      node.type = "text"
      node.value = `:${nodeName}`
      node.data = {}
    })
    return tree
  }
}

/**
 * Factory function to create the material icons directive plugin
 */
function createRemarkMaterialIcons(theme: EmotionTheme) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  return () => (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    function replace(fullMatch: string, iconName: string): any {
      return {
        type: "text",
        value: fullMatch,
        data: {
          hName: "span",
          hProperties: {
            role: "img",
            ariaLabel: iconName + " icon",
            // Prevent the icon text from being translated
            // this would break the icon display in the UI.
            // https://github.com/streamlit/streamlit/issues/10168
            translate: "no",
            // We need to use string-style CSS here so that it works
            // correctly with the rehype-raw plugin.
            style: `
            display: inline-block;
            font-family: ${theme.genericFonts.iconFont};
            font-weight: ${theme.fontWeights.normal};
            user-select: none;
            vertical-align: bottom;
            white-space: nowrap;
            word-wrap: normal;
            `,
          },
          hChildren: [{ type: "text", value: iconName }],
        },
      }
    }
    // We replace all `:material/` occurrences with `:material_` to avoid
    // conflicts with the directive plugin.
    // Since all `:material/` already got replaced with `:material_`
    // within the markdown text (see below), we need to use `:material_`
    // within the regex.
    findAndReplace(tree, [[/:material_(\w+):/g, replace]])
    return tree
  }
}

/**
 * Factory function to create the streamlit logo plugin
 */
function createRemarkStreamlitLogo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  return () => (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    function replaceStreamlit(): any {
      return {
        type: "text",
        value: "",
        data: {
          hName: "img",
          hProperties: {
            src: streamlitLogo,
            alt: "Streamlit logo",
            // We need to use string-style CSS here so that it works
            // correctly with the rehype-raw plugin.
            // The base of the Streamlit logo is curved, so move it down a bit to
            // make it look aligned with the text.
            style: `display: inline-block; user-select: none; height: 0.75em; vertical-align: baseline; margin-bottom: -0.05ex;`,
          },
        },
      }
    }
    findAndReplace(tree, [[/:streamlit:/g, replaceStreamlit]])
    return tree
  }
}

/**
 * Factory function to create typographical symbols plugin
 */
function createRemarkTypographicalSymbols() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  return () => (tree: any) => {
    visit(tree, (node, _index, parent) => {
      if (
        parent &&
        (parent.type === "link" || parent.type === "linkReference")
      ) {
        // Don't replace symbols in links.
        // Note that remark extensions are not applied in code blocks and latex
        // formulas, so we don't need to worry about them here.
        return
      }

      if (node.type === "text" && node.value) {
        // Only replace symbols wrapped in spaces, so it's a bit safer in case the
        // symbols are used as part of a word or longer string of symbols.
        const replacements = [
          [/(^|\s)<->(\s|$)/g, "$1↔$2"],
          [/(^|\s)->(\s|$)/g, "$1→$2"],
          [/(^|\s)<-(\s|$)/g, "$1←$2"],
          [/(^|\s)--(\s|$)/g, "$1—$2"],
          [/(^|\s)>=(\s|$)/g, "$1≥$2"],
          [/(^|\s)<=(\s|$)/g, "$1≤$2"],
          [/(^|\s)~=(\s|$)/g, "$1≈$2"],
        ]

        let newValue = node.value
        for (const [pattern, replacement] of replacements) {
          newValue = newValue.replace(pattern, replacement as string)
        }

        if (newValue !== node.value) {
          node.value = newValue
        }
      }
    })

    return tree
  }
}

// Standard remark plugins that don't depend on theme or props
const BASE_REMARK_PLUGINS = [
  remarkMathPlugin,
  remarkEmoji,
  remarkGfm,
  remarkDirective,
  createRemarkStreamlitLogo(),
  createRemarkTypographicalSymbols(),
]

// Sets disallowed markdown for widget labels
const LABEL_DISALLOWED_ELEMENTS = [
  // Restricts table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
  // Note that images are allowed but have a max height equal to the text height
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "input",
  "hr",
  "blockquote",
]

// Add link disallowing to the base disallowed elements
const LINKS_DISALLOWED_ELEMENTS = [...LABEL_DISALLOWED_ELEMENTS, "a"]

interface LinkProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  node?: any
  children?: ReactNode
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

export const RenderedMarkdown = memo(function RenderedMarkdown({
  allowHTML,
  source,
  overrideComponents,
  isLabel,
  disableLinks,
}: Readonly<RenderedMarkdownProps>): ReactElement {
  const theme = useEmotionTheme()

  const colorMapping = useMemo(() => createColorMapping(theme), [theme])

  const remarkPlugins = useMemo(
    () => [
      ...BASE_REMARK_PLUGINS,
      createRemarkColoringAndSmall(theme, colorMapping),
      createRemarkMaterialIcons(theme),
    ],
    [theme, colorMapping]
  )

  const rehypePlugins = useMemo<PluggableList>(() => {
    const plugins: PluggableList = [rehypeKatex]

    if (allowHTML) {
      plugins.push(rehypeRaw)
    }

    // This plugin must run last to ensure the inline property is set correctly
    // and not overwritten by other plugins like rehypeRaw
    plugins.push(rehypeSetCodeInlineProperty)

    return plugins
  }, [allowHTML])

  const renderers = useMemo(
    () =>
      ({
        ...BASE_RENDERERS,
        a: LinkWithTargetBlank,
        ...(overrideComponents || {}),
      }) as Components,
    [overrideComponents]
  )

  const processedSource = useMemo(
    () => source.replaceAll(":material/", ":material_"),
    [source]
  )

  const disallowed = useMemo(() => {
    if (!isLabel) return []
    return disableLinks ? LINKS_DISALLOWED_ELEMENTS : LABEL_DISALLOWED_ELEMENTS
  }, [isLabel, disableLinks])

  return (
    <ErrorBoundary>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={renderers}
        urlTransform={transformLinkUri}
        disallowedElements={disallowed}
        // unwrap and render children from invalid markdown
        unwrapDisallowed={true}
      >
        {processedSource}
      </ReactMarkdown>
    </ErrorBoundary>
  )
})

/**
 * Wraps the <ReactMarkdown> component to include our standard
 * renderers and AST plugins (for syntax highlighting, HTML support, etc).
 */
const StreamlitMarkdown: FC<Props> = ({
  source,
  allowHTML,
  style,
  isCaption,
  isLabel,
  boldLabel,
  largerLabel,
  disableLinks,
  isToast,
  inheritFont,
}) => {
  const isInDialog = useContext(IsDialogContext)

  return (
    <StyledStreamlitMarkdown
      isCaption={Boolean(isCaption)}
      isInDialog={isInDialog}
      isLabel={isLabel}
      inheritFont={inheritFont}
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

export default memo(StreamlitMarkdown)

/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  createContext,
  CSSProperties,
  type FC,
  type HTMLProps,
  lazy,
  memo,
  type ReactElement,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react"

import slugify from "@sindresorhus/slugify"
import { type Element, type Root as HastRoot } from "hast"
import { omit, once } from "lodash-es"
import type { Root as MdastRoot, Text } from "mdast"
import { findAndReplace } from "mdast-util-find-and-replace"
import { Link2 as LinkIcon } from "react-feather"
import ReactMarkdown, {
  Components,
  Options as ReactMarkdownProps,
} from "react-markdown"
import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkMathPlugin from "remark-math"
import { PluggableList } from "unified"
import { visit } from "unist-util-visit"
import xxhash from "xxhashjs"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import streamlitLogo from "~lib/assets/img/streamlit-logo/streamlit-mark-color.svg"
import IsDialogContext from "~lib/components/core/IsDialogContext"
import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { StyledInlineCode } from "~lib/components/elements/CodeBlock/styled-components"
import { Skeleton } from "~lib/components/elements/Skeleton"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary"
import { InlineTooltipIcon } from "~lib/components/shared/TooltipIcon"
import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  convertRemToPx,
  EmotionTheme,
  getMarkdownTextColors,
  getThemeBackgroundColors,
} from "~lib/theme"

import {
  StyledHeadingActionElements,
  StyledHeadingWithActionElements,
  StyledHelpIconWrapper,
  StyledLinkIcon,
  StyledPreWrapper,
  StyledStreamlitMarkdown,
} from "./styled-components"
import {
  type EmojiPlugin,
  isLoadedPlugin,
  type KatexPlugin,
  loadKatexPlugin,
  loadKatexStyles,
  loadRehypeRaw,
  loadRemarkEmoji,
  type RawPlugin,
  type RemarkPluginFactory,
  useLazyPlugin,
  wrapRehypePlugin,
  wrapRemarkPlugin,
} from "./utils"

const StreamlitSyntaxHighlighter = lazy(
  () => import("~lib/components/elements/CodeBlock/StreamlitSyntaxHighlighter")
)

/**
 * Heuristic to determine if the markdown source contains emoji shortcodes that require remark-emoji.
 * Checks for patterns like :emoji_name: but excludes Streamlit's custom :material/ and
 * :streamlit: syntax which are handled separately.
 * Supports shortcodes with special characters like :+1:, :-1:, etc.
 *
 * @param source - The markdown source string to check
 * @returns true if emoji shortcodes are detected, false otherwise
 */
export function containsEmojiShortcodes(source: string): boolean {
  return /:(?!material\/|streamlit:)[\w+-][\w_+-]*:/.test(source)
}

/**
 * Detects if the markdown source contains math syntax that requires KaTeX.
 * Checks for inline math ($...$) and display math ($$...$$) patterns.
 * For inline math, ensures no whitespace immediately after opening $ or before closing $
 * to avoid false positives like "$5 and $10".
 *
 * @param source - The markdown source string to check
 * @returns true if math syntax is detected, false otherwise
 */
export function containsMathSyntax(source: string): boolean {
  // Detect display math: $$...$$ or inline math: $...$
  // Inline math requires non-whitespace after opening $ and before closing $
  return /\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?(?<!\s)\$/.test(source)
}

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

  /**
   * Optional help text for inline help tooltips.
   * When present, :help[] markers in the source will use this text.
   */
  helpText?: string
}

/**
 * Type for mdast text nodes that carry hast transformation data.
 * Used by mdast-util-to-hast to convert these placeholder nodes into specific HTML elements.
 * @see https://github.com/syntax-tree/mdast-util-to-hast#fields-on-nodes
 */
interface MdastTextWithHastData {
  type: "text"
  value: string
  data: {
    hName: string
    hProperties: Record<string, string>
    hChildren?: Array<{ type: string; value: string }>
  }
}

/**
 * A rehype plugin to add an `inline` property to code blocks.
 * This is used to distinguish between inline code and code blocks.
 * It is needed for versions of react-markdown from v9 onwards.
 */
function rehypeSetCodeInlineProperty() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element, _index, parent) => {
      if (node.tagName !== "code") {
        return
      }

      if (parent?.type === "element" && parent.tagName === "pre") {
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
        <StyledLinkIcon href={`#${elementId}`} aria-label="Link to heading">
          <LinkIcon
            // Convert size to px because using rem works but logs a console
            // error (at least on webkit)
            size={convertRemToPx(theme.iconSizes.base)}
            aria-hidden="true"
          />
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

  // Accessibility:
  // Headings can contain action elements (help tooltip icon, anchor link icon).
  // Those elements are rendered inside the <h*> for layout reasons, but they
  // can accidentally become part of the heading's computed accessible name.
  //
  // To keep the heading name stable (visible heading text only), we use
  // aria-labelledby to point at a span that wraps only the text content.
  //
  // We generate the label span id with useId() to ensure uniqueness even if
  // multiple headings end up sharing the same anchor slug.
  //
  // Only set aria-labelledby when action elements are present:
  // - help: tooltip icon can be present even in sidebar/dialog (where we don't
  //   set a heading id/anchor)
  // - anchor icon: only present when we have an elementId and it's not hidden
  const rawHeadingTextId = useId()
  const headingTextId =
    help || (elementId && !hideAnchor && !isInSidebarOrDialog)
      ? rawHeadingTextId
      : undefined

  const idAttribute = elementId ? { id: elementId } : {}
  const ariaLabelledbyAttribute = headingTextId
    ? { "aria-labelledby": headingTextId }
    : {}
  const mergedAttributes = {
    ...(isInSidebarOrDialog ? {} : { ref, ...idAttribute }),
    ...ariaLabelledbyAttribute,
  }
  const Tag = tag
  // We nest the action-elements (tooltip, link-icon) into the header element (e.g. h1),
  // so that it appears inline. For context: we also tried setting the h's display attribute to 'inline', but
  // then we would need to add padding to the outer container and fiddle with the vertical alignment.
  const headerElementWithActions = (
    <Tag {...tagProps} {...mergedAttributes}>
      {headingTextId ? <span id={headingTextId}>{children}</span> : children}
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

  /**
   * Optional help text for inline help tooltips.
   * When present, :help[] markers in the source will use this text.
   */
  helpText?: string
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

  const codeText = String(children ?? "")
    .replace(/^\n/, "")
    .replace(/\n$/, "")

  const language = match?.[1] || ""
  return !inline ? (
    <ErrorBoundary>
      <Suspense
        fallback={
          <Skeleton
            element={SkeletonProto.create({
              style: SkeletonProto.SkeletonStyle.ELEMENT,
            })}
          />
        }
      >
        <StreamlitSyntaxHighlighter
          language={language}
          showLineNumbers={false}
        >
          {codeText}
        </StreamlitSyntaxHighlighter>
      </Suspense>
    </ErrorBoundary>
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

const HelpTextContext = createContext<string | undefined>(undefined)
HelpTextContext.displayName = "HelpTextContext"

interface CustomHelpIconProps {
  children?: string
}

/**
 * Custom component to render inline help icons in markdown.
 * Wraps InlineTooltipIcon in an inline-block span for proper inline flow.
 *
 * Gets the help text from HelpTextContext (used by the `help` parameter) if available,
 * or falls back to `children` (for manual :help[content] directive usage).
 *
 * Note: When using the :help[content] directive manually in markdown, be aware of
 * text directive limitations:
 * - Newlines (\n) are not supported - use context via the help parameter instead
 * - Brackets [, ] and other special markdown characters may cause parsing issues
 * - For reliable multiline or complex markdown in tooltips, use the help parameter
 *   which passes content via context and avoids directive label limitations.
 */
export const CustomHelpIcon: FC<CustomHelpIconProps> = ({ children }) => {
  // Prefer context (from help parameter) over children (from directive label)
  const contextHelpText = useContext(HelpTextContext)
  const tooltipContent =
    contextHelpText || (typeof children === "string" ? children : "")

  return (
    <StyledHelpIconWrapper>
      <InlineTooltipIcon content={tooltipContent} />
    </StyledHelpIconWrapper>
  )
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
  "streamlit-help-icon": CustomHelpIcon,
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
  }: Record<string, string> = getThemeBackgroundColors(theme)

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
 * Factory function to create the help icon directive plugin
 */
function createRemarkHelpIcon() {
  return () => (tree: MdastRoot) => {
    visit(tree, "textDirective", (node, _index, _parent) => {
      const nodeName = String(node.name)

      // Handle help icon directive (:help[tooltip content])
      if (nodeName === "help") {
        const data = node.data || (node.data = {})
        data.hName = "streamlit-help-icon"
        data.hProperties = data.hProperties || {}
        // Pass the children through so CustomHelpIcon can extract the content
        return
      }
    })

    return tree
  }
}

/**
 * Factory function to create the color and small text directive plugin
 */
function createRemarkColoringAndSmall(
  theme: EmotionTheme,
  colorMapping: Map<string, string>
) {
  return () => (tree: MdastRoot) => {
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
    })
    return tree
  }
}

/**
 * Factory function to create the unsupported directives cleanup plugin.
 * This plugin should run last to convert any unsupported text directives
 * to plain text, ensuring they are rendered rather than ignored.
 */
function createRemarkUnsupportedDirectivesCleanup(): () => (
  tree: MdastRoot
) => MdastRoot {
  return () => (tree: MdastRoot) => {
    visit(tree, "textDirective", (node, index, parent) => {
      // Convert unsupported text directives to plain text to avoid them being
      // ignored / not rendered. See https://github.com/streamlit/streamlit/issues/8726,
      // https://github.com/streamlit/streamlit/issues/5968
      // Don't convert if the directive was already handled by another plugin
      if (!node.data?.hName && parent && index !== undefined) {
        const textNode: Text = {
          type: "text",
          value: `:${node.name}`,
        }
        parent.children[index] = textNode
      }
    })
    return tree
  }
}

/**
 * Factory function to create the material icons directive plugin
 */
function createRemarkMaterialIcons(theme: EmotionTheme) {
  return () => (tree: MdastRoot) => {
    function replace(
      fullMatch: string,
      iconName: string
    ): MdastTextWithHastData {
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
    findAndReplace(tree, [
      [
        /:material_(\w+):/g,
        replace as (fullMatch: string, iconName: string) => Text,
      ],
    ])
    return tree
  }
}

/**
 * Factory function to create the streamlit logo plugin
 */
function createRemarkStreamlitLogo() {
  return () => (tree: MdastRoot) => {
    function replaceStreamlit(): MdastTextWithHastData {
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
    findAndReplace(tree, [[/:streamlit:/g, replaceStreamlit as () => Text]])
    return tree
  }
}

/**
 * Factory function to create typographical symbols plugin
 */
function createRemarkTypographicalSymbols() {
  return () => (tree: MdastRoot) => {
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
// Note: remarkEmoji is lazy-loaded and added conditionally when emoji shortcodes are detected
const BASE_REMARK_PLUGINS = [
  remarkMathPlugin,
  remarkGfm,
  remarkDirective,
  createRemarkHelpIcon(),
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
  node?: Element
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
  if (href?.startsWith("#")) {
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
  helpText,
}: Readonly<RenderedMarkdownProps>): ReactElement {
  const theme = useEmotionTheme()

  const needsKatex = useMemo(() => containsMathSyntax(source), [source])
  const needsEmoji = useMemo(() => containsEmojiShortcodes(source), [source])

  // Lazy load plugins only when needed
  const katexPlugin = useLazyPlugin<KatexPlugin>({
    key: "katex",
    needed: needsKatex,
    load: loadKatexPlugin,
    pluginName: "rehype-katex",
    onBeforeLoad: loadKatexStyles,
  })

  const rawPlugin = useLazyPlugin<RawPlugin>({
    key: "raw",
    needed: allowHTML,
    load: loadRehypeRaw,
    pluginName: "rehype-raw",
  })

  const emojiPlugin = useLazyPlugin<EmojiPlugin>({
    key: "emoji",
    needed: needsEmoji,
    load: loadRemarkEmoji,
    pluginName: "remark-emoji",
  })

  const colorMapping = useMemo(() => createColorMapping(theme), [theme])

  // Wrap plugins once when they load, not on every render or when other deps change
  const wrappedKatexPlugin = useMemo(
    () =>
      isLoadedPlugin(katexPlugin)
        ? wrapRehypePlugin(katexPlugin, "rehype-katex")
        : null,
    [katexPlugin]
  )

  const wrappedRawPlugin = useMemo(
    () =>
      isLoadedPlugin(rawPlugin)
        ? wrapRehypePlugin(rawPlugin, "rehype-raw")
        : null,
    [rawPlugin]
  )

  const wrappedEmojiPlugin = useMemo(
    () =>
      isLoadedPlugin(emojiPlugin)
        ? // Cast needed: unified's Plugin type is more complex than our RemarkPluginFactory wrapper
          wrapRemarkPlugin(emojiPlugin as RemarkPluginFactory, "remark-emoji")
        : null,
    [emojiPlugin]
  )

  const remarkPlugins = useMemo<PluggableList>(() => {
    const plugins: PluggableList = [
      ...BASE_REMARK_PLUGINS,
      createRemarkColoringAndSmall(theme, colorMapping),
      createRemarkMaterialIcons(theme),
    ]

    if (needsEmoji && wrappedEmojiPlugin) {
      plugins.push(wrappedEmojiPlugin)
    }

    // This plugin must run last to clean up any unsupported directives
    plugins.push(createRemarkUnsupportedDirectivesCleanup())

    return plugins
  }, [theme, colorMapping, needsEmoji, wrappedEmojiPlugin])

  const rehypePlugins = useMemo<PluggableList>(() => {
    const plugins: PluggableList = []

    if (needsKatex && wrappedKatexPlugin) {
      plugins.push(wrappedKatexPlugin)
    }

    if (allowHTML && wrappedRawPlugin) {
      plugins.push(wrappedRawPlugin)
    }

    // This plugin must run last to ensure the inline property is set correctly
    // and not overwritten by other plugins like rehypeRaw
    plugins.push(rehypeSetCodeInlineProperty)

    return plugins
  }, [allowHTML, needsKatex, wrappedKatexPlugin, wrappedRawPlugin])

  const renderers = useMemo(
    () =>
      ({
        ...BASE_RENDERERS,
        a: LinkWithTargetBlank,
        ...(overrideComponents || {}),
      }) as Components,
    [overrideComponents]
  )

  const processedSource = useMemo(() => {
    // Replace :material/ with :material_ to avoid conflicts with the directive plugin.
    // The material icon regex in createMaterialIconPlugin uses :material_ to match.
    let processed = source.replaceAll(":material/", ":material_")

    if (isLabel) {
      // Escape markdown syntax that would be stripped in labels, leaving empty content.
      // See: https://github.com/streamlit/streamlit/issues/7359
      //
      // Escapes: "- item", "+ item", "* item", "# heading", "> quote"
      // Does not escape: "not-a-list", "#hashtag", "1.5" (no space after marker)
      //
      // Unordered lists (-, +, *), headings (#), and blockquotes (>)
      // Note: > doesn't need lookahead (always a blockquote), others need (?=\s|$)
      processed = processed.replace(
        /^(\s*)((?:[+\-*]|#+)(?=\s|$)|>)/gm,
        "$1\\$2"
      )
      // Ordered lists (1., 2., etc.): escape only the punctuation, not the digits
      processed = processed.replace(/^(\s*)(\d+)([.)])(?=\s|$)/gm, "$1$2\\$3")
    }

    return processed
  }, [source, isLabel])

  const disallowed = useMemo(() => {
    if (!isLabel) return []
    return disableLinks ? LINKS_DISALLOWED_ELEMENTS : LABEL_DISALLOWED_ELEMENTS
  }, [isLabel, disableLinks])

  // Show skeleton while required plugins are still loading
  // A plugin is "loading" if it's needed but state is still null (not loaded, not failed)
  const isLoadingPlugins =
    (needsKatex && katexPlugin === null) ||
    (allowHTML && rawPlugin === null) ||
    (needsEmoji && emojiPlugin === null)

  if (isLoadingPlugins) {
    return (
      <ErrorBoundary>
        <Skeleton
          element={SkeletonProto.create({
            style: SkeletonProto.SkeletonStyle.ELEMENT,
          })}
        />
      </ErrorBoundary>
    )
  }

  return (
    <HelpTextContext.Provider value={helpText}>
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
    </HelpTextContext.Provider>
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
  helpText,
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
        helpText={helpText}
      />
    </StyledStreamlitMarkdown>
  )
}

export default memo(StreamlitMarkdown)

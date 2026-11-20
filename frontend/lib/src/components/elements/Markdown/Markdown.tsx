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

import { memo, type ReactElement } from "react"

import { Markdown as MarkdownProto } from "@streamlit/protobuf"

import { translateGapWidth } from "~lib/components/core/Block/styled-components"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { convertRemToEm } from "~lib/components/shared/StreamlitMarkdown/styled-components"
import { StyledLabelHelpWrapper } from "~lib/components/shared/TooltipIcon/styled-components"
import { InlineTooltipIcon } from "~lib/components/shared/TooltipIcon/TooltipIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useLabelTitleTooltip } from "~lib/hooks/useLabelTitleTooltip"

import { StyledMarkdownTitleTarget } from "./styled-components"

export interface MarkdownProps {
  element: MarkdownProto
}

// Regex matching a single badge (e.g. ":blue-badge[Label]"), supporting escaped
// brackets and backslashes in the label text via inner pattern (?:\\.|[^\]\\])*.
// Matches: :blue-badge[Label], :red-badge[Bracket\]], :green-badge[Backslash\\]
// Does not match: :blue-badge[Label] text, :blue-badge[Label] :grey-badge[Label]
const SINGLE_BADGE_REGEX = /^:\w+-badge\[((?:\\.|[^\]\\])*)\]$/

// A markdown body that is only a thematic break of three or more `-`, `*`, or
// `_`, optionally separated by spaces or tabs (e.g. `---` or `* * *`).
const STANDALONE_HORIZONTAL_RULE_REGEX =
  /^(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/

/**
 * True when the element renders only a horizontal rule: `st.divider()` or a
 * markdown body that is just a thematic break (e.g. `st.write("---")`).
 * `wrap=False` markdown is inline-only, so it never counts as a rule.
 */
function isStandaloneDivider(
  element: MarkdownProto,
  trimmedBody: string
): boolean {
  return (
    element.elementType === MarkdownProto.Type.DIVIDER ||
    (element.elementType === MarkdownProto.Type.NATIVE &&
      element.wrap !== false &&
      STANDALONE_HORIZONTAL_RULE_REGEX.test(trimmedBody))
  )
}

/**
 * Functional element representing Markdown formatted text.
 */
function Markdown({ element }: Readonly<MarkdownProps>): ReactElement {
  const theme = useEmotionTheme()
  const {
    allowHtml,
    body,
    elementType,
    help,
    hideAnchors,
    unterminatedParsing,
  } = element

  const isCaption = elementType === MarkdownProto.Type.CAPTION
  const isLatex = elementType === MarkdownProto.Type.LATEX
  const trimmedBody = body.trim()
  const isStandaloneRuleBody = isStandaloneDivider(element, trimmedBody)
  // wrap=false ellipsizes. Latex and st.divider never truncate: clipping
  // would hide formulas and horizontal rules. Native wrap=False markdown is
  // never a standalone rule, so this is the DIVIDER element type only.
  const isDividerElement = elementType === MarkdownProto.Type.DIVIDER
  const truncate = element.wrap === false && !isLatex && !isDividerElement

  // Determine if the markdown is a single badge only
  const isSingleBadgeOnly =
    elementType === MarkdownProto.Type.NATIVE &&
    SINGLE_BADGE_REGEX.test(trimmedBody)

  const { titleRef, labelTextRef } = useLabelTitleTooltip(truncate, body)

  // Put help in the markdown source only when it can sit inline without being
  // clipped by truncation. Otherwise render the help icon as a sibling.
  const shouldInlineHelpDirective =
    Boolean(help) && !truncate && !isSingleBadgeOnly && !isLatex && !allowHtml
  // Inline help appends `:help[]`, which turns `---` into a paragraph.
  // A sibling help icon (`unsafe_allow_html`) leaves the rule intact.
  const isDivider = isStandaloneRuleBody && !shouldInlineHelpDirective
  const source = shouldInlineHelpDirective ? `${body} :help[]` : body
  // Use em so named gaps scale with the markdown font, like the default
  // 2em rule margin.
  const dividerGap =
    isDividerElement && element.gapConfig
      ? convertRemToEm(translateGapWidth(element.gapConfig, theme))
      : undefined

  const streamlitMarkdown = (
    <StreamlitMarkdown
      isCaption={isCaption}
      source={source}
      allowHTML={allowHtml}
      helpText={shouldInlineHelpDirective ? help : undefined}
      unterminatedParsing={unterminatedParsing}
      hideAnchors={hideAnchors}
      // Label mode keeps inline-only markdown so the text can ellipsize on
      // one line. Inherit the parent font so markdown does not shrink to
      // widget-label size; captions already use the smaller font.
      isLabel={truncate}
      truncate={truncate}
      inheritFont={truncate && !isCaption}
      isDivider={isDivider}
      dividerGap={dividerGap}
    />
  )
  // Title lives on this box (not the outer .stMarkdown) so a sibling help
  // icon is not a titled descendant. The inner display:contents span lets
  // the hook read plain text without adding a box. Omit both unless
  // truncating so inline colored spans remain the first <span>.
  const markdown = truncate ? (
    <StyledMarkdownTitleTarget ref={titleRef}>
      <span ref={labelTextRef} style={{ display: "contents" }}>
        {streamlitMarkdown}
      </span>
    </StyledMarkdownTitleTarget>
  ) : (
    streamlitMarkdown
  )

  let content: ReactElement
  if (help && isSingleBadgeOnly && !truncate) {
    // Hover-on-badge tooltip. A long chip ellipsizes via maxWidth/minWidth
    // on the tooltip trigger rather than stretching the hover target to the
    // full element width.
    content = (
      <BaseButtonTooltip help={help} containerWidth={false} constrainWidth>
        {markdown}
      </BaseButtonTooltip>
    )
  } else {
    // Keep the help icon outside truncated text so it is not clipped.
    // For LaTeX and raw HTML, a trailing :help[] directive would also break
    // rendering (gh-15211).
    content = (
      <StyledLabelHelpWrapper isLatex={isLatex}>
        {markdown}
        {help && (isLatex || allowHtml || truncate) && (
          <InlineTooltipIcon content={help} isLatex={isLatex} />
        )}
      </StyledLabelHelpWrapper>
    )
  }

  return (
    <div className="stMarkdown" data-testid="stMarkdown">
      {content}
    </div>
  )
}

export default memo(Markdown)

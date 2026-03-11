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

import { memo, ReactElement } from "react"

import { Markdown as MarkdownProto } from "@streamlit/protobuf"

import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledLabelHelpWrapper } from "~lib/components/shared/TooltipIcon/styled-components"
import { InlineTooltipIcon } from "~lib/components/shared/TooltipIcon/TooltipIcon"

export interface MarkdownProps {
  element: MarkdownProto
}

// Regex matching a single badge (e.g. ":blue-badge[Label]"), supporting escaped
// brackets and backslashes in the label text via inner pattern (?:\\.|[^\]\\])*.
// Matches: :blue-badge[Label], :red-badge[Bracket\]], :green-badge[Backslash\\]
// Does not match: :blue-badge[Label] text, :blue-badge[Label] :grey-badge[Label]
const SINGLE_BADGE_REGEX = /^:\w+-badge\[((?:\\.|[^\]\\])*)\]$/

/**
 * Functional element representing Markdown formatted text.
 */
function Markdown({ element }: Readonly<MarkdownProps>): ReactElement {
  const { allowHtml, body, elementType, help } = element

  const isCaption = elementType === MarkdownProto.Type.CAPTION
  const isLatex = elementType === MarkdownProto.Type.LATEX

  // Determine if the markdown is a single badge only
  const isSingleBadgeOnly =
    elementType === MarkdownProto.Type.NATIVE &&
    SINGLE_BADGE_REGEX.test(body.trim())

  let content: ReactElement
  if (help && isSingleBadgeOnly) {
    // For single badge markdown with help, show the BaseButtonTooltip
    content = (
      <BaseButtonTooltip help={help} containerWidth={false}>
        <StreamlitMarkdown
          isCaption={isCaption}
          source={body}
          allowHTML={allowHtml}
        />
      </BaseButtonTooltip>
    )
  } else if (help && isLatex) {
    // For LaTeX with help, use the inline tooltip icon. Adding a directive
    // breaks the LaTeX rendering, and we don't support text alignment for LaTeX.
    content = (
      <StyledLabelHelpWrapper isLatex={isLatex}>
        <StreamlitMarkdown
          isCaption={isCaption}
          source={body}
          allowHTML={allowHtml}
        />
        <InlineTooltipIcon content={help} isLatex={isLatex} />
      </StyledLabelHelpWrapper>
    )
  } else {
    // For other markdown, render with inline help icon
    // Use :help[] as a marker where the help icon should appear.
    // The actual help text is passed via helpText prop to avoid limitations
    // with special characters in text directive labels.
    const source = help ? `${body} :help[]` : body

    content = (
      <StyledLabelHelpWrapper isLatex={isLatex}>
        <StreamlitMarkdown
          isCaption={isCaption}
          source={source}
          allowHTML={allowHtml}
          helpText={help}
        />
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

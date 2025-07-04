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

import React, { memo, ReactElement } from "react"

import { Markdown as MarkdownProto } from "@streamlit/protobuf"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import {
  InlineTooltipIcon,
  StyledLabelHelpWrapper,
} from "~lib/components/shared/TooltipIcon"

export interface MarkdownProps {
  help?: string
  element: MarkdownProto
}

/**
 * Functional element representing Markdown formatted text.
 */
function Markdown({ element }: Readonly<MarkdownProps>): ReactElement {
  return (
    <div className="stMarkdown" data-testid="stMarkdown">
      {element.help ? (
        <StyledLabelHelpWrapper
          isLatex={element.elementType === MarkdownProto.Type.LATEX}
        >
          <StreamlitMarkdown
            isCaption={element.isCaption}
            source={element.body}
            allowHTML={element.allowHtml}
          />
          <InlineTooltipIcon
            content={element.help}
            isLatex={element.elementType === MarkdownProto.Type.LATEX}
          ></InlineTooltipIcon>
        </StyledLabelHelpWrapper>
      ) : (
        <StreamlitMarkdown
          isCaption={element.isCaption}
          source={element.body}
          allowHTML={element.allowHtml}
        />
      )}
    </div>
  )
}

export default memo(Markdown)

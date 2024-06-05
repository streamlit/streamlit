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

import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import React, { ReactElement } from "react"
import { Markdown as MarkdownProto } from "@streamlit/lib/src/proto"
import ToolbarContext from "@streamlit/lib/src/components/core/ToolbarContext"
import {
  InlineTooltipIcon,
  StyledLabelHelpWrapper,
} from "@streamlit/lib/src/components/shared/TooltipIcon"

export interface MarkdownProps {
  width: number
  help?: string
  element: MarkdownProto
}

/**
 * Functional element representing Markdown formatted text.
 */
export default function Markdown({
  width,
  element,
}: MarkdownProps): ReactElement {
  const styleProp = { width }

  const toolbar = React.useContext(ToolbarContext)
  const textDecoder = new TextDecoder("utf-8")

  return (
    <div className="stMarkdown" style={styleProp} data-testid="stMarkdown">
      {element.help ? (
        <StyledLabelHelpWrapper>
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
      {toolbar && (
        <div>
          {toolbar.elements.map(toolbarElement => {
            const label =
              (toolbarElement.label &&
                textDecoder.decode(toolbarElement.label)) ??
              ""
            const icon =
              toolbarElement.icon && textDecoder.decode(toolbarElement.icon)
            return (
              <button
                key={label}
                title={label}
                onClick={() => toolbar.onElementClick(label)}
              >
                {icon}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

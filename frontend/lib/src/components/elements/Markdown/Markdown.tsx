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

import React, { ReactElement, useEffect, useRef } from "react"

import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { Markdown as MarkdownProto } from "@streamlit/lib/src/proto"
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
}: Readonly<MarkdownProps>): ReactElement {
  const styleProp = { width }
  const markdownRef = useRef<HTMLDivElement>(null)

  const applyCenterAlignment = () => {
    if (markdownRef.current) {
      const emotionDivs = markdownRef.current.querySelectorAll('.st-emotion-cache');

      emotionDivs.forEach((div) => {
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
      });
    }
  };

  useEffect(() => {
    applyCenterAlignment();
  }, [element.body]);

  return (
    <div className="stMarkdown" data-testid="stMarkdown" style={styleProp} ref={markdownRef}>
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
    </div>
  )
}

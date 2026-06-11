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

import { ReactElement, useCallback, useState } from "react"

import { Close } from "@emotion-icons/material-rounded"
import { type QueuedToast } from "react-aria-components/Toast"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"

import {
  StyledCloseButton,
  StyledMessageWrapper,
  StyledToast,
  StyledToastWrapper,
  StyledViewButton,
} from "./styled-components"
import { type StreamlitToastContent } from "./toastQueue"
import { shortenMessage } from "./utils"

export function StreamlitToastItem({
  toast,
}: {
  toast: QueuedToast<StreamlitToastContent>
}): ReactElement {
  const { body, icon } = toast.content
  const displayMessage = shortenMessage(body)
  const shortened = body !== displayMessage
  const [expanded, setExpanded] = useState(!shortened)
  const handleToggle = useCallback(() => setExpanded(v => !v), [])

  return (
    <StyledToast toast={toast} data-testid="stToast" className="stToast">
      <StyledToastWrapper>
        {icon && (
          <DynamicIcon
            iconValue={icon}
            size="xl"
            testid="stToastDynamicIcon"
          />
        )}
        <StyledMessageWrapper>
          <StreamlitMarkdown
            source={expanded ? body : displayMessage}
            allowHTML={false}
            isToast
          />
          {shortened && (
            <StyledViewButton
              data-testid="stToastViewButton"
              onClick={handleToggle}
            >
              {expanded ? "view less" : "view more"}
            </StyledViewButton>
          )}
        </StyledMessageWrapper>
      </StyledToastWrapper>
      <StyledCloseButton slot="close" aria-label="Close">
        <Icon content={Close} size="md" />
      </StyledCloseButton>
    </StyledToast>
  )
}

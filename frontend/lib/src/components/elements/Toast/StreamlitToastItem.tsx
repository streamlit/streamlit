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
  ReactElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { Close } from "@emotion-icons/material-rounded"
import { type QueuedToast } from "react-aria-components/Toast"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"

import {
  StyledClampedText,
  StyledCloseButton,
  StyledMessageWrapper,
  StyledToast,
  StyledToastWrapper,
  StyledViewButton,
} from "./styled-components"
import { type StreamlitToastContent } from "./toastQueue"

export function StreamlitToastItem({
  toast,
}: {
  toast: QueuedToast<StreamlitToastContent>
}): ReactElement {
  const { body, icon } = toast.content
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = textRef.current
    if (el) {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
      const maxVisibleHeight = lineHeight * 3 + 1
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Batched with the getComputedStyle read above.
      setIsOverflowing(el.scrollHeight > maxVisibleHeight)
    }
    // Omit expanded: re-measuring while CSS clamping is active causes WebKit
    // to report a clipped scrollHeight.
  }, [body])

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
          <StyledClampedText
            ref={textRef}
            clamped={isOverflowing && !expanded}
            data-testid="stToastText"
          >
            <StreamlitMarkdown source={body} allowHTML={false} isToast />
          </StyledClampedText>
          {isOverflowing && (
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

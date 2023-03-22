/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { ReactElement, useState, useEffect } from "react"
import { withTheme } from "@emotion/react"
import { toaster, ToasterContainer, PLACEMENT } from "baseui/toast"

import { Theme } from "src/theme"
import withHostCommunication, {
  HostCommunicationHOC,
} from "src/hocs/withHostCommunication"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"

import {
  toastColoration,
  StyledViewButton,
  StyledToastMessage,
} from "./styled-components"

export interface ToastProps {
  hostCommunication: HostCommunicationHOC
  theme: Theme
  text: string
  icon?: string
  type: string
}

function shortenMessage(text: string): string {
  const threeLineCharcterCount = 120
  let checkedText = text
  if (text.length > threeLineCharcterCount) {
    checkedText = text.replace(/^(.{120}[^\s]*).*/, "$1")
  }
  return checkedText
}

function generateToastStyleOverrides(toastType: string, theme: Theme): object {
  return {
    overrides: {
      Body: {
        style: {
          width: "288px",
          marginTop: "8px",
          borderRadius: "4px",
          ...toastColoration(toastType, theme),
        },
      },
    },
  }
}

export function Toast({
  hostCommunication,
  theme,
  text,
  icon,
  type,
}: ToastProps): ReactElement {
  const fullMessage = icon ? `${icon}&ensp;${text}` : text
  const displayMessage = shortenMessage(fullMessage)
  const shortened = fullMessage !== displayMessage

  const [expanded, setExpanded] = useState(!shortened)
  const [toastKey, setToastKey] = useState<React.Key>(1000)

  function handleClick(): void {
    setExpanded(!expanded)
  }

  function toastContent(): ReactElement {
    return (
      <>
        <StyledToastMessage expanded={expanded}>
          <StreamlitMarkdown
            source={expanded ? fullMessage : displayMessage}
            allowHTML={false}
            isToast
          />
        </StyledToastMessage>
        {shortened && (
          <StyledViewButton onClick={handleClick}>
            {expanded ? "view less" : "view more"}
          </StyledViewButton>
        )}
      </>
    )
  }

  function createToast(): void {
    const content = toastContent()
    const styleOverrides = generateToastStyleOverrides(type, theme)

    let key
    if (type === "success") {
      key = toaster.positive(content, styleOverrides)
    } else if (type === "warning") {
      key = toaster.warning(content, styleOverrides)
    } else if (type === "error") {
      key = toaster.negative(content, styleOverrides)
    } else {
      key = toaster.info(content, styleOverrides)
    }
    setToastKey(key)
  }

  useEffect(() => {
    createToast()
  }, [])

  useEffect(() => {
    const content = toastContent()
    toaster.update(toastKey, { children: content })
  }, [expanded, theme])

  const streamlitCloud = hostCommunication.currentState.isOwner

  return (
    <ToasterContainer
      placement={PLACEMENT.bottomRight}
      autoHideDuration={4000}
      overrides={{
        Root: {
          style: () => ({
            // If deployed in Community Cloud, move toasts up to avoid blocking Manage App button
            bottom: streamlitCloud ? "45px" : "0px",
          }),
        },
        ToastCloseIcon: {
          style: () => ({
            color: theme.colors.bodyText,
            marginLeft: "5px",
            width: "1.2rem",
            height: "1.2rem",
          }),
        },
      }}
    />
  )
}

export default withHostCommunication(withTheme(Toast))

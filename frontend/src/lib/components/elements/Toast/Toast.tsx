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

import React, { ReactElement, useState, useEffect, useCallback } from "react"
import { withTheme } from "@emotion/react"
import { toaster, ToastOverrides } from "baseui/toast"

import { EmotionTheme } from "src/lib/theme"

import StreamlitMarkdown from "src/lib/components/shared/StreamlitMarkdown"

import {
  toastColoration,
  StyledViewButton,
  StyledToastMessage,
} from "./styled-components"

export interface ToastProps {
  theme: EmotionTheme
  text: string
  icon?: string
  type: string
}

function generateToastOverrides(
  expanded: boolean,
  toastType: string,
  theme: EmotionTheme
): ToastOverrides {
  return {
    Body: {
      props: {
        "data-testid": "stToast",
      },
      style: {
        width: "288px",
        marginTop: "8px",
        borderRadius: "4px",
        ...toastColoration(toastType, theme),
      },
    },
    InnerContainer: {
      style: {
        maxHeight: expanded ? "none" : "88px",
        overflow: "hidden",
        fontSize: theme.fontSizes.sm,
        lineHeight: "1.4rem",
      },
    },
    CloseIcon: {
      style: {
        color: theme.colors.bodyText,
        marginLeft: "5px",
        width: "1.2rem",
        height: "1.2rem",
      },
    },
  }
}

function shortenMessage(fullMessage: string): string {
  const characterLimit = 114

  if (fullMessage.length > characterLimit) {
    let message = fullMessage.replace(/^(.{114}[^\s]*).*/, "$1")

    if (message.length > characterLimit) {
      message = message.split(" ").slice(0, -1).join(" ")
    }

    return message
  }

  return fullMessage
}

export function Toast({ theme, text, icon, type }: ToastProps): ReactElement {
  const fullMessage = icon ? `${icon}&ensp;${text}` : text
  const displayMessage = shortenMessage(fullMessage)
  const shortened = fullMessage !== displayMessage

  const [expanded, setExpanded] = useState(!shortened)
  const [toastKey, setToastKey] = useState<React.Key>(0)

  const handleClick = useCallback((): void => {
    setExpanded(!expanded)
  }, [expanded])

  const toastContent = useCallback((): ReactElement => {
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
          <StyledViewButton className="toastViewButton" onClick={handleClick}>
            {expanded ? "view less" : "view more"}
          </StyledViewButton>
        )}
      </>
    )
  }, [shortened, expanded, displayMessage, fullMessage, handleClick])

  function createToast(): React.Key {
    const content = toastContent()
    const styleOverrides = generateToastOverrides(expanded, type, theme)

    let key
    if (type === "success") {
      key = toaster.positive(content, { overrides: { ...styleOverrides } })
    } else if (type === "warning") {
      key = toaster.warning(content, { overrides: { ...styleOverrides } })
    } else if (type === "error") {
      key = toaster.negative(content, { overrides: { ...styleOverrides } })
    } else {
      key = toaster.info(content, { overrides: { ...styleOverrides } })
    }
    setToastKey(key)
    return key
  }

  useEffect(() => {
    const key = createToast()

    return () => {
      // Disable transition so toast doesn't flicker on removal
      toaster.update(key, {
        overrides: { Body: { style: { transitionDuration: 0 } } },
      })
      // Remove the toast on unmount
      toaster.clear(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const content = toastContent()
    const styleOverrides = generateToastOverrides(expanded, type, theme)

    toaster.update(toastKey, {
      children: content,
      overrides: { ...styleOverrides },
    })
  }, [toastContent, toastKey, type, expanded, theme])

  return <></>
}

export default withTheme(Toast)

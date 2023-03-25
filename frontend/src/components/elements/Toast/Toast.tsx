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
import { toaster, ToastOverrides } from "baseui/toast"

import { Theme } from "src/theme"

import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"

import {
  toastColoration,
  StyledViewButton,
  StyledToastMessage,
} from "./styled-components"

export interface ToastProps {
  theme: Theme
  text: string
  icon?: string
  type: string
}

function shortenMessage(icon: string | undefined, text: string): string {
  let characterLimit = 110
  const adjustment = icon ? 0 : 6
  characterLimit += adjustment
  if (text.length > characterLimit) {
    return text.replace(/^(.{120}[^\s]*).*/, "$1")
  }
  return text
}

function generateToastOverrides(
  expanded: boolean,
  toastType: string,
  theme: Theme
): ToastOverrides {
  return {
    Body: {
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

export function Toast({ theme, text, icon, type }: ToastProps): ReactElement {
  const fullMessage = icon ? `${icon}&ensp;${text}` : text
  const displayMessage = shortenMessage(icon, fullMessage)
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
          <StreamlitMarkdown source={fullMessage} allowHTML={false} isToast />
        </StyledToastMessage>
        {shortened && (
          <StyledViewButton onClick={handleClick}>
            {expanded ? "view less" : "view more"}
          </StyledViewButton>
        )}
      </>
    )
  }

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
    createToast()

    // Remove the toast on unmount
    // return () => {
    //   toaster.clear(key)
    // }
  }, [])

  useEffect(() => {
    const content = toastContent()
    const styleOverrides = generateToastOverrides(expanded, type, theme)

    toaster.update(toastKey, {
      children: content,
      overrides: { ...styleOverrides },
    })
  }, [expanded, theme])

  return <></>
}

export default withTheme(Toast)

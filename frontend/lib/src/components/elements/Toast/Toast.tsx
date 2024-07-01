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

import React, {
  ReactElement,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react"
import { withTheme } from "@emotion/react"
import { toaster, ToastOverrides } from "baseui/toast"

import {
  hasLightBackgroundColor,
  EmotionTheme,
} from "@streamlit/lib/src/theme"

import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { Kind } from "@streamlit/lib/src/components/shared/AlertContainer"
import AlertElement from "@streamlit/lib/src/components/elements/AlertElement/AlertElement"

import {
  StyledViewButton,
  StyledToastWrapper,
  StyledMessageWrapper,
} from "./styled-components"
import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"

export interface ToastProps {
  theme: EmotionTheme
  body: string
  icon?: string
  width: number
}

function generateToastOverrides(theme: EmotionTheme): ToastOverrides {
  const lightBackground = hasLightBackgroundColor(theme)
  return {
    Body: {
      props: {
        "data-testid": "stToast",
      },
      style: {
        display: "flex",
        flexDirection: "row",
        gap: theme.spacing.md,
        width: theme.sizes.sidebar,
        marginTop: "8px",
        // Warnings logged if you use shorthand property here:
        borderTopLeftRadius: theme.radii.default,
        borderTopRightRadius: theme.radii.default,
        borderBottomLeftRadius: theme.radii.default,
        borderBottomRightRadius: theme.radii.default,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        paddingLeft: theme.spacing.twoXL,
        paddingRight: theme.spacing.twoXL,
        backgroundColor: lightBackground
          ? theme.colors.gray10
          : theme.colors.gray90,
        color: theme.colors.bodyText,
        // Take standard BaseWeb shadow and adjust for dark backgrounds
        boxShadow: lightBackground
          ? "0px 4px 16px rgba(0, 0, 0, 0.16)"
          : "0px 4px 16px rgba(0, 0, 0, 0.7)",
      },
    },
    CloseIcon: {
      style: {
        color: theme.colors.fadedText40,
        width: theme.fontSizes.lg,
        height: theme.fontSizes.lg,
        marginRight: `calc(-1 * ${theme.spacing.lg} / 2)`,
        ":hover": {
          color: theme.colors.bodyText,
        },
      },
    },
  }
}

// Function used to truncate toast messages that are longer than three lines.
export function shortenMessage(fullMessage: string): string {
  const characterLimit = 104

  if (fullMessage.length > characterLimit) {
    let message = fullMessage.replace(/^(.{104}[^\s]*).*/, "$1")

    if (message.length > characterLimit) {
      message = message
        .substring(0, characterLimit)
        .split(" ")
        .slice(0, -1)
        .join(" ")
    }

    return message.trim()
  }

  return fullMessage
}

export function Toast({ theme, body, icon, width }: ToastProps): ReactElement {
  const displayMessage = shortenMessage(body)
  const shortened = body !== displayMessage

  const [expanded, setExpanded] = useState(!shortened)
  const [toastKey, setToastKey] = useState<React.Key>(0)

  const handleClick = useCallback((): void => {
    setExpanded(!expanded)
  }, [expanded])

  const styleOverrides = useMemo(() => generateToastOverrides(theme), [theme])

  const toastContent = useMemo(
    () => (
      <>
        <StyledToastWrapper expanded={expanded}>
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
                data-testid="toastViewButton"
                className="toastViewButton"
                onClick={handleClick}
              >
                {expanded ? "view less" : "view more"}
              </StyledViewButton>
            )}
          </StyledMessageWrapper>
        </StyledToastWrapper>
      </>
    ),
    [shortened, expanded, body, icon, displayMessage, handleClick]
  )

  useEffect(() => {
    // Handles the error case where st.sidebar.toast is called since
    // baseweb would throw error anyway (no toast container in sidebar)
    if (theme.inSidebar) return

    // Uses toaster utility to create toast on mount and generate unique key
    // to reference that toast for update/removal
    const newKey = toaster.info(toastContent, {
      overrides: { ...styleOverrides },
    })
    setToastKey(newKey)

    return () => {
      // Disable transition so toast doesn't flicker on removal
      toaster.update(newKey, {
        overrides: { Body: { style: { transitionDuration: 0 } } },
      })
      // Remove toast on unmount
      toaster.clear(newKey)
    }

    // Array must be empty to run as mount/cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Handles expand/collapse button behavior for long toast messages
    toaster.update(toastKey, {
      children: toastContent,
      overrides: { ...styleOverrides },
    })
  }, [toastKey, toastContent, styleOverrides])

  const sidebarErrorMessage = (
    <AlertElement
      kind={Kind.ERROR}
      body="Streamlit API Error: `st.toast` cannot be called directly on the sidebar with `st.sidebar.toast`.
        See our `st.toast` API [docs](https://docs.streamlit.io/develop/api-reference/status/st.toast) for more information."
      width={width}
    />
  )
  return (
    // Shows error if toast is called on st.sidebar
    <>{theme.inSidebar && sidebarErrorMessage}</>
  )
}

export default withTheme(Toast)

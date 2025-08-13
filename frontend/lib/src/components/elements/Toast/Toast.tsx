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

import React, {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { toaster, type ToastOverrides } from "baseui/toast"

import { Toast as ToastProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import AlertElement from "~lib/components/elements/AlertElement/AlertElement"
import { Kind } from "~lib/components/shared/AlertContainer"
import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { EmotionTheme, hasLightBackgroundColor } from "~lib/theme"

import {
  StyledMessageWrapper,
  StyledToastWrapper,
  StyledViewButton,
} from "./styled-components"

export interface ToastProps {
  element: ToastProto
}

function generateToastOverrides(theme: EmotionTheme): ToastOverrides {
  const lightBackground = hasLightBackgroundColor(theme)
  return {
    Body: {
      props: {
        "data-testid": "stToast",
        className: "stToast",
      },
      style: {
        display: "flex",
        flexDirection: "row",
        gap: theme.spacing.md,
        width: theme.sizes.toastWidth,
        marginTop: theme.spacing.sm,
        // Warnings logged if you use shorthand property here:
        borderTopLeftRadius: theme.radii.default,
        borderTopRightRadius: theme.radii.default,
        borderBottomLeftRadius: theme.radii.default,
        borderBottomRightRadius: theme.radii.default,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        paddingLeft: theme.spacing.twoXL,
        paddingRight: theme.spacing.twoXL,
        backgroundColor: theme.colors.bgColor,
        filter: lightBackground ? "brightness(0.98)" : "brightness(1.2)",
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

function Toast({ element }: Readonly<ToastProps>): ReactElement {
  const { body, icon, duration } = element
  const theme = useEmotionTheme()
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
              data-testid="stToastViewButton"
              onClick={handleClick}
            >
              {expanded ? "view less" : "view more"}
            </StyledViewButton>
          )}
        </StyledMessageWrapper>
      </StyledToastWrapper>
    ),
    [shortened, expanded, body, icon, displayMessage, handleClick]
  )

  useEffect(() => {
    // Handles the error case where st.sidebar.toast is called since
    // baseweb would throw error anyway (no toast container in sidebar)
    if (theme.inSidebar) {
      return
    }

    // Uses toaster utility to create toast on mount and generate unique key
    // to reference that toast for update/removal
    const autoHideDurationMs = notNullOrUndefined(duration)
      ? duration === 0
        ? 0 // Explicitly disable auto-hide when duration is 0
        : duration * 1000
      : 4000 // Use default duration of 4 seconds

    const newKey = toaster.info(toastContent, {
      overrides: { ...styleOverrides },
      autoHideDuration: autoHideDurationMs,
    })
    setToastKey(newKey)

    return () => {
      // Disable transition so toast doesn't flicker on removal
      toaster.update(newKey, {
        overrides: { Body: { style: { display: "none" } } },
      })
      // Remove toast on unmount
      toaster.clear(newKey)
    }

    // Array must be empty to run as mount/cleanup
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
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
    />
  )
  return (
    // Shows error if toast is called on st.sidebar
    <>{theme.inSidebar && sidebarErrorMessage}</>
  )
}

export default memo(Toast)

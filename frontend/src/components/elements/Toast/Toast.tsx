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

import React, { ReactElement, useRef, useState, useEffect } from "react"

import { withTheme } from "@emotion/react"
import {
  toaster,
  Toast as UIToast,
  ToasterContainer,
  KIND,
  PLACEMENT,
} from "baseui/toast"

import { Theme } from "src/theme"
import {
  toastColoration,
  StyledViewMoreButton,
  StyledToastMessage,
} from "./styled-components"

// TODO List:
// Handle isOwner scenario (moves Toast to accomodate for terminal button)
// Handle concatenation of toast message if longer than 3 lines & view more button
// Handle Styling for themes
// Clean up styling
export interface ToastProps {
  theme: Theme
  text: string
  icon?: string
  type: string
}

export function Toast({ theme, text, icon, type }: ToastProps): ReactElement {
  const source = icon ? `${icon} ${text}` : text

  useEffect(() => {
    const content = (
      <>
        <StyledToastMessage>{source}</StyledToastMessage>
        <StyledViewMoreButton>view more</StyledViewMoreButton>
      </>
    )

    const styleOverrides = {
      overrides: {
        Body: {
          style: {
            width: "288px",
            boxShadow:
              "0px 3px 10px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.25)",
            marginTop: "0px",
            borderRadius: "4px",
            transitionProperty: "all",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDuration: "500ms",
            ...toastColoration(type, theme),
          },
        },
      },
    }

    switch (type) {
      case "success":
        toaster.positive(content, styleOverrides)
        break
      case "warning":
        toaster.warning(content, styleOverrides)
        break
      case "error":
        toaster.negative(content, styleOverrides)
        break
      default:
        toaster.info(content, styleOverrides)
    }
  }, [theme])

  return (
    <ToasterContainer
      placement={PLACEMENT.bottomRight}
      autoHideDuration={40000}
      overrides={{
        Root: {
          props: {
            "class-name": "toast-container",
          },
        },
        ToastCloseIcon: {
          style: () => ({
            marginLeft: "5px",
            width: "1.2rem",
            height: "1.2rem",
          }),
        },
      }}
    ></ToasterContainer>
  )
}

export default withTheme(Toast)

/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled from "@emotion/styled"
import { transparentize } from "color2k"

// TODO: Merge this with components/core/Block/styled-components/StyledEditButton
export const StyledCloseButton = styled.div(({ theme }) => {
  return {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    left: "-3rem",
    top: "0.625rem",
    opacity: 0,

    zIndex: theme.zIndices.sidebar + 1,
    height: "2.5rem",
    width: "2.5rem",
    transition: "opacity 300ms 150ms",
    border: "none",
    color: theme.colors.bodyText,
    borderRadius: "50%",
    cursor: "pointer",

    "&:focus": {
      outline: "none",
    },

    "&:active, &:focus-visible, &:hover": {
      opacity: "1 !important",
      outline: "none",
      transition: "none",
    },
  }
})

export const StyledCell = styled.div(({ theme }) => ({
  position: "relative",
  padding: "1rem 0",
  fontSize: theme.fontSizes.sm,

  "&::before": {
    content: '" "',
    background: transparentize(theme.colors.secondaryBg, 0.5),
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "calc(-50vw + 50%)", // TODO: Handle sidebar and scrollbar.
    width: "100vw",
    zIndex: 0,
  },

  ".cm-theme": {
    width: "calc(100vw - (50vw - 50%))", // TODO: Handle sidebar.
  },

  ".cm-editor.cm-focused": {
    outline: "none",
  },

  "&:hover > :first-child": {
    opacity: 0.5,
  },
}))

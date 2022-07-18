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

import React from "react"
import styled from "@emotion/styled"
import { Theme } from "src/theme"

// TODO: Merge this with components/core/Block/styled-components/StyledEditButton
export const StyledCloseButton = styled.div(({ theme }) => {
  return {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    left: "-3rem",
    top: "-1rem",
    opacity: 0,
    backgroundColor: theme.colors.lightenedBg05,

    zIndex: theme.zIndices.sidebar + 1,
    height: "2.5rem",
    width: "2.5rem",
    transition: "opacity 300ms 150ms",
    border: "none",
    color: theme.colors.fadedText60,
    borderRadius: "50%",
    cursor: "pointer",

    "&:focus": {
      outline: "none",
    },

    "&:active, &:focus-visible, &:hover": {
      opacity: 1,
      outline: "none",
      color: theme.colors.bodyText,
      transition: "none",
    },
  }
})

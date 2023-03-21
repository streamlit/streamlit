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

import { CSSProperties } from "@emotion/serialize"
import styled from "@emotion/styled"
import { Theme } from "src/theme"

// TODO: Handle light/dark theme cases
export function toastColoration(kind: string, theme: Theme): CSSProperties {
  const defaultStyle = {
    backgroundColor: theme.colors.gray10,
    color: theme.colors.bodyText,
  }
  const successStyle = {
    backgroundColor: "rgba(33, 195, 84, 0.1)",
    color: "rgb(23, 114, 51)",
  }
  const warningStyle = {
    backgroundColor: "rgba(255, 227, 18, 0.1)",
    color: "rgb(146, 108, 5)",
  }
  const errorStyle = {
    backgroundColor: "rgba(255, 43, 43, 0.09)",
    color: "rgb(125, 53, 59)",
  }

  if (kind === "success") {
    return successStyle
  } else if (kind === "warning") {
    return warningStyle
  } else if (kind === "error") {
    return errorStyle
  }

  return defaultStyle
}

export const StyledViewMoreButton = styled.button(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  lineHeight: "1.4rem",
  color: theme.colors.gray60,
  backgroundColor: theme.colors.transparent,
  border: "none",
  boxShadow: "none",
  padding: "0px",
  "&:hover, &:active, &:focus": {
    color: theme.colors.primary,
  },
}))

export const StyledToastMessage = styled.div(({ theme }) => ({
  display: "flex",
  maxHeight: "68px",
  marginBottom: "8px",
  overflow: "hidden",
  fontSize: theme.fontSizes.sm,
  lineHeight: "1.4rem",
}))

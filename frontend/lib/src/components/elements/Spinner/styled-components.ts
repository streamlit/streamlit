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

import styled from "@emotion/styled"
import { Spinner } from "baseui/spinner"
import isPropValid from "@emotion/is-prop-valid"
interface ThemedStyledSpinnerProps {
  usingCustomTheme: boolean
}

export const ThemedStyledSpinner = styled(Spinner, {
  shouldForwardProp: isPropValid,
})<ThemedStyledSpinnerProps>(({ theme, usingCustomTheme }) => {
  return {
    fontSize: theme.fontSizes.sm,
    width: "1.375rem",
    height: "1.375rem",
    borderWidth: "3px",
    radius: "4px",
    justifyContents: "center",
    padding: theme.spacing.none,
    margin: theme.spacing.none,
    borderColor: theme.colors.fadedText10,
    borderTopColor: usingCustomTheme
      ? theme.colors.primary
      : theme.colors.blue70,
    flexGrow: 0,
    flexShrink: 0,
  }
})

interface StyledSpinnerProps {
  width: number
  cache: boolean
}

export const StyledSpinner = styled.div<StyledSpinnerProps>(
  ({ theme, width, cache }) => ({
    width: width,
    ...(cache
      ? {
          paddingBottom: "1rem",
          background: `linear-gradient(to bottom, ${theme.colors.bgColor} 0%, ${theme.colors.bgColor} 80%, transparent 100%)`,
        }
      : null),
  })
)

export const StyledSpinnerContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.sm,
  alignItems: "center",
  width: "100%",
}))

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

import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { Spinner } from "baseui/spinner"

export const ThemedStyledSpinner = styled(Spinner, {
  shouldForwardProp: isPropValid,
})(({ theme }) => {
  return {
    fontSize: theme.fontSizes.sm,
    width: theme.sizes.spinnerSize,
    height: theme.sizes.spinnerSize,
    borderWidth: theme.sizes.spinnerThickness,
    justifyContents: "center",
    padding: theme.spacing.none,
    margin: theme.spacing.none,
    borderColor: theme.colors.borderColor,
    borderTopColor: theme.colors.secondary,
    flexGrow: 0,
    flexShrink: 0,
  }
})

interface StyledSpinnerProps {
  cache: boolean
}

export const StyledSpinner = styled.div<StyledSpinnerProps>(
  ({ theme, cache }) => ({
    ...(cache
      ? {
          paddingBottom: theme.spacing.lg,
          background: `linear-gradient(to bottom, ${theme.colors.bgColor} 0%, ${theme.colors.bgColor} 80%, transparent 100%)`,
        }
      : null),
  })
)

// TODO: Maybe move this to `theme/consts.ts`, see
// https://github.com/streamlit/streamlit/pull/10085/files#diff-a5cce939bf6c73209a258132c71ccb368a3a1fd57b68b373d242736adb920093
export const StyledSpinnerTimer = styled.div(({ theme }) => ({
  opacity: 0.6,
  fontSize: theme.fontSizes.sm,
}))

export const StyledSpinnerContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.sm,
  alignItems: "center",
  width: "100%",
}))

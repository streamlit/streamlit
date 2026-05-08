/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import type { EmotionThemeColors } from "~lib/theme/types"

import { Kind } from "./types"

const KIND_STYLES: Record<
  Kind,
  { bg: keyof EmotionThemeColors; text: keyof EmotionThemeColors }
> = {
  [Kind.ERROR]: { bg: "redBackgroundColor", text: "redTextColor" },
  [Kind.WARNING]: { bg: "yellowBackgroundColor", text: "yellowTextColor" },
  [Kind.INFO]: { bg: "blueBackgroundColor", text: "blueTextColor" },
  [Kind.SUCCESS]: { bg: "greenBackgroundColor", text: "greenTextColor" },
}

interface StyledAlertContainerProps {
  $kind: Kind
  $width?: number
}

export const StyledAlertContainer = styled.div<StyledAlertContainerProps>(
  ({ theme, $kind, $width }) => ({
    fontWeight: theme.fontWeights.normal,
    marginTop: theme.spacing.none,
    marginBottom: theme.spacing.none,
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.none,
    ...($width ? { width: `${$width}px` } : {}),
    borderRadius: theme.radii.default,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
    lineHeight: theme.lineHeights.small,
    backgroundColor: theme.colors[KIND_STYLES[$kind].bg],
    color: theme.colors[KIND_STYLES[$kind].text],
  })
)

export const StyledAlertContent = styled.div(({ theme }) => ({
  pre: {
    backgroundColor: theme.colors.transparent,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
    border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,

    "pre, code": {
      backgroundColor: theme.colors.transparent,
      color: "inherit",
    },
  },

  code: {
    backgroundColor: theme.colors.transparent,
    padding: theme.spacing.none,
  },

  "pre, code": {
    color: "inherit",
  },

  a: {
    color: "inherit",
    textDecoration: "underline",
  },
}))

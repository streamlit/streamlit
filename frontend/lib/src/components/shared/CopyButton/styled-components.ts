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

import { CSSObject } from "@emotion/react"
import styled from "@emotion/styled"

import type { EmotionTheme } from "~lib/theme/types"

interface StyledCopyButtonProps {
  buttonSize: string
}

const getCopyButtonBaseStyles = (
  theme: EmotionTheme,
  { buttonSize, focusRing }: { buttonSize?: string; focusRing?: string } = {}
): CSSObject => ({
  ...(buttonSize && {
    height: buttonSize,
    width: buttonSize,
  }),
  padding: theme.spacing.none,
  border: "none",
  backgroundColor: theme.colors.transparent,
  color: theme.colors.fadedText60,
  cursor: "pointer",
  borderRadius: theme.radii.sm,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  "&:hover": {
    color: theme.colors.bodyText,
    backgroundColor: theme.colors.darkenedBgMix15,
  },

  "&:active": {
    color: theme.colors.bodyText,
    backgroundColor: theme.colors.darkenedBgMix25,
  },

  "&:focus-visible": {
    outline: "none",
    boxShadow: focusRing ?? theme.shadows.focusRing,
  },
})

export const StyledCopyButton = styled.button<StyledCopyButtonProps>(
  ({ theme, buttonSize }) => ({
    ...getCopyButtonBaseStyles(theme, { buttonSize }),
  })
)

/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

interface StyledHorizontalBlockProps {
  weights: number[]
}

export const StyledHorizontalBlock = styled.div<StyledHorizontalBlockProps>(
  ({ weights, theme }) => ({
    // While using flex for columns, padding is used for large screens and gap
    // for small ones. This can be adjusted once more information is passed.
    // More information and discussions can be found: Issue #2716, PR #2811
    display: "grid",
    //gridTemplateColumns: (weights.map((w) => `{w}fr`).join(" ")),
    gridTemplateColumns: weights.map(w => `minmax(0, ${w}fr)`).join(" "),
    gap: theme.spacing.lg,

    [`@media (max-width: ${theme.breakpoints.columns})`]: {
      gridTemplateColumns: "1fr",
    },
  })
)

export interface StyledElementContainerProps {
  isStale: boolean
  isHidden: boolean
}

const verticalContainerDisplay = (theme: any): any => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gridGap: theme.spacing.lg,
})

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, isHidden }) => ({
    // Allows to have absolutely-positioned nodes inside report elements, like
    // floating buttons.
    position: "relative",

    ...verticalContainerDisplay(theme),

    "@media print": {
      "@-moz-document url-prefix()": {
        display: "block",
      },
      overflow: "visible",
    },

    ...(isStale
      ? {
          opacity: 0.33,
          transition: "opacity 1s ease-in 0.5s",
        }
      : {}),
  })
)

export interface StyledColumnProps {
  isEmpty: boolean
}

// XXX Remove this
export const StyledColumn = styled.div<StyledColumnProps>(
  ({ isEmpty, theme }) => {
    return {}
  }
)

export interface StyledBlockProps {
  isEmpty: boolean
}

export const StyledBlock = styled.div<StyledBlockProps>(
  ({ isEmpty, theme }) => ({
    [`@media (max-width: ${theme.breakpoints.columns})`]: {
      display: isEmpty ? "none" : undefined,
    },
  })
)

export interface StyledCardProps {
  isEmpty: boolean
}

export const StyledCard = styled.div<StyledCardProps>(
  ({ isEmpty, theme }) => ({
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    display: isEmpty ? "none" : undefined,
    backgroundColor: theme.colors.bgColor,
    borderRadius: theme.radii.sm,
    boxShadow: `0 2px 6px -3px #0008`,
  })
)

export interface StyledFormProps {
  theme: Theme
}

export const StyledForm = styled.div<StyledFormProps>(({ theme }) => ({
  padding: theme.spacing.lg,
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: theme.radii.md,
}))

export interface StyledVerticalBlockProps {
  ref?: React.RefObject<any>
}

export const StyledVerticalBlock = styled.div<StyledVerticalBlockProps>(
  ({ theme }) => ({
    ...verticalContainerDisplay(theme),
  })
)

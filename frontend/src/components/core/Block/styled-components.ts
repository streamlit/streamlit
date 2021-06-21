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

const verticalBlockLayoutStyles = (theme: any) => ({
  display: "flex",
  flex: 1,
  flexDirection: "column",

  //gap: theme.spacing.lg,
  // TODO: As soon as Safari supports this, use this instead of marginBottom on the children
  //(see rule below).

  "& > *": {
    marginBottom: theme.spacing.lg,
  },

  "& > *:last-child": {
    marginBottom: 0,
  },
})

// @ts-ignore
export const StyledHorizontalBlock = styled.div(
  // @ts-ignore
  ({ theme }) => ({
    display: "flex",
    flexDirection: "row",
    marginRight: `-${theme.spacing.lg}`,
    alignItems: "stretch",

    [`@media (max-width: ${theme.breakpoints.columns})`]: verticalBlockLayoutStyles(
      theme
    ),
  })
)

export interface StyledElementContainerProps {
  isStale: boolean
  isHidden: boolean
}

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, isHidden }) => ({
    // Allows to have absolutely-positioned nodes inside report elements, like
    // floating buttons.
    position: "relative",

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

interface StyledColumnProps {
  weight: number
}

export const StyledColumn = styled.div<StyledColumnProps>(
  ({ weight, theme }) => {
    const width = `${weight * 100}%`

    return {
      width,
      flex: 1,
      display: "flex", // Important for 1-element columns with a card.
      paddingRight: theme.spacing.lg,
    }
  }
)

export const StyledCard = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.lg,
  paddingBottom: theme.spacing.lg,
  paddingLeft: theme.spacing.lg,
  paddingRight: theme.spacing.lg,
  backgroundColor: theme.colors.bgColor,
  borderRadius: theme.radii.sm,
  boxShadow: "0 2px 6px -3px #0008", // TODO XXX
  boxSizing: "border-box",

  // Make 1-element columns with a card align vertically.
  "&:first-child:last-child": {
    flex: 1,
  },
}))

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
  width?: number
}

export const StyledVerticalBlock = styled.div<StyledVerticalBlockProps>(
  // @ts-ignore
  ({ width, theme }) => ({
    width,
    position: "relative", // Required for the automatic width computation.

    ...verticalBlockLayoutStyles(theme),
  })
)

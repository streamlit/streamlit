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

import styled from "@emotion/styled"

export const StyledHorizontalBlock = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  [`@media (max-width: ${theme.breakpoints.columns})`]: {
    gap: theme.spacing.sm,
  },
}))

export interface StyledElementContainerProps {
  isStale: boolean
  isHidden: boolean
}

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, isHidden }) => ({
    display: "flex",
    flexDirection: "column",
    // Allows to have absolutely-positioned nodes inside report elements, like
    // floating buttons.
    position: "relative",
    marginTop: 0,
    marginRight: 0,
    marginBottom: isHidden ? 0 : theme.spacing.lg,
    marginLeft: 0,
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
  weight: number
  width: number
  withLeftPadding: boolean
}
export const StyledColumn = styled.div<StyledColumnProps>(
  ({ weight, width, withLeftPadding, theme }) => {
    // The minimal viewport width used to determine the minimal
    // fixed column width while accounting for column proportions.
    // Randomly selected based on visual experimentation.

    // When working with columns, width is driven by what percentage of space
    // the column takes in relation to the total number of columns
    const columnPercentage = weight / width

    return {
      // Flex determines how much space is allocated to this column.
      flex: `${columnPercentage * 100}%`,
      width,
      paddingLeft: withLeftPadding ? theme.spacing.sm : theme.spacing.none,
      [`@media (max-width: ${theme.breakpoints.columns})`]: {
        minWidth: `${columnPercentage > 0.5 ? "min" : "max"}(
          ${columnPercentage * 100}% - ${theme.spacing.twoXL},
          ${columnPercentage * parseInt(theme.breakpoints.columns, 10)}px)`,
        paddingLeft: theme.spacing.none,
      },
    }
  }
)

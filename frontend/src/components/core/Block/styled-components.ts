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
import { Theme } from "src/theme"

export const StyledHorizontalBlock = styled.div(({ theme }) => ({
  // While using flex for columns, padding is used for large screens and gap
  // for small ones. This can be adjusted once more information is passed.
  // More information and discussions can be found: Issue #2716, PR #2811
  display: "flex",
  flexWrap: "wrap",
  flexGrow: 1,

  // flexbox gap polyfill, ripped from
  // https://www.npmjs.com/package/flex-gap-polyfill as it's not currently
  // possible to use styled components with PostCSS
  "--fgp-gap-container": `calc(var(--fgp-gap-parent, 0px) - ${theme.spacing.lg}) !important`,
  "--fgp-gap": "var(--fgp-gap-container)",
  "margin-top": "var(--fgp-gap)",
  "margin-right": "var(--fgp-gap)",
  "& > *": {
    "--fgp-gap-parent": `${theme.spacing.lg} !important`,
    "--fgp-gap-item": `${theme.spacing.lg} !important`,
    "--fgp-gap": "var(--fgp-gap-item) !important",
    "margin-top": "var(--fgp-gap)",
    "margin-right": "var(--fgp-gap)",
  },
}))

export interface StyledElementContainerProps {
  isStale: boolean
  isHidden: boolean
}

const containerMargin = (occupiesSpace: boolean, theme: any): any => ({
  marginTop: 0,
  marginRight: 0,
  marginBottom: occupiesSpace ? theme.spacing.lg : 0,
  marginLeft: 0,
  ":last-child": {
    marginBottom: 0,
  },
})

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, isHidden }) => ({
    display: "flex",
    flexDirection: "column",
    // Allows to have absolutely-positioned nodes inside report elements, like
    // floating buttons.
    position: "relative",

    ...containerMargin(!isHidden, theme),

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
  weight: number
  totalWeight: number
}

export const StyledColumn = styled.div<StyledColumnProps>(
  ({ isEmpty, weight, totalWeight, theme }) => {
    const columnPercentage = weight / totalWeight

    return {
      // Calculate width based on percentage, but fill all available space,
      // e.g. if it overflows to next row.
      width: `calc(${columnPercentage * 100}% - ${theme.spacing.lg})`,
      flex: `1 1 calc(${columnPercentage * 100}% - ${theme.spacing.lg})`,

      [`@media (max-width: ${theme.breakpoints.columns})`]: {
        display: isEmpty ? "none" : undefined,
        minWidth: `calc(100% - ${theme.spacing.twoXL})`,
      },
    }
  }
)

export interface StyledBlockProps {
  isEmpty: boolean
  width: number
}
export const StyledBlock = styled.div<StyledBlockProps>(
  ({ isEmpty, width, theme }) => {
    return {
      width,
      ...containerMargin(!isEmpty, theme),
      [`@media (max-width: ${theme.breakpoints.columns})`]: {
        display: isEmpty ? "none" : undefined,
      },
    }
  }
)

export interface StyledFormProps {
  width: number
  theme: Theme
}

export const StyledForm = styled.div<StyledFormProps>(({ width, theme }) => {
  return {
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.fadedText10}`,
    borderRadius: theme.radii.md,
    // Wider to make the inner elements have the same size as non-form elements
    width,
    marginBottom: theme.spacing.lg,
  }
})

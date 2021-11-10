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

export const StyledHorizontalBlock = styled.div(
  // @ts-ignore
  ({ theme }) => ({
    display: "flex",
    flexWrap: "wrap",
    flexGrow: 1,
    alignItems: "stretch",

    // TODO: Replace the code below with "gap: theme.spacing.lg" as soon as more iOS Safari devices
    // support gap on flex:
    // https://caniuse.com/flexbox-gap

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
    const percentage = weight * 100
    const width = `calc(${percentage}% - ${theme.spacing.lg})`

    return {
      // Calculate width based on percentage, but fill all available space,
      // e.g. if it overflows to next row.
      width,
      flex: `1 1 ${width}`,

      [`@media (max-width: ${theme.breakpoints.columns})`]: {
        minWidth: `${weight > 0.5 ? "min" : "max"}(
          ${percentage}% - ${theme.spacing.twoXL},
          ${weight * parseInt(theme.breakpoints.columns, 10)}px)`,
      },
    }
  }
)

export interface StyledFormProps {
  theme: Theme
}

export const StyledForm = styled.div<StyledFormProps>(({ theme }) => ({
  padding: theme.spacing.lg,
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: theme.radii.md,
}))

export const styledVerticalBlockWrapperStyles: any = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
}

export interface StyledVerticalBlockProps {
  ref?: React.RefObject<any>
  width?: number
}

export const StyledVerticalBlock = styled.div<StyledVerticalBlockProps>(
  // @ts-ignore
  ({ width, theme }) => ({
    width,
    position: "relative", // Required for the automatic width computation.

    display: "flex",
    flex: 1,
    flexDirection: "column",

    // TODO: Replace the code below with "gap: theme.spacing.lg" as soon as more iOS Safari devices
    // support gap on flex:
    // https://caniuse.com/flexbox-gap

    "& > *": {
      marginBottom: theme.spacing.lg,
    },

    "& > *:last-child": {
      marginBottom: 0,
    },
  })
)

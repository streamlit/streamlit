/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { Theme } from "@emotion/react"
import styled from "@emotion/styled"

export interface StyledStreamlitMarkdownProps {
  isCaption: boolean
  isInSidebar: boolean
  isLabel?: boolean
  boldLabel?: boolean
  largerLabel?: boolean
  isToast?: boolean
}

function convertRemToEm(s: string): string {
  return s.replace(/rem$/, "em")
}

function sharedMarkdownStyle(theme: Theme): any {
  return {
    a: {
      color: theme.colors.linkText,
    },
  }
}

export const StyledStreamlitMarkdown =
  styled.div<StyledStreamlitMarkdownProps>(
    ({
      theme,
      isCaption,
      isInSidebar,
      isLabel,
      boldLabel,
      largerLabel,
      isToast,
    }) => {
      // Widget Labels have smaller font size with exception of Button/Checkbox/Radio Button labels
      // Toasts also have smaller font size
      const labelFontSize = (isLabel && !largerLabel) || isToast
      return {
        fontFamily: theme.genericFonts.bodyFont,
        marginBottom: isLabel ? "" : `-${theme.spacing.lg}`,
        ...sharedMarkdownStyle(theme),

        p: {
          wordBreak: "break-word",
          marginBottom: isLabel ? 0 : "",
          fontWeight: boldLabel ? 600 : "",
          ...(labelFontSize ? { fontSize: theme.fontSizes.sm } : {}),
        },

        img: {
          // Images in markdown should never be wider
          // than the content area.
          maxWidth: "100%",
        },

        li: {
          margin: "0.2em 0 0.2em 1.2em",
          padding: "0 0 0 0.6em",
          fontSize: theme.fontSizes.md,
        },

        table: {
          // Add some space below the markdown tables
          marginBottom: theme.spacing.lg,
        },

        tr: {
          borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        },

        "th, td": {
          padding: "6px 13px",
          border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        },

        "span.has-background-color": {
          padding: "0.125em 0.25em",
          margin: "0",
          borderRadius: theme.radii.md,
        },

        ...(isToast
          ? {
              div: {
                display: "inline-flex",
              },
            }
          : {}),

        ...(isCaption
          ? {
              color: isInSidebar
                ? theme.colors.gray
                : theme.colors.fadedText60,
              fontSize: theme.fontSizes.sm,
              "p, ol, ul, dl, li": {
                fontSize: "inherit",
              },

              "h1, h2, h3, h4, h5, h6": {
                color: "inherit",
              },

              // sizes taken from default styles, but using em instead of rem, so it
              // inherits the <small>'s shrunk size
              h1: {
                fontSize: isInSidebar
                  ? convertRemToEm(theme.fontSizes.xl)
                  : "2.25em",
              },
              h2: {
                fontSize: isInSidebar
                  ? convertRemToEm(theme.fontSizes.lg)
                  : "1.75em",
              },
              h3: {
                fontSize: isInSidebar ? "1.125em" : "1.25em",
              },

              // these are normally shrunk further to 0.8rem, but since we're already
              // inside a small, just make them 1em.
              "h4, h5, h6": {
                fontSize: "1em",
              },
            }
          : {}),
      }
    }
  )

export const StyledLinkIcon = styled.a(({ theme }) => ({
  // center icon
  lineHeight: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  svg: {
    // same color as the tooltip-icon
    stroke: theme.colors.fadedText60,
    strokeWidth: 2.25,
  },

  "&:hover svg": {
    stroke: theme.colors.bodyText,
  },
}))

export const StyledHeadingWithActionElements = styled.div(({ theme }) => ({
  "h1, h2, h3, h4, h5, h6, span": {
    scrollMarginTop: theme.sizes.headerHeight,
  },
  ...sharedMarkdownStyle(theme),

  // break-word & pretty makes most headings break in a nicer way than break-all while still
  // preventing overflowing of the container to the side. Long headings without whitespaces or hyphens might still look weird
  wordBreak: "break-word",
  textWrap: "pretty",

  // show link-icon when hovering somewhere over the heading
  [StyledLinkIcon as any]: {
    visibility: "hidden",
  },

  // we have to set the hover here so that the link icon becomes visible when hovering anywhere over the heading
  "&:hover": {
    [StyledLinkIcon as any]: {
      visibility: "visible",
    },
  },
}))

export const StyledHeadingActionElements = styled.span(({ theme }) => ({
  marginLeft: theme.spacing.sm,
  display: "inline-flex",
  gap: theme.spacing.sm,

  verticalAlign: "middle",

  "& > *": {
    // remove margins of inner elements as they are wrapped in a container that applies the margin
    marginLeft: "0 !important",
  },
}))

export interface StyledDividerProps {
  rainbow: boolean
  color: string
}

export const StyledDivider = styled.hr<StyledDividerProps>(
  ({ theme, rainbow, color }) => {
    return {
      // Height needs to be !important due to globalStyles.tsx hr height override - line #170
      height: "2px !important",
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.none,
      border: "none",
      borderRadius: "3px",
      ...(rainbow ? { background: color } : { backgroundColor: color }),
    }
  }
)

export const StyledPreWrapper = styled.div(({ theme }) => ({
  // Set spacing between pre-elements inside of markdown similar to our gap spacing between elements
  marginBottom: theme.spacing.lg,
}))

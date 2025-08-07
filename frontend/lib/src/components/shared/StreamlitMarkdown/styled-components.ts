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

import { Theme } from "@emotion/react"
import styled from "@emotion/styled"

import { roundFontSizeToNearestEighth } from "~lib/theme/utils"

export interface StyledStreamlitMarkdownProps {
  isCaption: boolean
  isInDialog: boolean
  isLabel?: boolean
  inheritFont?: boolean
  boldLabel?: boolean
  largerLabel?: boolean
  isToast?: boolean
}

function convertRemToEm(s: string): string {
  return s.replace(/rem$/, "em")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
function sharedMarkdownStyle(theme: Theme): any {
  return {
    a: {
      color: theme.colors.link,
      textDecoration: theme.linkUnderline ? "underline" : "none",
    },
  }
}

/**
 * Caption sizes taken from default styles, but using em instead of rem, so it
 * inherits the <small>'s shrunk size. Also handles reduced heading font sizes
 * in dialogs.
 */
function convertFontSizes(
  fontSize: string,
  isInDialog: boolean,
  isCaption: boolean
): string {
  // For headers in `st.caption`, we use `em` values, so the headers automatically
  // become a bit smaller by adapting to the font size of the caption.

  if (isInDialog) {
    // Dialogs also reduce the font size of the headings to 65% of the base font size
    // Round the font size to the nearest eighth of a rem to try to keep to round px values
    const roundedFontSize = roundFontSizeToNearestEighth(
      parseFloat(fontSize) * 0.65
    )

    // Ensure the font size is at least 0.75rem
    const dialogFontSize = `${Math.max(roundedFontSize, 0.75)}rem`
    return isCaption ? convertRemToEm(dialogFontSize) : dialogFontSize
  }

  return isCaption ? convertRemToEm(fontSize) : fontSize
}

function getMarkdownHeadingDefinitions(
  theme: Theme,
  isInDialog: boolean,
  isCaption: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): any {
  return {
    "h1, h2, h3, h4, h5, h6": {
      fontFamily: theme.genericFonts.headingFont,
      lineHeight: theme.lineHeights.headings,
      margin: 0,
      color: "inherit",
    },
    h1: {
      fontSize: convertFontSizes(
        theme.fontSizes.h1FontSize,
        isInDialog,
        isCaption
      ),

      fontWeight: theme.fontWeights.h1FontWeight,
      padding: `${theme.spacing.xl} 0 ${theme.spacing.lg} 0`,
    },
    "h1 b, h1 strong": {
      // Per Pull Request #9395, setting text to bold in headers
      // should NOT change its font-weight
      fontWeight: theme.fontWeights.h1FontWeight,
    },
    "h2, h3": {
      letterSpacing: "-0.005em",
    },
    h2: {
      fontSize: convertFontSizes(
        theme.fontSizes.h2FontSize,
        isInDialog,
        isCaption
      ),
      fontWeight: theme.fontWeights.h2FontWeight,
      padding: `${theme.spacing.lg} 0 ${theme.spacing.lg} 0`,
    },
    h3: {
      fontSize: convertFontSizes(
        theme.fontSizes.h3FontSize,
        isInDialog,
        isCaption
      ),

      fontWeight: theme.fontWeights.h3FontWeight,
      padding: `${theme.spacing.md} 0 ${theme.spacing.lg} 0`,
    },
    h4: {
      fontSize: convertFontSizes(
        theme.fontSizes.h4FontSize,
        isInDialog,
        isCaption
      ),
      fontWeight: theme.fontWeights.h4FontWeight,
      padding: `${theme.spacing.sm} 0 ${theme.spacing.lg} 0`,
    },
    h5: {
      fontSize: convertFontSizes(
        theme.fontSizes.h5FontSize,
        isInDialog,
        isCaption
      ),
      fontWeight: theme.fontWeights.h5FontWeight,
      padding: `${theme.spacing.xs} 0 ${theme.spacing.lg} 0`,
    },
    h6: {
      fontSize: convertFontSizes(
        theme.fontSizes.h6FontSize,
        isInDialog,
        isCaption
      ),

      fontWeight: theme.fontWeights.h6FontWeight,
      padding: `${theme.spacing.twoXS} 0 ${theme.spacing.lg} 0`,
    },
  }
}

export const StyledStreamlitMarkdown =
  styled.div<StyledStreamlitMarkdownProps>(
    ({
      theme,
      isCaption,
      isInDialog,
      isLabel,
      inheritFont,
      boldLabel,
      largerLabel,
      isToast,
    }) => {
      // Widget Labels have smaller font size with exception of Button/Checkbox/Radio Button labels
      // Toasts also have smaller font size as well as pills and segmented controls.
      const useSmallerFontSize =
        (isLabel && !largerLabel) || isToast || isCaption

      return {
        fontFamily: inheritFont ? "inherit" : theme.genericFonts.bodyFont,
        fontSize: inheritFont
          ? "inherit"
          : useSmallerFontSize
            ? theme.fontSizes.sm
            : theme.fontSizes.md,
        marginBottom: isLabel ? "" : `-${theme.spacing.lg}`,
        opacity: isCaption ? 0.6 : undefined,
        color: "inherit",
        ...sharedMarkdownStyle(theme),
        ...getMarkdownHeadingDefinitions(theme, isInDialog, isCaption),

        // This is required so that long Latex formulas in `st.latex` are scrollable
        // when `help` is set (see below).
        "&:has(.katex-display)": {
          overflowX: "hidden",
        },

        p: {
          wordBreak: "break-word",
          marginBottom: isLabel ? theme.spacing.none : "",
          fontWeight: inheritFont
            ? "inherit"
            : boldLabel
              ? theme.fontWeights.bold
              : "",
          marginTop: theme.spacing.none,
          marginLeft: theme.spacing.none,
          marginRight: theme.spacing.none,
        },

        img: {
          // Images in markdown should never be wider
          // than the content area.
          maxWidth: "100%",
          // In labels, widgets should never be taller than the text.
          maxHeight: isLabel ? "1em" : undefined,
          verticalAlign: "middle",
        },

        li: {
          margin: "0.2em 0 0.2em 1.15em",
          padding: "0 0 0 0.3em",
        },

        "li.task-list-item": {
          listStyleType: "none",
          padding: "0",
          marginLeft: "0",
          "input[type='checkbox']": {
            verticalAlign: "middle",
            margin: "0 0.35em 0.1em 0",
          },
        },

        // Handles quotes:
        blockquote: {
          margin: "1em 0 1em 0",
          padding: `0 0 0 0.75em`,
          borderLeft: `0.15em solid ${theme.colors.borderColor}`,
          opacity: 0.6,
        },

        "b, strong": {
          fontWeight: theme.fontWeights.bold,
        },

        // Issue #11976: Handle bolded inline code
        "b code, strong code": {
          fontWeight: theme.fontWeights.codeBold,
        },

        // Handles the horizontal divider:
        hr: {
          margin: "2em 0",
          padding: 0,
          // Reset Firefox's gray color:
          color: "inherit",
          backgroundColor: "transparent",
          border: "none",
          borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          // Set correct height and prevent the size attribute
          // to make the hr look like an input field:
          "&:not([size])": {
            height: theme.sizes.borderWidth,
          },
        },

        table: {
          // Add some space below the markdown tables
          marginBottom: theme.spacing.lg,
          // Prevent double borders
          borderCollapse: "collapse",
        },

        tr: {
          borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
        },

        th: {
          // TODO: check whether this should be adjusted
          // defaults to font-weight: "bold" (700)
          textAlign: "inherit",
        },

        "th, td": {
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          border: `${theme.sizes.borderWidth} solid ${theme.colors.dataframeBorderColor}`,
        },

        "span.stMarkdownColoredBackground": {
          borderRadius: theme.radii.md,
          padding: `${theme.spacing.threeXS} ${theme.spacing.twoXS}`,
          margin: theme.spacing.none,
          boxDecorationBreak: "clone",
        },

        "span.stMarkdownBadge": {
          borderRadius: theme.radii.md,
          // Since we're using inline-block below, we're not using vertical padding here,
          // because inline-block already makes the element look a bit taller.
          padding: `0 ${theme.spacing.twoXS}`,
          // Add a small margin to separate it a bit from other text.
          margin: `0 ${theme.spacing.px}`,

          // Make badges not wrap and ellipsize them if they are too long for the
          // parent container.
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          display: "inline-block",
          verticalAlign: "middle",
        },

        "p, ol, ul, dl, li": {
          fontSize: "inherit",
        },

        // Allow long Latex formulas that are not inline (i.e. either from `st.latex`
        // or in their own paragraph inside `st.markdown`) to scroll horizontally.
        ".katex-display": {
          overflowX: "auto",
          overflowY: "hidden",
        },

        ".katex": {
          fontWeight: theme.fontWeights.normal,
        },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledLinkIcon as any]: {
    visibility: "hidden",
  },

  // we have to set the hover here so that the link icon becomes visible when hovering anywhere over the heading
  "&:hover": {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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

export const StyledHeaderDivider = styled.hr<StyledDividerProps>(
  ({ theme, rainbow, color }) => {
    return {
      // Height needs to be !important due to globalStyles.tsx hr height override - line #170
      height: `${theme.spacing.threeXS} !important`,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.none,
      border: "none",
      borderRadius: theme.radii.full,
      ...(rainbow ? { background: color } : { backgroundColor: color }),
    }
  }
)

export const StyledPreWrapper = styled.div(({ theme }) => ({
  // Set spacing between pre-elements inside of markdown similar to our gap spacing between elements
  marginBottom: theme.spacing.lg,
}))

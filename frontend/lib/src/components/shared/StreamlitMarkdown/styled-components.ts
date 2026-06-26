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

import { keyframes, Theme } from "@emotion/react"
import styled from "@emotion/styled"

import { roundFontSizeToNearestEighth } from "~lib/theme/utils"

// Shimmer animation: sweeps a mask gradient from right to left across the text.
// Uses mask-position animation to fade text opacity in/out.
const shimmerAnimation = keyframes`
  0% {
    mask-position: 600% center;
    -webkit-mask-position: 600% center;
  }
  100% {
    mask-position: -600% center;
    -webkit-mask-position: -600% center;
  }
`

interface StyledStreamlitMarkdownProps {
  isCaption: boolean
  isInDialog: boolean
  isLabel?: boolean
  isInHorizontalLayout?: boolean
  inheritFont?: boolean
  boldLabel?: boolean
  isToast?: boolean
  truncate?: boolean
}

function convertRemToEm(s: string): string {
  return s.replace(/rem$/, "em")
}

function sharedMarkdownStyle(theme: Theme): Record<string, unknown> {
  return {
    a: {
      color: theme.colors.link,
      textDecoration: theme.linkUnderline ? "underline" : "none",
      "&:focus": {
        outline: "none",
        // Fallback for environments without :focus-visible support:
        boxShadow: theme.shadows.focusRing,
        borderRadius: theme.radii.default,
      },
      // In browsers that support :focus-visible, avoid showing the focus ring on
      // mouse focus (while still keeping the fallback behavior in others).
      "&:focus:not(:focus-visible)": {
        boxShadow: theme.shadows.none,
      },
      "&:focus-visible": {
        boxShadow: theme.shadows.focusRing,
        borderRadius: theme.radii.default,
      },
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
  isCaption: boolean,
  isInHorizontalLayout: boolean
): Record<string, unknown> {
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
      padding: isInHorizontalLayout
        ? 0
        : `${theme.spacing.xl} 0 ${theme.spacing.lg} 0`,
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
      padding: isInHorizontalLayout
        ? 0
        : `${theme.spacing.lg} 0 ${theme.spacing.lg} 0`,
    },
    h3: {
      fontSize: convertFontSizes(
        theme.fontSizes.h3FontSize,
        isInDialog,
        isCaption
      ),

      fontWeight: theme.fontWeights.h3FontWeight,
      padding: isInHorizontalLayout
        ? 0
        : `${theme.spacing.md} 0 ${theme.spacing.lg} 0`,
    },
    h4: {
      fontSize: convertFontSizes(
        theme.fontSizes.h4FontSize,
        isInDialog,
        isCaption
      ),
      fontWeight: theme.fontWeights.h4FontWeight,
      padding: isInHorizontalLayout
        ? 0
        : `${theme.spacing.sm} 0 ${theme.spacing.lg} 0`,
    },
    h5: {
      fontSize: convertFontSizes(
        theme.fontSizes.h5FontSize,
        isInDialog,
        isCaption
      ),
      fontWeight: theme.fontWeights.h5FontWeight,
      padding: isInHorizontalLayout
        ? 0
        : `${theme.spacing.xs} 0 ${theme.spacing.lg} 0`,
    },
    h6: {
      fontSize: convertFontSizes(
        theme.fontSizes.h6FontSize,
        isInDialog,
        isCaption
      ),

      fontWeight: theme.fontWeights.h6FontWeight,
      padding: isInHorizontalLayout
        ? 0
        : `${theme.spacing.twoXS} 0 ${theme.spacing.lg} 0`,
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
      isInHorizontalLayout = false,
      inheritFont,
      boldLabel,
      isToast,
      truncate,
    }) => {
      // All widget labels (isLabel=true) use the smaller font size (fontSizes.sm = 14px).
      // Normal markdown text (isLabel=false) stays at fontSizes.md (16px).
      // Toasts and captions also use the smaller font size.
      // Some label contexts (e.g. alert titles, dialog titles, slider labels, metric values)
      // opt out of this sizing via inheritFont=true, which makes the font-size, font-family,
      // and font-weight inherit from their parent container instead.
      const useSmallerFontSize = isLabel || isToast || isCaption

      return {
        fontFamily: inheritFont ? "inherit" : theme.genericFonts.bodyFont,
        fontSize: inheritFont
          ? "inherit"
          : useSmallerFontSize
            ? theme.fontSizes.sm
            : theme.fontSizes.md,
        fontWeight: inheritFont ? "inherit" : undefined,
        marginBottom:
          isLabel || isInHorizontalLayout ? "" : `-${theme.spacing.lg}`,
        opacity: isCaption ? theme.opacities.secondary : undefined,
        color: "inherit",
        // Always respect the width of the parent container:
        maxWidth: "100%",
        width: isLabel ? "" : "100%",
        // Break long words to prevent them from overflowing the container:
        overflowWrap: "break-word",
        ...sharedMarkdownStyle(theme),
        ...getMarkdownHeadingDefinitions(
          theme,
          isInDialog,
          isCaption,
          isInHorizontalLayout
        ),

        // Truncate text with ellipsis when it overflows the container.
        // This is useful for single-line text that should not wrap.
        // When inheritFont is false, lineHeight: "normal" resets inherited line heights
        // (e.g., when parent has a large line-height). When inheritFont is true,
        // we preserve the parent's line height for consistent styling.
        ...(truncate && {
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          lineHeight: inheritFont ? "inherit" : "normal",

          "& p": {
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            lineHeight: inheritFont ? "inherit" : "normal",
          },
        }),

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
              : undefined,
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
          // Ensure that images are not distorted:
          objectFit: "scale-down",
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
          opacity: theme.opacities.secondary,
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
          display: "table",
          // Prevent double borders
          borderCollapse: "collapse",
          marginBottom: theme.spacing.lg,
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
          borderRadius: theme.radii.sm,
          padding: `${theme.spacing.threeXS} ${theme.spacing.twoXS}`,
          margin: theme.spacing.none,
          boxDecorationBreak: "clone",
        },

        "span.stMarkdownBadge": {
          borderRadius: theme.radii.sm,
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

        // Shimmer animation for loading/thinking text. Uses mask-image with an
        // animated gradient to fade text opacity in and out. The shimmer uses
        // fadedText60 as its base color. When nesting with color directives:
        // - :shimmer[:red[text]] - inner color wins (displays red)
        // - :red[:shimmer[text]] - shimmer color wins (displays fadedText60)
        "span.stMarkdownShimmer": {
          // Use theme's secondary text color for shimmer text
          color: theme.colors.fadedText60,
          // Mask gradient: fades from 40% opacity to 100% at the shimmer peak and back
          maskImage: `linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.4) 0%,
            rgba(0, 0, 0, 0.4) 40%,
            rgba(0, 0, 0, 1) 50%,
            rgba(0, 0, 0, 0.4) 60%,
            rgba(0, 0, 0, 0.4) 100%
          )`,
          WebkitMaskImage: `linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.4) 0%,
            rgba(0, 0, 0, 0.4) 40%,
            rgba(0, 0, 0, 1) 50%,
            rgba(0, 0, 0, 0.4) 60%,
            rgba(0, 0, 0, 0.4) 100%
          )`,
          maskSize: "200% 100%",
          WebkitMaskSize: "200% 100%",
          animation: `${shimmerAnimation} 8s linear infinite`,

          // Respect user's motion preferences for accessibility
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            maskImage: "none",
            WebkitMaskImage: "none",
          },
        },

        "p, ol, ul, dl, li": {
          fontSize: "inherit",
        },

        "& > ul, & > ol": {
          display: "block",
          width: "fit-content",
          textAlign: "left",
        },

        // Ensure nested lists stay as block elements
        "li > ul, li > ol": {
          display: "block",
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
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 150ms ease-in-out",

  svg: {
    // same color as the tooltip-icon
    stroke: theme.colors.fadedText60,
    strokeWidth: theme.sizes.defaultStrokeWidth,
  },

  "&:hover svg": {
    stroke: theme.colors.bodyText,
  },

  "&:focus-visible": {
    opacity: 1,
    pointerEvents: "auto",
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

  // Show link icon when hovering or when focus is within the heading container.
  // We use opacity instead of visibility so the link remains in the tab order.
  "&:hover, &:focus-within": {
    [StyledLinkIcon as unknown as string]: {
      opacity: 1,
      pointerEvents: "auto",
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

interface StyledDividerProps {
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

export const StyledHelpIconWrapper = styled.span({
  display: "inline-block",
  verticalAlign: "middle",
  transform: "translateY(-0.1em)",
})

export const StyledMermaidContainer = styled.div<{
  hasError: boolean
  isFullScreen: boolean
}>(({ theme, hasError, isFullScreen }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: hasError ? "flex-start" : "center",
  justifyContent: isFullScreen ? "center" : "flex-start",
  minHeight: "2rem",
  padding: theme.spacing.md,
  height: isFullScreen ? "100%" : "auto",
  width: "100%",
  "& img": {
    // Render the diagram at its natural size, scaled down to fit the container
    // width. We intentionally do not clamp the height inline: a fixed max-height
    // combined with a preserved aspect ratio shrinks tall/narrow diagrams into an
    // unreadable sliver. Tall diagrams stay readable and can use fullscreen.
    width: isFullScreen ? "100%" : "auto",
    maxWidth: "100%",
    height: isFullScreen ? "100%" : "auto",
    maxHeight: isFullScreen ? "100%" : "none",
    objectFit: "contain",
    borderRadius: theme.radii.default,
  },
}))

export const StyledMermaidErrorMessage = styled.div(({ theme }) => ({
  color: theme.colors.redTextColor,
  backgroundColor: theme.colors.redBackgroundColor,
  padding: theme.spacing.sm,
  borderRadius: theme.radii.default,
  fontSize: theme.fontSizes.sm,
  fontFamily: theme.genericFonts.codeFont,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  width: "100%",
}))

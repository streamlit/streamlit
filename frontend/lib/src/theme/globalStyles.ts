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

import { css, SerializedStyles } from "@emotion/react"
import { transparentize } from "color2k"

import { EmotionTheme } from "~lib/theme"

/**
 * Contains various styles that are applied globally to the app.
 *
 * Please only add styles here if they are truly global. Putting styles to the
 * individual components should be strongly preferred.
 */
export const globalStyles = (theme: EmotionTheme): SerializedStyles => css`
  // Override the base font-size value here.
  html {
    font-size: ${theme.fontSizes.baseFontSize}px;
  }

  // Set height to 100% for printing, otherwise the page on Safari might be blank
  @media print {
    html {
      height: 100%;
      // make background-colors appear by default (e.g. the sidebar background,
      // widget background, multi-select element background, ...)
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  // Body
  //
  // 1. Remove the margin in all browsers.
  // 2. As a best practice, apply a default background-color.
  // 3. Prevent adjustments of font size after orientation changes in iOS.
  // 4. Change the default tap highlight to be completely transparent in iOS.

  body {
    margin: 0; // 1
    font-family: ${theme.genericFonts.bodyFont};
    font-weight: ${theme.fontWeights.normal};
    line-height: ${theme.lineHeights.base};
    color: ${theme.colors.bodyText};
    background-color: ${theme.colors.bgColor}; // 2
    -webkit-text-size-adjust: 100%; // 3
    -webkit-tap-highlight-color: ${transparentize(theme.colors.black, 1)}; // 4
    -webkit-font-smoothing: auto;
  }

  // Embedded Overflow Management
  body.embedded {
    overflow: hidden;
  }

  body.embedded:hover {
    overflow: auto;
  }

  // Future-proof rule: in browsers that support :focus-visible, suppress the focus outline
  // on elements that programmatically receive focus but wouldn't normally show a visible
  // focus outline. In general, this would mean that the outline is only applied if the
  // interaction that led to the element receiving programmatic focus was a keyboard interaction,
  // or the browser has somehow determined that the user is primarily a keyboard user and/or
  // wants focus outlines to always be presented.
  // See https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible
  // and https://developer.paciellogroup.com/blog/2018/03/focus-visible-and-backwards-compatibility/

  [tabindex="-1"]:focus:not(:focus-visible) {
    outline: 0 !important;
  }

  // Lists
  // Reset margins on paragraphs
  //
  // Similarly, the top margin on <p>s get reset. However, we also reset the
  // bottom margin to use rem units instead of em.
  p,
  ol,
  ul,
  dl {
    margin: 0 0 1rem 0;
    padding: 0;
    font-size: 1rem;
    font-weight: ${theme.fontWeights.normal};
  }

  ol ol,
  ul ul,
  ol ul,
  ul ol {
    margin-bottom: 0;
  }

  // And undo these styles for placeholder links/named anchors (without href).
  // It would be more straightforward to just use a[href] in previous block, but that
  // causes specificity issues in many other styles that are too complex to fix.
  // See https://github.com/twbs/bootstrap/issues/19402

  a:not([href]):not([class]) {
    &,
    &:hover {
      color: inherit;
      text-decoration: none;
    }
  }

  // Images and content

  img,
  svg {
    vertical-align: middle;
  }

  // 1. Remove the margin in Firefox and Safari

  input,
  button,
  select,
  optgroup,
  textarea {
    margin: 0; // 1
    font-family: inherit;
    line-height: inherit;
    font-size: inherit;
  }

  // Show the overflow in Edge

  button,
  input {
    overflow: visible;
  }

  // Set the cursor for all buttons or button-like elements
  button,
  [role="button"] {
    &:not(:disabled) {
      cursor: pointer;
    }
  }

  // 1. Prevent a WebKit bug where (2) destroys native audio and video
  //    controls in Android 4.
  // 2. Correct the inability to style clickable types in iOS and Safari.
  // 3. Opinionated: add "hand" cursor to non-disabled button elements.

  button,
  [type="button"], // 1
  [type="reset"],
  [type="submit"] {
    -webkit-appearance: button; // 2
  }

  // Hidden attribute
  //
  // Always hide an element with the hidden HTML attribute.

  [hidden] {
    display: none !important;
  }

  // Tell browser to render a thin scrollbar that only appears when the
  // container is hovered. (This is ignored in OSes that render overlay
  // scrollbars, which is exactly what we want.)
  @supports (scrollbar-color: transparent transparent) {
    * {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }

    *:hover {
      scrollbar-color: ${theme.colors.fadedText40} transparent;
    }
  }

  // Safari doesn't support scrollbar colors so we style the scrollbar
  // using the old webkit-only properties.
  @supports not (scrollbar-color: transparent transparent) {
    ::-webkit-scrollbar {
      background: transparent;
      border-radius: ${theme.radii.full};
      height: 6px;
      width: 6px;
    }

    ::-webkit-scrollbar:active {
      background: ${theme.colors.fadedText10};
    }

    :hover::-webkit-scrollbar-thumb:vertical,
    :hover::-webkit-scrollbar-thumb:horizontal {
      background: ${theme.colors.fadedText40};
      border-radius: ${theme.radii.full};
    }
  }
`

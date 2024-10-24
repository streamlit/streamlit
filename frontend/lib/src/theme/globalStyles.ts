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

import { css, SerializedStyles } from "@emotion/react"
import { transparentize } from "color2k"

import { EmotionTheme } from "@streamlit/lib/src/theme"

export const globalStyles = (theme: EmotionTheme): SerializedStyles => css`
  // Override the base font-size value here.
  // This overrides the value set in reboot.scss.
  html {
    font-size: ${theme.fontSizes.mdPx}px;
  }

  // Set height to 100% for printing, otherwise the page on Safari might be blank
  @media print {
    html {
      height: 100%;
      // make background-colors appear by default (e.g. the sidebar background, widget background, multi-select element background, ...)
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }

  iframe {
    border: none;
    padding: 0;
    margin: 0;
  }

  .disabled {
    color: ${theme.colors.disabled};
  }

  // Embedded Overflow Management
  body.embedded {
    overflow: hidden;
  }

  body.embedded:hover {
    overflow: auto;
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

  // Content grouping
  //
  // 1. Reset Firefox's gray color
  // 2. Set correct height and prevent the size attribute to make the hr look like an input field

  hr {
    margin: 2em 0;
    padding: 0;
    color: inherit; // 1
    background-color: transparent;
    border: none;
    border-bottom: ${theme.sizes.borderWidth} solid ${theme.colors.borderColor};
  }

  hr:not([size]) {
    height: 1px; // 2
  }

  h1 {
    font-family: ${theme.genericFonts.headingFont};
    font-weight: ${theme.fontWeights.extrabold};

    // Use rem so we can remove it when first child, knowing that the
    // element-container above always adds 1rem.
    padding: 1.25rem 0 1rem 0;
    margin: 0;

    line-height: 1.2;
  }

  h2 {
    font-family: ${theme.genericFonts.headingFont};
    font-weight: ${theme.fontWeights.bold};
    letter-spacing: -0.005em;

    // Use rem so we can remove it when first child, knowing that the
    // element-container above always adds 1rem.
    padding: 1rem 0 1rem 0;
    margin: 0;

    line-height: 1.2;
  }

  h3 {
    font-family: ${theme.genericFonts.headingFont};
    font-weight: ${theme.fontWeights.bold};
    letter-spacing: -0.005em;

    // Use rem so we can remove it when first child, knowing that the
    // element-container above always adds 1rem.
    padding: 0.5rem 0 1rem 0;
    margin: 0;

    line-height: 1.2;
  }

  h4 {
    font-family: ${theme.genericFonts.headingFont};
    font-weight: ${theme.fontWeights.bold};
    padding: 0.75rem 0 1rem 0;
    margin: 0;
    line-height: 1.2;
  }

  h5 {
    font-family: ${theme.genericFonts.headingFont};
    font-weight: ${theme.fontWeights.bold};
    padding: 0 0 1rem 0;
    margin: 0;
    line-height: 1.2;
  }

  h6 {
    font-family: ${theme.genericFonts.headingFont};
    font-weight: ${theme.fontWeights.bold};
    padding: 0 0 1rem 0;
    margin: 0;
    line-height: 1.2;
  }

  // Abbreviations
  //
  // 1. Duplicate behavior to the data-* attribute for our tooltip plugin
  // 2. Add the correct text decoration in Chrome, Edge, Opera, and Safari.
  // 3. Add explicit cursor to indicate changed behavior.
  // 4. Prevent the text-decoration to be skipped.

  abbr[title],
  abbr[data-original-title] {
    // 1
    text-decoration: underline; // 2
    text-decoration: underline dotted; // 2
    cursor: help; // 3
    text-decoration-skip-ink: none; // 4
  }

  // Address

  address {
    margin-bottom: 1rem;
    font-style: normal;
    line-height: inherit;
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
    font-weight: 400;
  }

  ol ol,
  ul ul,
  ol ul,
  ul ol {
    margin-bottom: 0;
  }

  dt {
    font-size: 1rem;
    font-weight: 600;
    margin: 1em 0 0.2em 0;
    padding: 0;
  }

  // 1. Undo browser default

  dd {
    margin: 0 0 0.2em 1.2em;
    font-size: 1rem;
  }

  // Strong
  //
  // Add the correct font weight in Chrome, Edge, and Safari

  b,
  strong {
    font-weight: ${theme.fontWeights.bold};
  }

  // Override h1 font weight to default weight
  h1 b,
  h1 strong {
    font-weight: ${theme.fontWeights.extrabold};
  }

  // Code

  pre,
  code,
  kbd {
    font-family: ${theme.genericFonts.codeFont};
  }

  kbd {
    padding: 0.2rem 0.4rem;
    color: ${theme.colors.codeTextColor};
    background-color: ${theme.colors.codeHighlightColor};

    kbd {
      padding: 0;
      font-weight: ${theme.fontWeights.bold};
    }
  }

  // Images and content

  img,
  svg {
    vertical-align: middle;
  }

  // Tables
  //
  // Prevent double borders

  table {
    caption-side: bottom;
    border-collapse: collapse;
  }

  table caption {
    padding-top: ${theme.spacing.sm};
    padding-bottom: 0;
    color: ${theme.colors.gray60};
    text-align: left;
  }

  // 1. Matches default <td> alignment by inheriting text-align.
  // 2. Fix alignment for Safari

  th {
    text-align: inherit; // 1
    text-align: -webkit-match-parent; // 2
  }

  thead,
  tbody,
  tfoot,
  tr,
  td,
  th {
    border-color: inherit;
    border-style: solid;
    border-width: 0;
  }

  // Forms
  //
  // 1. Allow labels to use margin for spacing.

  label {
    display: inline-block; // 1
  }

  // Remove the default border-radius that macOS Chrome adds.
  // See https://github.com/twbs/bootstrap/issues/24093

  button {
    // stylelint-disable-next-line property-blacklist
    border-radius: 0;
  }

  // Work around a Firefox bug where the transparent button background
  // results in a loss of the default button focus styles.
  // Credit https://github.com/suitcss/base/

  button:focus {
    outline: 1px dotted;
    outline: 5px auto -webkit-focus-ring-color;
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
  }

  // Show the overflow in Edge

  button,
  input {
    overflow: visible;
  }

  // Remove the inheritance of text transform in Firefox

  button,
  select {
    text-transform: none;
  }

  // Set the cursor for non-<button> buttons
  //
  // Details at https://github.com/twbs/bootstrap/pull/30562
  [role="button"] {
    cursor: pointer;
  }

  // Remove the inheritance of word-wrap in Safari.
  // See https://github.com/twbs/bootstrap/issues/24990

  select {
    word-wrap: normal;
  }

  // Remove the dropdown arrow in Chrome from inputs built with datalists.
  // See https://stackoverflow.com/a/54997118

  [list]::-webkit-calendar-picker-indicator {
    display: none;
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

  // Remove inner border and padding from Firefox, but don't restore the outline like Normalize.

  ::-moz-focus-inner {
    padding: 0;
    border-style: none;
  }

  // Fix height of inputs with a type of datetime-local, date, month, week, or time
  // See https://github.com/twbs/bootstrap/issues/18842

  ::-webkit-datetime-edit-fields-wrapper,
  ::-webkit-datetime-edit-text,
  ::-webkit-datetime-edit-minute,
  ::-webkit-datetime-edit-hour-field,
  ::-webkit-datetime-edit-day-field,
  ::-webkit-datetime-edit-month-field,
  ::-webkit-datetime-edit-year-field {
    padding: 0;
  }

  ::-webkit-inner-spin-button {
    height: auto;
  }

  // 1. Correct the outline style in Safari.
  // 2. This overrides the extra rounded corners on search inputs in iOS so that our
  //    .form-control class can properly style them. Note that this cannot simply
  //    be added to .form-control as it's not specific enough. For details, see
  //    https://github.com/twbs/bootstrap/issues/11586.

  [type="search"] {
    outline-offset: -2px; // 1
    -webkit-appearance: textfield; // 2
  }

  // Remove the inner padding in Chrome and Safari on macOS.

  ::-webkit-search-decoration {
    -webkit-appearance: none;
  }

  // Remove padding around color pickers in webkit browsers

  ::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  // 1. Change font properties to inherit in Safari.
  // 2. Correct the inability to style clickable types in iOS and Safari.

  ::-webkit-file-upload-button {
    font: inherit; // 1
    -webkit-appearance: button; // 2
  }

  // Correct element displays

  output {
    display: inline-block;
  }

  // Summary
  //
  // 1. Add the correct display in all browsers

  summary {
    display: list-item; // 1
    cursor: pointer;
  }

  // Hidden attribute
  //
  // Always hide an element with the hidden HTML attribute.

  [hidden] {
    display: none !important;
  }

  // Make scrollbars awesome in Chrome

  ::-webkit-scrollbar {
    background: transparent;
    border-radius: 100px;
    height: 6px;
    width: 6px;
  }

  ::-webkit-scrollbar:active {
    background: ${theme.colors.fadedText10};
  }

  :hover::-webkit-scrollbar-thumb:vertical,
  :hover::-webkit-scrollbar-thumb:horizontal {
    background: ${theme.colors.fadedText40};
    border-radius: 100px;
  }
`

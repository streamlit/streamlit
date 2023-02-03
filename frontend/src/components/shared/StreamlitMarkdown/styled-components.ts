/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import styled from "@emotion/styled"

export interface StyledStreamlitMarkdownProps {
  isCaption: boolean
  isInSidebar: boolean
  isLabel?: boolean
  isCheckbox?: boolean
}

function convertRemToEm(s: string): string {
  return s.replace(/rem$/, "em")
}

export const StyledStreamlitMarkdown =
  styled.div<StyledStreamlitMarkdownProps>(
    ({ theme, isCaption, isInSidebar, isLabel, isCheckbox }) => {
      // Widget Labels have smaller font size with exception of Checkbox
      const labelFontSize = isLabel && !isCheckbox
      return {
        fontFamily: theme.genericFonts.bodyFont,
        marginBottom: `-${theme.spacing.lg}`,

        a: {
          color: theme.colors.linkText,
        },

        p: {
          wordBreak: "break-word",
          ...(labelFontSize ? { fontSize: theme.fontSizes.sm } : {}),
        },

        li: {
          margin: "0.2em 0 0.2em 1.2em",
          padding: "0 0 0 0.6em",
          fontSize: theme.fontSizes.md,
        },

        tr: {
          borderTop: `1px solid ${theme.colors.fadedText10}`,
        },

        "th, td": {
          padding: "6px 13px",
          border: `1px solid ${theme.colors.fadedText10}`,
        },

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

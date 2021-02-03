/**
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

import { css } from "@emotion/core"
import { Theme } from "theme"

export const globalStyles = (theme: Theme): any => css`
  a,
  a:visited {
    color: ${theme.colors.primary};
  }

  a:hover,
  a:active {
    color: ${theme.colors.primary};
    text-decoration: underline;
  }

  iframe {
    border: none;
    padding: 0;
    margin: 0;
  }

  code {
    padding: 0.2em 0.4em;
    margin: 0;
    border-radius: ${theme.radii.md};
    background: ${theme.colors.gray10};
    color: ${theme.colors.codeTextColor};
  }

  pre {
    margin: 0 0 1rem 0;
    background: ${theme.colors.gray10};
    border-radius: ${theme.radii.md};
    padding: 1rem;

    code {
      background: transparent;
      border: 0;
      display: inline;
      font-size: $font-size-sm;
      line-height: inherit;
      margin: 0;
      padding: 0;
      white-space: pre;
      word-break: normal;
      word-wrap: normal;
      overflow-x: auto;
      color: ${theme.colors.codeTextColor};
    }
  }

  .disabled {
    color: ${theme.colors.disabled};
  }

  // VegaLite Specific CSS information
  #vg-tooltip-element td {
    border: none;
  }

  // Embedded Overflow Management
  body.embedded {
    overflow: hidden;
  }

  body.embedded:hover {
    overflow: auto;
  }
`

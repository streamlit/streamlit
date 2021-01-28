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

import { logError } from "lib/log"
import { Theme, ThemeSpacing } from "./types"

const whiteSpace = /\s+/
export function computeSpacingStyle(value: string, theme: Theme): string {
  if (value === "") {
    return ""
  }

  return value
    .split(whiteSpace)
    .map(marginValue => {
      if (marginValue === "0") {
        return theme.spacing.none
      }

      if (!(marginValue in theme.spacing)) {
        logError(`Invalid spacing value: ${marginValue}`)
        return theme.spacing.none
      }

      return theme.spacing[marginValue as ThemeSpacing]
    })
    .join(" ")
}

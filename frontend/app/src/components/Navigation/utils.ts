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

import { IAppPage } from "@streamlit/protobuf"

/**
 * Determines if navigation should be shown based on pages and sections.
 * Navigation should be hidden only when:
 * - There is only 1 page total (no sections)
 * - There is 1 section with only 1 page in it
 * Otherwise, navigation should be shown.
 */
export function shouldShowNavigation(
  appPages: IAppPage[],
  navSections: string[]
): boolean {
  // If there's only one page total, hide nav
  if (appPages.length <= 1) {
    return false
  }

  // If there are no sections, we have multiple pages without sections, show nav
  if (navSections.length === 0) {
    return true
  }

  // If there are multiple sections, show nav
  if (navSections.length > 1) {
    return true
  }

  // If there's exactly one section, we need to check how many pages it has
  // If it has more than 1 page, show nav
  // The fact that we got here means appPages.length > 1 and navSections.length === 1
  // So the single section must have multiple pages
  return true
}

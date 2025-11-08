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

import groupBy from "lodash/groupBy"

import { IAppPage } from "@streamlit/protobuf"

export interface NavigationSections {
  [sectionHeader: string]: IAppPage[]
}

export interface ProcessedNavigation {
  individualPages: IAppPage[]
  sections: NavigationSections
}

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

/**
 * Groups app pages by their section header.
 */
export function groupPagesBySection(appPages: IAppPage[]): NavigationSections {
  return groupBy(appPages, page => page.sectionHeader || "")
}

/**
 * Determines if navigation should render with sections based on whether
 * there are any non-empty section headers.
 */
export function hasNonEmptySections(navSections: NavigationSections): boolean {
  return Object.keys(navSections).some(key => key !== "")
}

/**
 * Processes navigation sections to separate individual pages (those with empty
 * section headers) from sectioned pages when there are mixed sections.
 *
 * This ensures consistent behavior between sidebar and top navigation:
 * - Pages with empty section headers ("") are displayed as individual items
 * - Pages with non-empty section headers are grouped into sections
 */
export function processNavigationStructure(
  navSections: NavigationSections
): ProcessedNavigation {
  const hasNamedSections = hasNonEmptySections(navSections)

  if (!hasNamedSections) {
    // If there are no named sections, all pages are individual
    return {
      individualPages: Object.values(navSections).flat(),
      sections: {},
    }
  }

  // If there are named sections, separate empty section pages as individuals
  const individualPages = navSections[""] || []
  const sections: NavigationSections = {}

  Object.entries(navSections).forEach(([header, pages]) => {
    // Only include non-empty section headers
    if (header && header !== "" && header !== "undefined") {
      sections[header] = pages
    }
  })

  return {
    individualPages,
    sections,
  }
}

/**
 * Helper to get all pages in display order (individuals first, then sections)
 */
export function getAllPagesInOrder(
  processed: ProcessedNavigation
): IAppPage[] {
  return [
    ...processed.individualPages,
    ...Object.values(processed.sections).flat(),
  ]
}

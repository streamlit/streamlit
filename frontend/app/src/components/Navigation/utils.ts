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

import { groupBy } from "lodash-es"

import { IAppPage } from "@streamlit/protobuf"
import { isNullOrUndefined } from "@streamlit/utils"

export interface NavigationSections {
  [sectionHeader: string]: IAppPage[]
}

export interface ProcessedNavigation {
  individualPages: IAppPage[]
  sections: NavigationSections
}

/**
 * Returns the external destination URL when the page targets an external
 * destination, otherwise undefined.
 */
export function getExternalPageUrl(page: IAppPage): string | undefined {
  return page.externalUrl ?? undefined
}

/**
 * True when the page destination is external.
 */
export function isExternalPage(page: IAppPage): boolean {
  return !isNullOrUndefined(page.externalUrl)
}

/**
 * Determines if navigation should be shown based on visible pages.
 * Navigation is hidden when there is only 1 or fewer visible pages.
 * Hidden pages (isHidden=true) are excluded from this calculation.
 */
export function shouldShowNavigation(appPages: IAppPage[]): boolean {
  const visiblePageCount = filterVisiblePages(appPages).length
  return visiblePageCount > 1
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
    // groupPagesBySection normalizes missing headers to "".
    // A literal section name like "undefined" is valid and should be preserved.
    if (header) {
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

/**
 * Filters out hidden pages from the app pages list.
 * Hidden pages remain in NavigationContext for URL routing but are not displayed
 * in the navigation menu.
 */
export function filterVisiblePages(pages: IAppPage[]): IAppPage[] {
  return pages.filter(page => !page.isHidden)
}

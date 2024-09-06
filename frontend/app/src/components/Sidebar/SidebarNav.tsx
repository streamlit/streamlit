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

import React, {
  MouseEvent,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"

import groupBy from "lodash/groupBy"
// We import react-device-detect in this way so that tests can mock its
// isMobile field sanely.
import * as reactDeviceDetect from "react-device-detect"

import { IAppPage, StreamlitEndpoints } from "@streamlit/lib"
import { AppContext } from "@streamlit/app/src/components/AppContext"

import NavSection from "./NavSection"
import SidebarNavLink from "./SidebarNavLink"
import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavSeparator,
  StyledViewButton,
} from "./styled-components"

export interface Props {
  endpoints: StreamlitEndpoints
  appPages: IAppPage[]
  navSections: string[]
  collapseSidebar: () => void
  currentPageScriptHash: string
  hasSidebarElements: boolean
  onPageChange: (pageName: string) => void
}

// We make the sidebar nav collapsible when there are more than 12 pages.
const COLLAPSE_THRESHOLD = 12
// However, we show the first 10 pages when the sidebar is collapsed.
const NUM_PAGES_TO_SHOW_WHEN_COLLAPSED = 10

interface NavLinkProps {
  pageUrl: string
  page: IAppPage
  isActive: boolean
  onClick: (e: MouseEvent) => void
}

function NavLink({
  pageUrl,
  page,
  isActive,
  onClick,
}: NavLinkProps): ReactElement {
  const pageName = page.pageName as string

  return (
    <li>
      <SidebarNavLink
        isActive={isActive}
        pageUrl={pageUrl}
        icon={page.icon}
        onClick={onClick}
      >
        {pageName}
      </SidebarNavLink>
    </li>
  )
}

function generateNavSections(
  navSections: string[],
  appPages: IAppPage[],
  needsCollapse: boolean,
  generateNavLink: (page: IAppPage, index: number) => ReactElement
): ReactNode[] {
  const contents: ReactNode[] = []
  const pagesBySectionHeader = groupBy(
    appPages,
    page => page.sectionHeader || ""
  )
  let currentPageCount = 0
  navSections.forEach(header => {
    const sectionPages = pagesBySectionHeader[header] ?? []
    let viewablePages = sectionPages

    if (needsCollapse) {
      if (currentPageCount >= NUM_PAGES_TO_SHOW_WHEN_COLLAPSED) {
        // We cannot even show the section
        return
      } else if (
        currentPageCount + sectionPages.length >
        NUM_PAGES_TO_SHOW_WHEN_COLLAPSED
      ) {
        // We can partially show the section
        viewablePages = sectionPages.slice(
          0,
          NUM_PAGES_TO_SHOW_WHEN_COLLAPSED - currentPageCount
        )
      }
    }
    currentPageCount += viewablePages.length

    contents.push(
      <NavSection key={header} header={header}>
        {viewablePages.map(generateNavLink)}
      </NavSection>
    )
  })

  return contents
}

/** Displays a list of navigable app page links for multi-page apps. */
const SidebarNav = ({
  endpoints,
  appPages,
  collapseSidebar,
  currentPageScriptHash,
  hasSidebarElements,
  navSections,
  onPageChange,
}: Props): ReactElement | null => {
  const [expanded, setExpanded] = useState(false)
  const { pageLinkBaseUrl } = useContext(AppContext)

  const handleViewButtonClick = useCallback(() => {
    setExpanded(!expanded)
  }, [expanded])

  const generateNavLink = useCallback(
    (page: IAppPage, index: number) => {
      const pageUrl = endpoints.buildAppPageURL(pageLinkBaseUrl, page)
      const isActive = page.pageScriptHash === currentPageScriptHash

      return (
        <NavLink
          key={`${page.pageName}-${index}`}
          pageUrl={pageUrl}
          page={page}
          isActive={isActive}
          onClick={e => {
            e.preventDefault()
            onPageChange(page.pageScriptHash as string)
            if (reactDeviceDetect.isMobile) {
              collapseSidebar()
            }
          }}
        />
      )
    },
    [
      collapseSidebar,
      currentPageScriptHash,
      endpoints,
      onPageChange,
      pageLinkBaseUrl,
    ]
  )

  let contents: ReactNode[] = []
  const totalPages = appPages.length
  const shouldShowViewButton =
    hasSidebarElements && totalPages > COLLAPSE_THRESHOLD
  const needsCollapse = shouldShowViewButton && !expanded
  if (navSections.length > 0) {
    // For MPAv2 with headers: renders a NavSection for each header with its respective pages
    contents = generateNavSections(
      navSections,
      appPages,
      needsCollapse,
      generateNavLink
    )
  } else {
    const viewablePages = needsCollapse
      ? appPages.slice(0, NUM_PAGES_TO_SHOW_WHEN_COLLAPSED)
      : appPages
    // For MPAv1 / MPAv2 with no section headers, single NavSection with all pages
    contents = viewablePages.map(generateNavLink)
  }

  return (
    <StyledSidebarNavContainer data-testid="stSidebarNav">
      <StyledSidebarNavItems data-testid="stSidebarNavItems">
        {contents}
      </StyledSidebarNavItems>
      {shouldShowViewButton && (
        <StyledViewButton
          onClick={handleViewButtonClick}
          data-testid="stSidebarNavViewButton"
        >
          {expanded
            ? "View less"
            : `View ${totalPages - NUM_PAGES_TO_SHOW_WHEN_COLLAPSED} more`}
        </StyledViewButton>
      )}
      {hasSidebarElements && (
        <StyledSidebarNavSeparator data-testid="stSidebarNavSeparator" />
      )}
    </StyledSidebarNavContainer>
  )
}

export default SidebarNav

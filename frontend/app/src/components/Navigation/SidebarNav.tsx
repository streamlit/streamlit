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

import React, {
  MouseEvent,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react"

import groupBy from "lodash/groupBy"

import { isMobile } from "@streamlit/lib"
import { localStorageAvailable } from "@streamlit/utils"
import { StreamlitEndpoints } from "@streamlit/connection"
import { IAppPage } from "@streamlit/protobuf"
import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"

import NavSection from "./NavSection"
import SidebarNavLink from "./SidebarNavLink"
import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLinkListItem,
  StyledSidebarNavSeparator,
  StyledViewButton,
} from "./styled-components"

export interface Props {
  endpoints: StreamlitEndpoints
  appPages: IAppPage[]
  collapseSidebar: () => void
  hasSidebarElements: boolean
  onPageChange: (pageName: string) => void
  navSections: string[]
  currentPageScriptHash: string
  expandSidebarNav: boolean
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
    <StyledSidebarNavLinkListItem>
      <SidebarNavLink
        isActive={isActive}
        pageUrl={pageUrl}
        icon={page.icon}
        onClick={onClick}
      >
        {pageName}
      </SidebarNavLink>
    </StyledSidebarNavLinkListItem>
  )
}

function generateNavSections(
  navSections: string[],
  appPages: IAppPage[],
  needsCollapse: boolean,
  generateNavLink: (page: IAppPage, index: number) => ReactElement,
  expandedSections: Record<string, boolean>,
  toggleSection: (section: string) => void
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
    const isExpanded = expandedSections[header]

    if (needsCollapse) {
      const availableSlots =
        NUM_PAGES_TO_SHOW_WHEN_COLLAPSED - currentPageCount
      if (availableSlots <= 0) {
        viewablePages = []
      } else if (sectionPages.length > availableSlots) {
        viewablePages = sectionPages.slice(0, availableSlots)
      }
    }

    if (isExpanded) {
      currentPageCount += viewablePages.length
    }

    contents.push(
      <NavSection
        key={header}
        header={header}
        isExpanded={isExpanded}
        onToggle={() => toggleSection(header)}
      >
        {viewablePages.map(generateNavLink)}
      </NavSection>
    )
  })

  return contents
}

const getLocalStorageKey = (pageLinkBaseUrl: string): string =>
  `sidebarSectionsState-${pageLinkBaseUrl}`

/** Displays a list of navigable app page links for multi-page apps. */
const SidebarNav = ({
  endpoints,
  appPages,
  collapseSidebar,
  hasSidebarElements,
  onPageChange,
  navSections,
  currentPageScriptHash,
  expandSidebarNav,
}: Props): ReactElement | null => {
  const [expanded, setExpanded] = useState(false)
  const { pageLinkBaseUrl } = useAppContext()

  const localStorageKey = getLocalStorageKey(pageLinkBaseUrl)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    const cachedSidebarNavExpanded =
      localStorageAvailable() &&
      window.localStorage.getItem("sidebarNavState") === "expanded"

    if (!expanded && (expandSidebarNav || cachedSidebarNavExpanded)) {
      setExpanded(true)
    }
  }, [expanded, expandSidebarNav])

  useEffect(() => {
    if (localStorageAvailable()) {
      const storedState = window.localStorage.getItem(localStorageKey)
      const initialState = storedState ? JSON.parse(storedState) : {}
      const allSections = navSections.reduce(
        (acc, sectionName) => {
          // Default to expanded
          acc[sectionName] = initialState[sectionName] ?? true
          return acc
        },
        {} as Record<string, boolean>
      )
      setExpandedSections(allSections)
    }
  }, [navSections, localStorageKey])

  useEffect(() => {
    if (localStorageAvailable() && Object.keys(expandedSections).length > 0) {
      window.localStorage.setItem(
        localStorageKey,
        JSON.stringify(expandedSections)
      )
    }
  }, [expandedSections, localStorageKey])

  const toggleSection = useCallback(
    (sectionName: string) => {
      setExpandedSections(prev => ({
        ...prev,
        [sectionName]: !prev[sectionName],
      }))
    },
    [setExpandedSections]
  )

  const handleViewButtonClick = useCallback(() => {
    const nextState = !expanded
    if (localStorageAvailable()) {
      if (nextState) {
        window.localStorage.setItem("sidebarNavState", "expanded")
      } else {
        window.localStorage.removeItem("sidebarNavState")
      }
    }
    setExpanded(nextState)
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
            if (isMobile()) {
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
    hasSidebarElements && totalPages > COLLAPSE_THRESHOLD && !expandSidebarNav
  const needsCollapse = shouldShowViewButton && !expanded
  if (navSections.length > 0) {
    // For MPAv2 with headers: renders a NavSection for each header with its respective pages
    contents = generateNavSections(
      navSections,
      appPages,
      needsCollapse,
      generateNavLink,
      expandedSections,
      toggleSection
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

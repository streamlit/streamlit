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

import React, { ReactElement, useCallback, useRef, useState } from "react"
import { AppContext } from "@streamlit/app/src/components/AppContext"
// We import react-device-detect in this way so that tests can mock its
// isMobile field sanely.
import * as reactDeviceDetect from "react-device-detect"

import {
  DynamicIcon,
  useIsOverflowing,
  StreamlitEndpoints,
  IAppPage,
} from "@streamlit/lib"

import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLink,
  StyledSidebarLinkText,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavSectionHeader,
  StyledSidebarNavSeparator,
  StyledViewButton,
} from "./styled-components"

export interface NavSectionProps {
  endpoints: StreamlitEndpoints
  navSection?: { start: number; length: number }
  currentPageScriptHash: string
  onPageChange: (pageName: string) => void
  collapseSidebar: () => void
  appPages: IAppPage[]
  header?: string
}

const NavSection = ({
  navSection,
  appPages,
  header,
  currentPageScriptHash,
  onPageChange,
  collapseSidebar,
  endpoints,
}: NavSectionProps): ReactElement | null => {
  const { pageLinkBaseUrl } = React.useContext(AppContext)
  let start = 0
  let length = appPages.length
  if (navSection) {
    start = navSection.start
    length = navSection.length
  }
  const pages = appPages.slice(start, start + length)
  return (
    <>
      <StyledSidebarNavSectionHeader>{header}</StyledSidebarNavSectionHeader>
      {pages.map((page: IAppPage, pageIndex: number) => {
        const pageUrl = endpoints.buildAppPageURL(
          pageLinkBaseUrl,
          page,
          pageIndex
        )
        const pageName = page.pageName as string
        const tooltipContent = pageName.replace(/_/g, " ")
        const isActive = page.pageScriptHash === currentPageScriptHash

        return (
          <li key={pageName}>
            <StyledSidebarNavLinkContainer>
              <StyledSidebarNavLink
                data-testid="stSidebarNavLink"
                isActive={isActive}
                href={pageUrl}
                onClick={e => {
                  e.preventDefault()
                  onPageChange(page.pageScriptHash as string)
                  if (reactDeviceDetect.isMobile) {
                    collapseSidebar()
                  }
                }}
              >
                {page.icon && page.icon.length && (
                  <DynamicIcon size="lg" iconValue={page.icon} />
                )}
                <StyledSidebarLinkText isActive={isActive}>
                  {tooltipContent}
                </StyledSidebarLinkText>
              </StyledSidebarNavLink>
            </StyledSidebarNavLinkContainer>
          </li>
        )
      })}
    </>
  )
}

export interface Props {
  endpoints: StreamlitEndpoints
  appPages: IAppPage[]
  navPageSections: Map<string, { start: number; length: number }>
  collapseSidebar: () => void
  currentPageScriptHash: string
  hasSidebarElements: boolean
  onPageChange: (pageName: string) => void
}

/** Displays a list of navigable app page links for multi-page apps. */
const SidebarNav = ({
  endpoints,
  appPages,
  navPageSections,
  collapseSidebar,
  currentPageScriptHash,
  hasSidebarElements,
  onPageChange,
}: Props): ReactElement | null => {
  const [expanded, setExpanded] = useState(false)
  const navItemsRef = useRef<HTMLUListElement>(null)
  const isOverflowing = useIsOverflowing(navItemsRef, expanded)

  const toggleExpanded = useCallback(() => {
    if (!expanded && isOverflowing) {
      setExpanded(true)
    } else if (expanded) {
      setExpanded(false)
    }
  }, [expanded, isOverflowing])

  // if (appPages.length < 2) {
  //   return null
  // }
  const entries = Array.from(navPageSections.entries())

  return (
    <StyledSidebarNavContainer data-testid="stSidebarNav">
      <StyledSidebarNavItems
        ref={navItemsRef}
        isExpanded={expanded}
        data-testid="stSidebarNavItems"
      >
        {entries.map(([header, section]) => {
          return (
            <NavSection
              key={header}
              appPages={appPages}
              navSection={section}
              header={header}
              currentPageScriptHash={currentPageScriptHash}
              onPageChange={onPageChange}
              collapseSidebar={collapseSidebar}
              endpoints={endpoints}
            ></NavSection>
          )
        })}
      </StyledSidebarNavItems>

      {hasSidebarElements && (
        <>
          {isOverflowing && !expanded && (
            <StyledViewButton onClick={toggleExpanded}>
              View more
            </StyledViewButton>
          )}
          {expanded && (
            <StyledViewButton onClick={toggleExpanded}>
              View less
            </StyledViewButton>
          )}
          <StyledSidebarNavSeparator data-testid="stSidebarNavSeparator" />
        </>
      )}
    </StyledSidebarNavContainer>
  )
}

export default SidebarNav

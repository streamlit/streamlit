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
  ReactElement,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react"

import { useIsOverflowing, StreamlitEndpoints, IAppPage } from "@streamlit/lib"

import NavSection from "./NavSection"
import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledViewButton,
  StyledSidebarNavSeparator,
} from "./styled-components"

export interface Props {
  endpoints: StreamlitEndpoints
  appPages: IAppPage[]
  navPageSections: Map<string, IAppPage[]>
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
  const [expanded, setExpanded] = useState(hasSidebarElements ? false : true)
  const [userExpanded, setUserExpanded] = useState(false)
  const navItemsRef = useRef<HTMLUListElement>(null)
  const isOverflowing = useIsOverflowing(navItemsRef, expanded)

  const version1Pages = appPages.length
  const version2Pages = Array.from(navPageSections.values()).flat().length

  // Escape if MPA only has 1 page
  if (version1Pages < 2 && version2Pages < 2) {
    return null
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const toggleExpanded = useCallback(() => {
    if (!expanded && isOverflowing) {
      setExpanded(true)
      setUserExpanded(true)
    } else if (expanded) {
      setExpanded(false)
      setUserExpanded(false)
    }
  }, [expanded, isOverflowing])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // Keep user preference on page change, otherwise default behavior
    if (userExpanded) {
      setExpanded(true)
    } else if (hasSidebarElements && expanded) {
      setExpanded(false)
    } else if (!hasSidebarElements && !expanded) {
      setExpanded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageScriptHash, hasSidebarElements])

  let contents = null
  if (version2Pages > 0) {
    const entries = Array.from(navPageSections.entries())
    // For MPAv2: renders each NavSection with its respective header
    contents = entries.map(([header, section]) => {
      return (
        <NavSection
          key={header}
          header={header}
          sectionPages={section}
          currentPageScriptHash={currentPageScriptHash}
          onPageChange={onPageChange}
          collapseSidebar={collapseSidebar}
          endpoints={endpoints}
        />
      )
    })
  } else {
    // For MPAv1: single NavSection with all pages displayed
    contents = (
      <NavSection
        sectionPages={appPages}
        currentPageScriptHash={currentPageScriptHash}
        onPageChange={onPageChange}
        collapseSidebar={collapseSidebar}
        endpoints={endpoints}
      />
    )
  }

  return (
    <StyledSidebarNavContainer data-testid="stSidebarNav">
      <StyledSidebarNavItems
        ref={navItemsRef}
        isExpanded={expanded}
        hasSidebarElements={hasSidebarElements}
        data-testid="stSidebarNavItems"
      >
        {contents}
      </StyledSidebarNavItems>

      {hasSidebarElements && (
        <>
          {isOverflowing && !expanded && (
            <StyledViewButton
              onClick={toggleExpanded}
              data-testid="stSidebarNavViewMore"
            >
              View more
            </StyledViewButton>
          )}
          {expanded && (
            <StyledViewButton
              onClick={toggleExpanded}
              data-testid="stSidebarNavViewLess"
            >
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

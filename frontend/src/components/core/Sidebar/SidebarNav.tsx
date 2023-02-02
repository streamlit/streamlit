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

import React, { ReactElement, useCallback, useRef, useState } from "react"
// We import react-device-detect in this way so that tests can mock its
// isMobile field sanely.
import * as reactDeviceDetect from "react-device-detect"

import { IAppPage } from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import { EmojiIcon } from "src/components/shared/Icon"
import { useIsOverflowing } from "src/lib/Hooks"

import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLink,
  StyledSidebarLinkText,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavSeparatorContainer,
  StyledSidebarNavButton,
} from "./styled-components"

export interface Props {
  appPages: IAppPage[]
  collapseSidebar: () => void
  currentPageScriptHash: string
  hasSidebarElements: boolean
  hideParentScrollbar: (newValue: boolean) => void
  onPageChange: (pageName: string) => void
  pageLinkBaseUrl: string
}

const SidebarNav = ({
  appPages,
  collapseSidebar,
  currentPageScriptHash,
  hasSidebarElements,
  hideParentScrollbar,
  onPageChange,
  pageLinkBaseUrl,
}: Props): ReactElement | null => {
  if (appPages.length < 2) {
    return null
  }

  // Check localStorage to see if the user has a preference set
  const isLocalStorageSet = localStorage.getItem("navExpanded") !== null
  const shouldNavExpand =
    isLocalStorageSet && localStorage.getItem("navExpanded") === "true"
  const pageLimit = shouldNavExpand === true ? -1 : 6

  const [expanded, setExpanded] = useState(
    hasSidebarElements === true ? false : shouldNavExpand
  )
  const [pagesToShow, setPagesToShow] = useState(
    hasSidebarElements === true ? 6 : pageLimit
  )
  const navItemsRef = useRef<HTMLUListElement>(null)
  const isOverflowing = useIsOverflowing(navItemsRef)
  // We use React.useContext here instead of destructuring it in the imports
  // above so that we can mock it in tests.
  const { getBaseUriParts } = React.useContext(AppContext)

  const onMouseOver = useCallback(() => {
    if (isOverflowing) {
      hideParentScrollbar(true)
    }
  }, [isOverflowing, hideParentScrollbar])

  const onMouseOut = useCallback(
    () => hideParentScrollbar(false),
    [hideParentScrollbar]
  )

  const toggleExpanded = useCallback(() => {
    if (!expanded) {
      setExpanded(true)
      setPagesToShow(-1)
      localStorage.setItem("navExpanded", "true")
    } else if (expanded) {
      setExpanded(false)
      setPagesToShow(6)
      localStorage.setItem("navExpanded", "false")
    }
  }, [expanded])

  return (
    <StyledSidebarNavContainer data-testid="stSidebarNav">
      <StyledSidebarNavItems
        ref={navItemsRef}
        isExpanded={expanded}
        isOverflowing={isOverflowing}
        hasSidebarElements={hasSidebarElements}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
      >
        {appPages
          .slice(0, pagesToShow)
          .map(
            (
              { icon: pageIcon, pageName, pageScriptHash }: IAppPage,
              pageIndex: number
            ) => {
              pageName = pageName as string
              // NOTE: We use window.location to get the port instead of
              // getBaseUriParts() because the port may differ in dev mode (since
              // the frontend is served by the react dev server and not the
              // streamlit server).
              const { port, protocol } = window.location
              const baseUriParts = getBaseUriParts()

              const navigateTo = pageIndex === 0 ? "" : pageName
              let pageUrl = ""

              if (pageLinkBaseUrl) {
                pageUrl = `${pageLinkBaseUrl}/${navigateTo}`
              } else if (baseUriParts) {
                const { basePath, host } = baseUriParts
                const portSection = port ? `:${port}` : ""
                const basePathSection = basePath ? `${basePath}/` : ""

                pageUrl = `${protocol}//${host}${portSection}/${basePathSection}${navigateTo}`
              }

              const tooltipContent = pageName.replace(/_/g, " ")
              const isActive = pageScriptHash === currentPageScriptHash

              return (
                <li key={pageName}>
                  <StyledSidebarNavLinkContainer>
                    <StyledSidebarNavLink
                      isActive={isActive}
                      href={pageUrl}
                      onClick={e => {
                        e.preventDefault()
                        onPageChange(pageScriptHash as string)
                        // If there are widgets on the sidebar after page change,
                        // we want to expand the nav items by default, to prevent layout shift.
                        // We're also checking if the user isn't clicking on the active page,
                        // to avoid expanding/collapsing the menu in that scenario.
                        if (!isActive && hasSidebarElements && !expanded) {
                          toggleExpanded()
                        }
                        if (reactDeviceDetect.isMobile) {
                          collapseSidebar()
                        }
                      }}
                    >
                      {pageIcon && pageIcon.length && (
                        <EmojiIcon size="lg">{pageIcon}</EmojiIcon>
                      )}
                      <StyledSidebarLinkText isActive={isActive}>
                        {tooltipContent}
                      </StyledSidebarLinkText>
                    </StyledSidebarNavLink>
                  </StyledSidebarNavLinkContainer>
                </li>
              )
            }
          )}
      </StyledSidebarNavItems>

      {hasSidebarElements && (
        <StyledSidebarNavSeparatorContainer
          isExpanded={expanded}
          isOverflowing={isOverflowing}
        >
          {!expanded && (
            <StyledSidebarNavButton
              isExpanded={expanded}
              onClick={toggleExpanded}
            >
              {appPages.length - pagesToShow} More
            </StyledSidebarNavButton>
          )}
          {expanded && (
            <StyledSidebarNavButton
              isExpanded={expanded}
              onClick={toggleExpanded}
            >
              View less
            </StyledSidebarNavButton>
          )}
        </StyledSidebarNavSeparatorContainer>
      )}
    </StyledSidebarNavContainer>
  )
}

export default SidebarNav

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

import React, {
  ReactElement,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react"
// We import react-device-detect in this way so that tests can mock its
// isMobile field sanely.
import * as reactDeviceDetect from "react-device-detect"

import { IAppPage } from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import { EmojiIcon } from "src/components/shared/Icon"
import { localStorageAvailable } from "src/lib/storageUtils"

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
  collapseNav: boolean
  hideParentScrollbar: (newValue: boolean) => void
  onPageChange: (pageName: string) => void
  pageLinkBaseUrl: string
}

const SidebarNav = ({
  appPages,
  collapseSidebar,
  collapseNav,
  currentPageScriptHash,
  hasSidebarElements,
  onPageChange,
  pageLinkBaseUrl,
}: Props): ReactElement | null => {
  const [expanded, setExpanded] = useState(!collapseNav)
  const [pagesToShow, setPagesToShow] = useState(
    collapseNav === true ? 6 : appPages.length
  )
  const navItemsRef = useRef<HTMLUListElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  // We use React.useContext here instead of destructuring it in the imports
  // above so that we can mock it in tests.
  const { getBaseUriParts } = React.useContext(AppContext)

  const toggleExpanded = useCallback(
    (target = null) => {
      if (!expanded) {
        setExpanded(true)
        setPagesToShow(appPages.length)

        if (target === toggleButtonRef.current && localStorageAvailable()) {
          localStorage.setItem("navExpanded", "true")
        }
      } else {
        setExpanded(false)
        setPagesToShow(6)

        if (target === toggleButtonRef.current && localStorageAvailable()) {
          localStorage.setItem("navExpanded", "false")
        }
      }
    },
    [expanded]
  )

  useEffect(() => {
    if (collapseNav !== !expanded) {
      toggleExpanded()
    }
  }, [collapseNav])

  return (
    <StyledSidebarNavContainer data-testid="stSidebarNav">
      <StyledSidebarNavItems
        ref={navItemsRef}
        isExpanded={expanded}
        hasSidebarElements={hasSidebarElements}
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
                        if (hasSidebarElements && !isActive && !expanded) {
                          toggleExpanded(e.target)
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

      <StyledSidebarNavSeparatorContainer isExpanded={expanded}>
        <StyledSidebarNavButton
          isExpanded={expanded}
          onClick={e => toggleExpanded(e.target)}
          ref={toggleButtonRef}
        >
          {expanded ? "View less" : `${appPages.length - pagesToShow} More`}
        </StyledSidebarNavButton>
      </StyledSidebarNavSeparatorContainer>
    </StyledSidebarNavContainer>
  )
}

export default SidebarNav

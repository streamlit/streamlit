/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import React, { ReactElement, useCallback, useRef, useState } from "react"
import {
  ExpandMore,
  ExpandLess,
  Description,
} from "@emotion-icons/material-outlined"

import { IAppPage } from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import Icon, { EmojiIcon } from "src/components/shared/Icon"
import { useIsOverflowing } from "src/lib/Hooks"

import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLink,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavSeparatorContainer,
} from "./styled-components"

export interface Props {
  appPages: IAppPage[]
  hasSidebarElements: boolean
  onPageChange: (pageName: string) => void
  hideParentScrollbar: (newValue: boolean) => void

  // BUG(vdonato): currentPageName is not guaranteed to be unique. This means we show 2+ pages
  // as "active" at the same time, if they have the same name.
  //
  // Potential solutions:
  // 1. Add "isActive" boolean to items inside appPages
  // 2. Instead of currentPageName send currentPageIndex (i.e. index of active page in the appPages
  //    array).
  //
  // BUG(tvst): X button should have same color as hamburger.
  // BUG(tvst): X and > buttons should have same margins as hamburger.
  currentPageName: string
  pageLinkBaseUrl: string
}

const SidebarNav = ({
  appPages,
  hasSidebarElements,
  onPageChange,
  hideParentScrollbar,
  currentPageName,
  pageLinkBaseUrl,
}: Props): ReactElement | null => {
  if (appPages.length < 2) {
    return null
  }

  const [expanded, setExpanded] = useState(false)
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

  const onMouseOut = useCallback(() => hideParentScrollbar(false), [
    hideParentScrollbar,
  ])

  const toggleExpanded = useCallback(() => {
    if (!expanded && isOverflowing) {
      setExpanded(true)
    } else if (expanded) {
      setExpanded(false)
    }
  }, [expanded, isOverflowing])

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
        {appPages.map(
          ({ icon: pageIcon, pageName }: IAppPage, pageIndex: number) => {
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

            // The main page can be specified either by its full name or by
            // having currentPageName === "". We could have alternatively made
            // it such that currentPageName is always the full page name, but
            // it turns out that taking that approach makes things messier
            // overall.
            const isActive =
              (pageIndex === 0 && !currentPageName) ||
              currentPageName === pageName

            return (
              <li key={pageName}>
                <StyledSidebarNavLinkContainer>
                  <StyledSidebarNavLink
                    isActive={isActive}
                    href={pageUrl}
                    onClick={e => {
                      e.preventDefault()
                      onPageChange(navigateTo)
                    }}
                  >
                    {pageIcon && pageIcon.length ? (
                      <EmojiIcon size="lg">{pageIcon}</EmojiIcon>
                    ) : (
                      <Icon
                        color="darkenedBgMix100"
                        content={Description}
                        size="lg"
                      />
                    )}
                    <span>{pageName.replace(/_/g, " ")}</span>
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
          onClick={toggleExpanded}
        >
          {isOverflowing && !expanded && (
            <Icon content={ExpandMore} size="md" />
          )}
          {expanded && <Icon content={ExpandLess} size="md" />}
        </StyledSidebarNavSeparatorContainer>
      )}
    </StyledSidebarNavContainer>
  )
}

export default SidebarNav

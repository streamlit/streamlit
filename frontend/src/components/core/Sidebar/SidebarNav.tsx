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
import { ExpandMore, ExpandLess } from "@emotion-icons/material-outlined"

import { AppPage } from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import Icon from "src/components/shared/Icon"
import { useIsOverflowing } from "src/lib/Hooks"

import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLink,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavSeparatorContainer,
} from "./styled-components"

export interface Props {
  pages: AppPage[]
  hasSidebarElements: boolean
  onPageChange: (pageName: string) => void
  hideParentScrollbar: (newValue: boolean) => void
  currentPageName: string
}

// TODO(vdonato): indicate the current page and make it unclickable
const SidebarNav = ({
  appPages,
  hasSidebarElements,
  onPageChange,
  hideParentScrollbar,
  currentPageName,
}: Props): ReactElement | null => {
  if (appPages.length < 2) {
    return null
  }

  const [expanded, setExpanded] = useState(false)
  const navItemsRef = useRef(null)
  const isOverflowing = useIsOverflowing(navItemsRef)
  // We use React.useContext here instead of destructuring it in the imports
  // above so that we can mock it in tests.
  const { getBaseUriParts } = React.useContext(AppContext)

  const onMouseOver = useCallback(() => {
    if (isOverflowing) {
      hideParentScrollbar(true)
    }
  })

  const onMouseOut = useCallback(() => hideParentScrollbar(false))

  const toggleExpanded = useCallback(() => {
    if (!expanded && isOverflowing) {
      setExpanded(true)
    } else if (expanded) {
      setExpanded(false)
    }
  }, [expanded, isOverflowing])

  return (
    <StyledSidebarNavContainer>
      <StyledSidebarNavItems
        ref={navItemsRef}
        expanded={expanded}
        hasSidebarElements={hasSidebarElements}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
      >
        {/* XXX Need some way to tell what the icon is */}
        {appPages.map(({ pageName }: AppPage, pageIndex: number) => {
          // NOTE: We use window.location to get the port instead of
          // getBaseUriParts() because the port may differ in dev mode (since
          // the frontend is served by the react dev server and not the
          // streamlit server).
          const { port, protocol } = window.location
          const { basePath, host } = getBaseUriParts()

          const portSection = port ? `:${port}` : ""
          const basePathSection = basePath ? `${basePath}/` : ""

          const navigateTo = pageIndex === 0 ? "" : pageName
          const pageUrl = `${protocol}//${host}${portSection}/${basePathSection}${navigateTo}`

          return (
            <li key={pageName}>
              <StyledSidebarNavLinkContainer>
                <StyledSidebarNavLink
                  href={pageUrl}
                  onClick={e => {
                    e.preventDefault()
                    onPageChange(navigateTo)
                  }}
                >
                  {pageName.replace(/_/g, " ")}
                </StyledSidebarNavLink>
              </StyledSidebarNavLinkContainer>
            </li>
          )
        })}
      </StyledSidebarNavItems>

      {hasSidebarElements && (
        <StyledSidebarNavSeparatorContainer
          expanded={expanded}
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

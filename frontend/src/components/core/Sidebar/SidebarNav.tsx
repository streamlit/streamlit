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

import React, { ReactElement, useState, useRef, useCallback } from "react"
import { ExpandMore, ExpandLess } from "@emotion-icons/material-outlined"

import { AppPage } from "src/autogen/proto"
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
  // XXX Need some way to tell what's the current page
}

// TODO(vdonato): indicate the current page and make it unclickable
// TODO(vdonato): set links correctly (requires baseUrlPath handling to be done)
const SidebarNav = ({
  appPages,
  hasSidebarElements,
  onPageChange,
  hideParentScrollbar,
}: Props): ReactElement | null => {
  if (appPages.length < 2) {
    return null
  }

  const [expanded, setExpanded] = useState(false)
  const navItemsRef = useRef(null)
  const isOverflowing = useIsOverflowing(navItemsRef)

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
        {appPages.map(({ pageName }: AppPage, pageIndex: number) => (
          <li key={pageName}>
            <StyledSidebarNavLinkContainer>
              <StyledSidebarNavLink
                href={"http://example.com"}
                onClick={e => {
                  e.preventDefault()
                  const navigateTo = pageIndex === 0 ? "" : pageName
                  onPageChange(navigateTo)
                }}
              >
                {pageName.replace(/_/g, " ")}
              </StyledSidebarNavLink>
            </StyledSidebarNavLinkContainer>
          </li>
        ))}
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

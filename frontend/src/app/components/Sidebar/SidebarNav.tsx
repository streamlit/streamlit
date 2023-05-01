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
import { ExpandMore, ExpandLess } from "@emotion-icons/material-outlined"

import { IAppPage } from "src/lib/proto"
import Icon, { EmojiIcon } from "src/lib/components/shared/Icon"
import { useIsOverflowing } from "src/lib/util/Hooks"
import { StreamlitEndpoints } from "src/lib/StreamlitEndpoints"

import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLink,
  StyledSidebarLinkText,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavSeparatorContainer,
} from "./styled-components"

export interface Props {
  endpoints: StreamlitEndpoints
  appPages: IAppPage[]
  collapseSidebar: () => void
  currentPageScriptHash: string
  hasSidebarElements: boolean
  hideParentScrollbar: (newValue: boolean) => void
  onPageChange: (pageName: string) => void
  pageLinkBaseUrl: string
}

/** Displays a list of navigable app page links for multi-page apps. */
const SidebarNav = ({
  endpoints,
  appPages,
  collapseSidebar,
  currentPageScriptHash,
  hasSidebarElements,
  hideParentScrollbar,
  onPageChange,
  pageLinkBaseUrl,
}: Props): ReactElement | null => {
  const [expanded, setExpanded] = useState(false)
  const navItemsRef = useRef<HTMLUListElement>(null)
  const isOverflowing = useIsOverflowing(navItemsRef)

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
    if (!expanded && isOverflowing) {
      setExpanded(true)
    } else if (expanded) {
      setExpanded(false)
    }
  }, [expanded, isOverflowing])

  if (appPages.length < 2) {
    return null
  }

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
        {appPages.map((page: IAppPage, pageIndex: number) => {
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
                    <EmojiIcon size="lg">{page.icon}</EmojiIcon>
                  )}
                  <StyledSidebarLinkText isActive={isActive}>
                    {tooltipContent}
                  </StyledSidebarLinkText>
                </StyledSidebarNavLink>
              </StyledSidebarNavLinkContainer>
            </li>
          )
        })}
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

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

import React, { ReactElement, useState } from "react"

import { AppPage } from "src/autogen/proto"

import {
  StyledSidebarNavContainer,
  StyledSidebarNavItems,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavLink,
  StyledSidebarNavSeparator,
} from "./styled-components"

export interface Props {
  pages: AppPage[]
  hasSidebarElements: boolean
  onPageChange: (pageName: string) => void
}

// TODO(vdonato): indicate the current page and make it unclickable
// TODO(vdonato): set links correctly (requires baseUrlPath handling to be done)
const SidebarNav = ({
  appPages,
  hasSidebarElements,
  onPageChange,
}: Props): ReactElement | null => {
  if (appPages.length < 2) {
    return null
  }

  const [expanded, setExpanded] = useState(false)

  return (
    <StyledSidebarNavContainer>
      <StyledSidebarNavItems expanded={expanded}>
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
        <StyledSidebarNavSeparator
          onClick={() => {
            setExpanded(!expanded)
          }}
        />
      )}
    </StyledSidebarNavContainer>
  )
}

export default SidebarNav

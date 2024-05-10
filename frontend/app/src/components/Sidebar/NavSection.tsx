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

import React, { ReactElement } from "react"
import { AppContext } from "@streamlit/app/src/components/AppContext"
// We import react-device-detect in this way so that tests can mock its
// isMobile field sanely.
import * as reactDeviceDetect from "react-device-detect"

import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"
import { StreamlitEndpoints, IAppPage } from "@streamlit/lib"

import {
  StyledSidebarNavLink,
  StyledSidebarLinkText,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavSectionHeader,
} from "./styled-components"

export interface NavSectionProps {
  endpoints: StreamlitEndpoints
  sectionPages: IAppPage[]
  currentPageScriptHash: string
  onPageChange: (pageName: string) => void
  collapseSidebar: () => void
  header?: string
}

const NavSection = ({
  sectionPages,
  currentPageScriptHash,
  onPageChange,
  collapseSidebar,
  endpoints,
  header = "",
}: NavSectionProps): ReactElement => {
  const { pageLinkBaseUrl } = React.useContext(AppContext)

  return (
    <>
      {header && (
        <StyledSidebarNavSectionHeader>{header}</StyledSidebarNavSectionHeader>
      )}
      {sectionPages.map((page: IAppPage, pageIndex: number) => {
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
                  <DynamicIcon size="md" iconValue={page.icon} />
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

export default NavSection

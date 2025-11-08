/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { useCallback, useContext, useMemo } from "react"

import Overflow from "rc-overflow"

import { StreamlitEndpoints } from "@streamlit/connection"
import { NavigationContext } from "@streamlit/lib"
import { IAppPage } from "@streamlit/protobuf"
import { isNullOrUndefined } from "@streamlit/utils"

import {
  StyledOverflowContainer,
  StyledTopNavLinkContainer,
} from "./styled-components"
import TopNavSection from "./TopNavSection"
import { groupPagesBySection, processNavigationStructure } from "./utils"

import { SidebarNavLink } from "./index"

export interface Props {
  endpoints: StreamlitEndpoints
  widgetsDisabled: boolean
}

const TopNav: React.FC<Props> = ({ endpoints, widgetsDisabled }) => {
  const { pageLinkBaseUrl, currentPageScriptHash, appPages, onPageChange } =
    useContext(NavigationContext)
  const { data, itemKey } = useMemo((): {
    data: (IAppPage | IAppPage[])[]
    itemKey: (item: IAppPage | IAppPage[]) => string
  } => {
    const navSections = groupPagesBySection(appPages)
    const processed = processNavigationStructure(navSections)

    // Combine individual pages and sections for the overflow component
    // Each section's pages should be kept as an array
    const combinedData: (IAppPage | IAppPage[])[] = [
      ...processed.individualPages,
      ...Object.entries(processed.sections).map(([_, pages]) => pages),
    ]

    const keyFn = (item: IAppPage | IAppPage[]): string =>
      Array.isArray(item)
        ? (item[0]?.sectionHeader ?? "")
        : (item.pageScriptHash ?? "")

    return { data: combinedData, itemKey: keyFn }
  }, [appPages])

  const renderItem = useCallback(
    (item: IAppPage | IAppPage[], _info: unknown) => {
      if (Array.isArray(item)) {
        return (
          <TopNavSection
            sections={[item]}
            title={item[0].sectionHeader || ""}
            handlePageChange={onPageChange}
            endpoints={endpoints}
            pageLinkBaseUrl={pageLinkBaseUrl}
            currentPageScriptHash={currentPageScriptHash}
            widgetsDisabled={widgetsDisabled}
          />
        )
      }
      return (
        <StyledTopNavLinkContainer>
          <SidebarNavLink
            isTopNav={true}
            isInDropdown={false}
            isActive={currentPageScriptHash === item.pageScriptHash}
            icon={item.icon}
            pageUrl={endpoints.buildAppPageURL(pageLinkBaseUrl, item)}
            onClick={e => {
              e.preventDefault()
              if (item.pageScriptHash) {
                onPageChange(item.pageScriptHash)
              }
            }}
            widgetsDisabled={widgetsDisabled}
          >
            {String(item.pageName)}
          </SidebarNavLink>
        </StyledTopNavLinkContainer>
      )
    },
    [
      onPageChange,
      endpoints,
      pageLinkBaseUrl,
      currentPageScriptHash,
      widgetsDisabled,
    ]
  )

  const renderRest = useCallback(
    (items: (IAppPage | IAppPage[])[]) => {
      if (isNullOrUndefined(items)) {
        return null
      }

      const totalNumPages = items.flat().length
      const title = `${totalNumPages} more`

      // Convert all items to sections format for the overflow menu
      const sections: IAppPage[][] = items.map(item =>
        Array.isArray(item) ? item : [item]
      )

      return (
        <TopNavSection
          hideChevron={true}
          sections={sections}
          title={title}
          handlePageChange={onPageChange}
          endpoints={endpoints}
          pageLinkBaseUrl={pageLinkBaseUrl}
          currentPageScriptHash={currentPageScriptHash}
          widgetsDisabled={widgetsDisabled}
        />
      )
    },
    [
      onPageChange,
      endpoints,
      pageLinkBaseUrl,
      currentPageScriptHash,
      widgetsDisabled,
    ]
  )

  return (
    <Overflow<IAppPage | IAppPage[]>
      component={StyledOverflowContainer}
      itemKey={itemKey}
      data={data}
      maxCount={"responsive"}
      renderItem={renderItem}
      renderRest={renderRest}
    />
  )
}

export default TopNav

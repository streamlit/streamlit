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

import React, { useCallback, useMemo } from "react"

import groupBy from "lodash/groupBy"
import Overflow from "rc-overflow"

import { StreamlitEndpoints } from "@streamlit/connection"
import { IAppPage } from "@streamlit/protobuf"
import { isNullOrUndefined } from "@streamlit/utils"

import {
  StyledOverflowContainer,
  StyledTopNavLinkContainer,
} from "./styled-components"
import TopNavSection from "./TopNavSection"

import { SidebarNavLink } from "./index"

export interface Props {
  currentPageScriptHash: string
  appPages: IAppPage[]
  onPageChange: (pageScriptHash: string) => void
  pageLinkBaseUrl: string
  endpoints: StreamlitEndpoints
}

const TopNav: React.FC<Props> = ({
  endpoints,
  pageLinkBaseUrl,
  currentPageScriptHash,
  appPages,
  onPageChange,
}) => {
  const navSections = useMemo(() => {
    return groupBy(appPages, p => p.sectionHeader)
  }, [appPages])

  // Check if there are ANY sections (including single sections)
  const hasSections = Object.keys(navSections).some(
    key => key !== "undefined" && key !== ""
  )

  const data = hasSections
    ? Object.values(navSections)
    : Object.values(navSections).flat()

  const itemKey = useCallback((item: IAppPage | IAppPage[]) => {
    return Array.isArray(item)
      ? (item[0]?.sectionHeader ?? "")
      : (item.pageScriptHash ?? "")
  }, [])

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
          />
        )
      }
      return (
        <StyledTopNavLinkContainer>
          <SidebarNavLink
            isTopNav={true}
            isActive={currentPageScriptHash === item.pageScriptHash}
            icon={item.icon}
            pageUrl={endpoints.buildAppPageURL(pageLinkBaseUrl, item)}
            onClick={e => {
              e.preventDefault()
              if (item.pageScriptHash) {
                onPageChange(item.pageScriptHash)
              }
            }}
          >
            {String(item.pageName)}
          </SidebarNavLink>
        </StyledTopNavLinkContainer>
      )
    },
    [onPageChange, endpoints, pageLinkBaseUrl, currentPageScriptHash]
  )

  const renderRest = useCallback(
    (items: (IAppPage | IAppPage[])[]) => {
      if (isNullOrUndefined(items)) {
        return null
      }

      const totalNumPages = items.flat().length
      const title = `${totalNumPages} more`

      if (Array.isArray(items[0])) {
        return (
          <TopNavSection
            hideChevron={true}
            sections={items as IAppPage[][]}
            title={title}
            handlePageChange={onPageChange}
            endpoints={endpoints}
            pageLinkBaseUrl={pageLinkBaseUrl}
            currentPageScriptHash={currentPageScriptHash}
          />
        )
      }
      return (
        <TopNavSection
          hideChevron={true}
          sections={[items as IAppPage[]]}
          title={title}
          handlePageChange={onPageChange}
          endpoints={endpoints}
          pageLinkBaseUrl={pageLinkBaseUrl}
          currentPageScriptHash={currentPageScriptHash}
        />
      )
    },
    [onPageChange, endpoints, pageLinkBaseUrl, currentPageScriptHash]
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

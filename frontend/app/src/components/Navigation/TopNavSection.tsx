/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { Fragment, useState } from "react"

import {
  KeyboardArrowDown,
  KeyboardArrowUp,
} from "@emotion-icons/material-outlined"
import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"

import { StreamlitEndpoints } from "@streamlit/connection"
import {
  convertRemToPx,
  hasLightBackgroundColor,
  Icon,
  useEmotionTheme,
} from "@streamlit/lib"
import { IAppPage } from "@streamlit/protobuf"
import { isNullOrUndefined } from "@streamlit/utils"

import {
  StyledIconContainer,
  StyledNavSection,
  StyledNavSectionText,
  StyledPopoverContent,
  StyledSectionName,
  StyledTopNavSidebarNavLinkContainer,
} from "./styled-components"

import { SidebarNavLink } from "./index"

interface TopNavSectionProps {
  handlePageChange: (pageScriptHash: string) => void
  title: string
  sections: IAppPage[][]
  endpoints: StreamlitEndpoints
  pageLinkBaseUrl: string
  currentPageScriptHash: string
  hideChevron?: boolean
  widgetsDisabled: boolean
}

const TopNavSection = ({
  title,
  sections,
  handlePageChange,
  endpoints,
  pageLinkBaseUrl,
  currentPageScriptHash,
  hideChevron = false,
  widgetsDisabled,
}: TopNavSectionProps): React.ReactElement | null => {
  const [open, setOpen] = useState(false)
  const theme = useEmotionTheme()
  const showSections = sections.length > 1

  if (
    isNullOrUndefined(sections) ||
    sections.length === 0 ||
    sections[0].length === 0
  ) {
    return null
  }

  return (
    <UIPopover
      triggerType={TRIGGER_TYPE.click}
      placement={PLACEMENT.bottomLeft}
      popoverMargin={convertRemToPx(theme.spacing.twoXS)}
      content={() => (
        <StyledPopoverContent data-testid="stTopNavPopover">
          {sections.map((section, _sectionIndex) => {
            const sectionName = section[0].sectionHeader

            return section.map((item, index) => {
              const handleClick = (e: React.MouseEvent): boolean => {
                e.preventDefault()
                if (item.pageScriptHash) {
                  handlePageChange(item.pageScriptHash)
                }
                setOpen(false)
                return false
              }

              // Convert potentially null pageName to string safely
              const pageName = String(item.pageName || "")

              return (
                <Fragment key={`${item.pageScriptHash}-${pageName}`}>
                  {index === 0 && showSections && (
                    <StyledSectionName>{sectionName}</StyledSectionName>
                  )}
                  <StyledTopNavSidebarNavLinkContainer>
                    <SidebarNavLink
                      {...item}
                      icon={item.icon || null}
                      isTopNav={true}
                      isInDropdown={true}
                      isActive={currentPageScriptHash === item.pageScriptHash}
                      onClick={handleClick}
                      pageUrl={endpoints.buildAppPageURL(
                        pageLinkBaseUrl,
                        item
                      )}
                      widgetsDisabled={widgetsDisabled}
                    >
                      {pageName}
                    </SidebarNavLink>
                  </StyledTopNavSidebarNavLinkContainer>
                </Fragment>
              )
            })
          })}
        </StyledPopoverContent>
      )}
      isOpen={open}
      onClickOutside={() => setOpen(false)}
      onClick={() => (open ? setOpen(false) : undefined)}
      onEsc={() => setOpen(false)}
      // Consistently render the content for smoother opening/closing
      renderAll={true}
      overrides={{
        Body: {
          style: () => {
            const lightBackground = hasLightBackgroundColor(theme)
            return {
              marginRight: theme.spacing.lg,
              marginBottom: theme.spacing.lg,

              maxHeight: "70vh",
              minWidth: "8rem",
              overflow: "auto",
              maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2*${theme.spacing.lg})`,

              borderTopLeftRadius: theme.radii.default,
              borderTopRightRadius: theme.radii.default,
              borderBottomRightRadius: theme.radii.default,
              borderBottomLeftRadius: theme.radii.default,

              borderLeftWidth: lightBackground ? 0 : theme.sizes.borderWidth,
              borderRightWidth: lightBackground ? 0 : theme.sizes.borderWidth,
              borderTopWidth: lightBackground ? 0 : theme.sizes.borderWidth,
              borderBottomWidth: lightBackground ? 0 : theme.sizes.borderWidth,

              borderLeftStyle: lightBackground ? "none" : "solid",
              borderRightStyle: lightBackground ? "none" : "solid",
              borderTopStyle: lightBackground ? "none" : "solid",
              borderBottomStyle: lightBackground ? "none" : "solid",

              borderLeftColor: lightBackground
                ? "transparent"
                : theme.colors.borderColor,
              borderRightColor: lightBackground
                ? "transparent"
                : theme.colors.borderColor,
              borderTopColor: lightBackground
                ? "transparent"
                : theme.colors.borderColor,
              borderBottomColor: lightBackground
                ? "transparent"
                : theme.colors.borderColor,

              boxShadow: lightBackground
                ? theme.shadows.popover
                : theme.shadows.none,

              [`@media (max-width: ${theme.breakpoints.sm})`]: {
                maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
              },
            }
          },
        },
      }}
    >
      <div>
        <StyledNavSection
          tabIndex={0}
          onClick={() => setOpen(!open)}
          isOpen={open}
          data-testid="stTopNavSection"
        >
          <StyledNavSectionText>{title}</StyledNavSectionText>
          {!hideChevron && (
            <StyledIconContainer>
              <Icon
                content={open ? KeyboardArrowUp : KeyboardArrowDown}
                size="lg"
              />
            </StyledIconContainer>
          )}
        </StyledNavSection>
      </div>
    </UIPopover>
  )
}

export default TopNavSection

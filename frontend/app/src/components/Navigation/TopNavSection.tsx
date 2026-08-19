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

import { Fragment, useCallback, useRef, useState } from "react"

import {
  KeyboardArrowDown,
  KeyboardArrowUp,
} from "@emotion-icons/material-outlined"
import { FloatingPortal } from "@floating-ui/react"

import { StreamlitEndpoints } from "@streamlit/connection"
import {
  convertRemToPx,
  Icon,
  StreamlitMarkdown,
  useEmotionTheme,
  useFloatingOverlay,
  useOverlayDismissal,
} from "@streamlit/lib"
import { IAppPage } from "@streamlit/protobuf"
import { isNullOrUndefined } from "@streamlit/utils"

import SidebarNavLink from "./SidebarNavLink"
import {
  StyledIconContainer,
  StyledNavSection,
  StyledNavSectionText,
  StyledPopoverContent,
  StyledSectionName,
  StyledTopNavPopoverBody,
  StyledTopNavSidebarNavLinkContainer,
} from "./styled-components"
import { getExternalPageUrl, isExternalPage } from "./utils"

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

  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const { refs, floatingStyles } = useFloatingOverlay({
    open,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
  })

  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen: open,
    onClose: () => setOpen(false),
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
    restoreFocusFn: () => triggerRef.current?.focus(),
  })

  // Attach both triggerRef (for focus restoration) and setReferenceRef
  // (for floating-ui + dismissal hit-testing) to the same button element.
  const setNavSectionRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  if (
    isNullOrUndefined(sections) ||
    sections.length === 0 ||
    sections[0].length === 0
  ) {
    return null
  }

  const popoverContent = sections.map((section, _sectionIndex) => {
    const sectionName = section[0].sectionHeader

    return section.map((item, index) => {
      const isExternal = isExternalPage(item)
      const handleClick = (e: React.MouseEvent): void => {
        // External links are handled by the browser (target="_blank")
        if (isExternal) {
          setOpen(false)
          return
        }
        e.preventDefault()
        if (item.pageScriptHash) {
          handlePageChange(item.pageScriptHash)
        }
        setOpen(false)
      }

      // Convert potentially null pageName to string safely
      const pageName = String(item.pageName || "")

      return (
        <Fragment key={`${item.pageScriptHash}-${pageName}`}>
          {index === 0 && showSections && (
            <StyledSectionName>
              <StreamlitMarkdown
                source={sectionName || ""}
                allowHTML={false}
                isLabel
                disableLinks
                truncate
                inheritFont
              />
            </StyledSectionName>
          )}
          <StyledTopNavSidebarNavLinkContainer>
            <SidebarNavLink
              icon={item.icon || null}
              isTopNav={true}
              isInDropdown={true}
              isActive={currentPageScriptHash === item.pageScriptHash}
              onClick={handleClick}
              pageUrl={endpoints.buildAppPageURL(pageLinkBaseUrl, item)}
              widgetsDisabled={widgetsDisabled}
              isExternal={isExternal}
              externalUrl={getExternalPageUrl(item)}
            >
              {pageName}
            </SidebarNavLink>
          </StyledTopNavSidebarNavLinkContainer>
        </Fragment>
      )
    })
  })

  return (
    <>
      <StyledNavSection
        ref={setNavSectionRef}
        type="button"
        onClick={() => setOpen(prev => !prev)}
        isOpen={open}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="stTopNavSection"
      >
        <StyledNavSectionText>
          <StreamlitMarkdown
            source={title}
            allowHTML={false}
            isLabel
            disableLinks
            truncate
            inheritFont
          />
        </StyledNavSectionText>
        {!hideChevron && (
          <StyledIconContainer>
            <Icon
              content={open ? KeyboardArrowUp : KeyboardArrowDown}
              size="lg"
            />
          </StyledIconContainer>
        )}
      </StyledNavSection>
      {open && (
        <FloatingPortal>
          <StyledTopNavPopoverBody
            ref={setFloatingRef}
            style={floatingStyles}
            data-testid="stTopNavPopoverBody"
          >
            <StyledPopoverContent data-testid="stTopNavPopover">
              {popoverContent}
            </StyledPopoverContent>
          </StyledTopNavPopoverBody>
        </FloatingPortal>
      )}
    </>
  )
}

export default TopNavSection

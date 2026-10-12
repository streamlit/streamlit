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

import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  KeyboardArrowDown,
  KeyboardArrowUp,
} from "@emotion-icons/material-outlined"
import { FloatingPortal } from "@floating-ui/react"

import {
  focusNextTabbable,
  focusPrevTabbable,
} from "@streamlit/app/src/components/MainMenu/focusTabbable"
import type { StreamlitEndpoints } from "@streamlit/connection"
import {
  convertRemToPx,
  Icon,
  StreamlitMarkdown,
  useEmotionTheme,
  useFloatingOverlay,
  useOverlayDismissal,
} from "@streamlit/lib"
import type { AppPage } from "@streamlit/protobuf"
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
  sections: AppPage.$Properties[][]
  endpoints: StreamlitEndpoints
  pageLinkBaseUrl: string
  currentPageScriptHash: string
  hideChevron?: boolean
  widgetsDisabled: boolean
}

/** Why the menu was closed — drives focus-return behavior. */
type CloseReason = "escape" | "tab" | "shift-tab" | "other"

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
  const menuId = useId()
  const theme = useEmotionTheme()
  const showSections = sections.length > 1

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuItemLinksRef = useRef<Array<HTMLAnchorElement | null>>([])
  const closeReasonRef = useRef<CloseReason>("other")
  const prevOpenRef = useRef(false)
  const openFocusIndexRef = useRef(0)

  const flatLinkCount = useMemo(
    () => sections.reduce((count, section) => count + section.length, 0),
    [sections]
  )

  const sectionLinkOffsets = useMemo(() => {
    const offsets: number[] = []
    let total = 0
    for (const section of sections) {
      offsets.push(total)
      total += section.length
    }
    return offsets
  }, [sections])
  const lastLinkIndex = Math.max(0, flatLinkCount - 1)

  const [focusedIndex, setFocusedIndex] = useState(0)
  const clampedIndex =
    flatLinkCount === 0 ? -1 : Math.min(focusedIndex, lastLinkIndex)

  const closeMenu = useCallback((reason: CloseReason = "other"): void => {
    closeReasonRef.current = reason
    setOpen(false)
  }, [])

  const { floatingStyles, setFloating, setReference } = useFloatingOverlay({
    open,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
  })

  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen: open,
    onClose: () => closeMenu("other"),
    floatingSetFn: setFloating,
    referenceSetFn: setReference,
  })

  useLayoutEffect(() => {
    if (prevOpenRef.current && !open) {
      const reason = closeReasonRef.current
      closeReasonRef.current = "other"
      const button = triggerRef.current
      if (button) {
        if (reason === "tab") {
          focusNextTabbable(button)
        } else if (reason === "shift-tab") {
          focusPrevTabbable(button)
        } else {
          button.focus()
        }
      }
    }
    prevOpenRef.current = open
  }, [open])

  const setNavSectionRef = useCallback(
    (node: HTMLButtonElement | null): void => {
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  const focusLinkAtIndex = useCallback((index: number): void => {
    setFocusedIndex(index)
    menuItemLinksRef.current[index]?.focus()
  }, [])

  const setLinkRef = useCallback(
    (index: number) =>
      (element: HTMLAnchorElement | null): void => {
        menuItemLinksRef.current[index] = element
      },
    []
  )

  const menuListRef = useCallback((node: HTMLDivElement | null): void => {
    if (node) {
      const index = Math.min(
        openFocusIndexRef.current,
        Math.max(0, menuItemLinksRef.current.length - 1)
      )
      openFocusIndexRef.current = 0
      menuItemLinksRef.current[index]?.focus()
      setFocusedIndex(index)
    }
  }, [])

  const handleMenuFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLAnchorElement)) {
      return
    }
    const index = menuItemLinksRef.current.findIndex(el => el === target)
    if (index !== -1) {
      setFocusedIndex(index)
    }
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (flatLinkCount === 0) {
      return
    }

    const target = event.target
    if (
      event.key === " " &&
      target instanceof HTMLAnchorElement &&
      target.getAttribute("role") === "menuitem"
    ) {
      event.preventDefault()
      target.click()
      return
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault()
        focusLinkAtIndex(clampedIndex >= lastLinkIndex ? 0 : clampedIndex + 1)
        break
      }
      case "ArrowUp": {
        event.preventDefault()
        focusLinkAtIndex(clampedIndex <= 0 ? lastLinkIndex : clampedIndex - 1)
        break
      }
      case "Home": {
        event.preventDefault()
        focusLinkAtIndex(0)
        break
      }
      case "End": {
        event.preventDefault()
        focusLinkAtIndex(lastLinkIndex)
        break
      }
      case "Tab": {
        event.preventDefault()
        closeMenu(event.shiftKey ? "shift-tab" : "tab")
        break
      }
      default:
        break
    }
  }

  const openMenu = useCallback((): void => {
    openFocusIndexRef.current = 0
    setFocusedIndex(0)
    setOpen(true)
  }, [])

  const handleTriggerClick = (): void => {
    if (open) {
      closeMenu("other")
    } else {
      openMenu()
    }
  }

  const handleTriggerKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>
  ): void => {
    if (open || flatLinkCount === 0) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      openFocusIndexRef.current = 0
      setFocusedIndex(0)
      setOpen(true)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      openFocusIndexRef.current = lastLinkIndex
      setFocusedIndex(lastLinkIndex)
      setOpen(true)
    }
  }

  if (
    isNullOrUndefined(sections) ||
    sections.length === 0 ||
    sections[0].length === 0
  ) {
    return null
  }

  const renderPageLink = (
    item: AppPage.$Properties,
    currentLinkIndex: number
  ): React.ReactElement => {
    const isExternal = isExternalPage(item)
    const handleClick = (e: React.MouseEvent): void => {
      if (isExternal) {
        closeMenu()
        return
      }
      e.preventDefault()
      if (item.pageScriptHash) {
        handlePageChange(item.pageScriptHash)
      }
      closeMenu()
    }

    const pageName = item.pageName ?? ""

    return (
      <StyledTopNavSidebarNavLinkContainer
        key={`${item.pageScriptHash}-${pageName}`}
      >
        <SidebarNavLink
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank icon means no icon
          icon={item.icon || null}
          isTopNav={true}
          isInDropdown={true}
          isActive={currentPageScriptHash === item.pageScriptHash}
          onClick={handleClick}
          pageUrl={endpoints.buildAppPageURL(pageLinkBaseUrl, item)}
          widgetsDisabled={widgetsDisabled}
          isExternal={isExternal}
          externalUrl={getExternalPageUrl(item)}
          menuTabIndex={clampedIndex === currentLinkIndex ? 0 : -1}
          itemRef={setLinkRef(currentLinkIndex)}
        >
          {pageName}
        </SidebarNavLink>
      </StyledTopNavSidebarNavLinkContainer>
    )
  }

  const popoverContent = sections.map((section, sectionIndex) => {
    const sectionName = section[0].sectionHeader ?? ""
    const sectionLabel =
      sectionName.trim() || (section[0].pageName ?? "").trim()
    const links = section.map((item, itemIndex) =>
      renderPageLink(item, sectionLinkOffsets[sectionIndex] + itemIndex)
    )

    if (!showSections) {
      return links
    }

    const sectionKey = `${section[0].pageScriptHash ?? ""}-${sectionLabel}`

    return (
      <div key={sectionKey} role="group" aria-label={sectionLabel}>
        <StyledSectionName>
          <StreamlitMarkdown
            source={sectionName || sectionLabel}
            allowHTML={false}
            isLabel
            disableLinks
            truncate
            inheritFont
          />
        </StyledSectionName>
        {links}
      </div>
    )
  })

  return (
    <>
      <StyledNavSection
        ref={setNavSectionRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        isOpen={open}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
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
          <StyledIconContainer aria-hidden="true">
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
            <StyledPopoverContent
              ref={menuListRef}
              id={menuId}
              data-testid="stTopNavPopover"
              role="menu"
              aria-label={title}
              onFocus={handleMenuFocus}
              onKeyDown={handleMenuKeyDown}
            >
              {popoverContent}
            </StyledPopoverContent>
          </StyledTopNavPopoverBody>
        </FloatingPortal>
      )}
    </>
  )
}

export default TopNavSection

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
  Fragment,
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
} from "@streamlit/app/src/util/focusTabbable"
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
type CloseReason = "tab" | "shift-tab" | "other"

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
  const triggerId = useId()
  const theme = useEmotionTheme()
  const showSections = sections.length > 1

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuItemLinksRef = useRef<Array<HTMLAnchorElement | null>>([])
  const closeReasonRef = useRef<CloseReason>("other")
  const prevOpenRef = useRef(false)
  const openRef = useRef(open)
  openRef.current = open
  /** Item index to focus when the menu mounts (ArrowUp opens on the last). */
  const initialFocusIndexRef = useRef(0)

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
  /**
   * Index of the roving-focus menu item, or -1 when there are no links.
   * Clamped because overflow recalculation can shrink `sections` while open.
   */
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
    onClose: closeMenu,
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
          // Return focus to the trigger unless another control already holds it.
          // Escape and page activation unmount the focused menuitem, dropping focus
          // to body. An outside click runs this on pointerdown, before mousedown
          // moves focus to the clicked control, so that control still wins.
          const active = document.activeElement
          if (
            !active ||
            active === document.body ||
            active === button ||
            !button.ownerDocument.contains(active)
          ) {
            button.focus()
          }
        }
      }
      // Drop trailing slots from a larger open menu so length matches mounts.
      menuItemLinksRef.current = []
    }
    prevOpenRef.current = open
  }, [open])

  const setNavSectionRef = useCallback(
    (node: HTMLButtonElement | null): void => {
      // rc-overflow can clear "N more" while the menu is open. The trigger then
      // unmounts in this commit (refs clear before layout effects), so hand focus
      // to the preceding header control — usually the page that just became
      // visible — before the button disappears.
      if (node === null && triggerRef.current && openRef.current) {
        const dying = triggerRef.current
        const active = document.activeElement
        const activeInMenu =
          active instanceof HTMLElement &&
          menuItemLinksRef.current.some(el => el === active)
        if (
          !active ||
          active === document.body ||
          active === dying ||
          activeInMenu
        ) {
          focusPrevTabbable(dying)
        }
      }
      triggerRef.current = node
      setReferenceRef(node)
    },
    [setReferenceRef]
  )

  const focusLinkAtIndex = useCallback((index: number): void => {
    setFocusedIndex(index)
    menuItemLinksRef.current[index]?.focus()
  }, [])

  // When rc-overflow moves pages in or out of the open "N more" menu, keep
  // focus on the same page, or on the nearest remaining item if that page left.
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    if (flatLinkCount === 0) {
      closeMenu("other")
      return
    }
    // Truncate after shrink so length matches mounted items (not stale nulls).
    menuItemLinksRef.current.length = flatLinkCount
    const active = document.activeElement
    const activeIndex =
      active instanceof HTMLElement
        ? menuItemLinksRef.current.findIndex(el => el === active)
        : -1
    if (activeIndex !== -1) {
      if (activeIndex !== focusedIndex) {
        setFocusedIndex(activeIndex)
      }
      return
    }
    // Only restore when focus fell to body (item unmounted). Skip null
    // activeElement (blurred document / embed) and other focused controls.
    if (active === document.body) {
      focusLinkAtIndex(clampedIndex)
    }
  }, [
    open,
    flatLinkCount,
    focusedIndex,
    clampedIndex,
    closeMenu,
    focusLinkAtIndex,
    // sections: re-run when overflow swaps pages without changing the count.
    sections,
  ])

  // Keep the ref setter stable so focus changes do not detach and reattach
  // every menuitem ref.
  const setMenuItemRef = useCallback(
    (index: number, element: HTMLAnchorElement | null): void => {
      menuItemLinksRef.current[index] = element
    },
    []
  )

  /**
   * Focuses the initial item (last for ArrowUp, otherwise first) once the menu
   * DOM mounts. A layout effect can't do this: FloatingPortal mounts its
   * children one commit after `open` turns true. Child anchor refs run before
   * this ref, so the target already exists.
   */
  const menuListRef = useCallback((node: HTMLDivElement | null): void => {
    if (node) {
      const mountedCount = menuItemLinksRef.current.filter(Boolean).length
      const index = Math.min(
        initialFocusIndexRef.current,
        Math.max(0, mountedCount - 1)
      )
      initialFocusIndexRef.current = 0
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
      target instanceof HTMLAnchorElement &&
      target.getAttribute("role") === "menuitem"
    ) {
      // Anchors activate on Enter, not Space, so Space synthesizes a click.
      // Leave Enter to the browser so modifier keys reach the click handler.
      // That handler still keeps internal pages in-app.
      if (event.key === " ") {
        event.preventDefault()
        if (!widgetsDisabled) {
          target.click()
        }
        return
      }
      if (event.key === "Enter" && widgetsDisabled) {
        event.preventDefault()
        return
      }
    }

    // Escape closes through useOverlayDismissal. The layout effect then focuses
    // the trigger.
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

  const openMenuAt = useCallback((index: number): void => {
    initialFocusIndexRef.current = index
    setFocusedIndex(index)
    setOpen(true)
  }, [])

  const handleTriggerClick = (): void => {
    if (open) {
      closeMenu("other")
    } else {
      openMenuAt(0)
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
      openMenuAt(0)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      openMenuAt(lastLinkIndex)
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
      if (widgetsDisabled) {
        e.preventDefault()
        return
      }
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
        role="none"
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
          setMenuItemRef={setMenuItemRef}
          menuItemIndex={currentLinkIndex}
        >
          {pageName}
        </SidebarNavLink>
      </StyledTopNavSidebarNavLinkContainer>
    )
  }

  const popoverContent = sections.map((section, sectionIndex) => {
    const sectionName = section[0].sectionHeader ?? ""
    const trimmedSectionName = sectionName.trim()
    const links = section.map((item, itemIndex) =>
      renderPageLink(item, sectionLinkOffsets[sectionIndex] + itemIndex)
    )

    if (!showSections) {
      return links
    }

    // Stable keys keep a focused menuitem mounted when the overflow list shrinks.
    // A changed key remounts the row and drops keyboard focus.
    // - Named section: original sectionHeader, including whitespace, matching TopNav.
    // - Sectionless page: that page's script hash.
    // Trim the header only to decide whether to render a group label.
    let sectionKey: string
    if (sectionName) {
      sectionKey = sectionName
    } else {
      sectionKey = section[0].pageScriptHash ?? `section-${sectionIndex}`
    }

    // Sectionless overflow pages render as plain menuitems, without a header
    // or group wrapper.
    if (!trimmedSectionName) {
      return <Fragment key={sectionKey}>{links}</Fragment>
    }

    const headerId = `${menuId}-section-${sectionIndex}`

    return (
      <div key={sectionKey} role="group" aria-labelledby={headerId}>
        <StyledSectionName id={headerId}>
          <StreamlitMarkdown
            source={sectionName}
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
        id={triggerId}
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
              aria-labelledby={triggerId}
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

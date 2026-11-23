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
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
  useCallback,
  useId,
  useMemo,
} from "react"

import {
  DynamicIcon,
  isMaterialIcon,
  Placement,
  StreamlitMarkdown,
  Tooltip,
  useEmotionTheme,
} from "@streamlit/lib"
import { isNullOrEmptyString } from "@streamlit/utils"

import {
  StyledSidebarLinkText,
  StyledSidebarNavIcon,
  StyledSidebarNavLink,
  StyledSidebarNavLinkContainer,
  StyledSidebarNavLinkHelpDescription,
  StyledVisuallyHidden,
} from "./styled-components"

/**
 * Hover delay for page help on nav items. The pointer crosses the nav on the
 * way to most clicks, so this waits longer than the 500ms help delay of
 * buttons and page links.
 */
export const NAV_HELP_TOOLTIP_HOVER_DELAY_MS = 1000

/**
 * Lays out the tooltip trigger as a column, like the link container, so the
 * link keeps the full row width.
 */
const NAV_HELP_TRIGGER_STYLE: CSSProperties = { flexDirection: "column" }

/**
 * Keeps focus on the nav link when a link in its help tooltip is pressed.
 * Focus moving into the popup would blur the link, which closes a tooltip
 * held open by keyboard focus before the click reaches the help link.
 */
function handleHelpTooltipMouseDown(event: MouseEvent<HTMLDivElement>): void {
  if (event.target instanceof Element && event.target.closest("a")) {
    event.preventDefault()
  }
}

export interface SidebarNavLinkProps {
  isActive: boolean
  pageUrl: string
  icon: string | undefined | null
  onClick: (e: MouseEvent) => void
  isTopNav?: boolean
  isInDropdown?: boolean
  children: string
  widgetsDisabled: boolean
  isExternal?: boolean
  externalUrl?: string | null
  /** Roving tabindex for top-nav dropdown menu keyboard navigation. */
  menuTabIndex?: number
  /** Stores the anchor so top-nav dropdown menus can move focus between items. */
  setMenuItemRef?: (index: number, element: HTMLAnchorElement | null) => void
  /** Position of this link among the top-nav dropdown menuitems. */
  menuItemIndex?: number
  /**
   * The page's help Markdown from `st.Page(help=...)`. Shown as the link's
   * tooltip and always exposed as its accessible description.
   */
  help?: string | null
}

const SidebarNavLink = ({
  isActive,
  pageUrl,
  icon,
  onClick,
  isTopNav = false,
  isInDropdown = false,
  children,
  widgetsDisabled,
  isExternal = false,
  externalUrl,
  menuTabIndex,
  setMenuItemRef,
  menuItemIndex,
  help,
}: SidebarNavLinkProps): ReactElement => {
  const theme = useEmotionTheme()
  const helpDescriptionId = useId()
  // Memoized, so nav updates that keep the same help do not render its
  // Markdown again. The description copy renders links as text, so it adds
  // no tab stops.
  const helpContent = useMemo(
    () =>
      isNullOrEmptyString(help)
        ? null
        : {
            tooltip: (
              // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- only keeps focus on the nav link; links inside stay the interactive elements
              <div onMouseDown={handleHelpTooltipMouseDown}>
                <StreamlitMarkdown source={help} allowHTML={false} />
              </div>
            ),
            description: (
              <StreamlitMarkdown
                source={help}
                allowHTML={false}
                isLabel
                disableLinks
              />
            ),
          },
    [help]
  )
  // If connection state not connected, or host has disabled inputs,
  // disable sidebar nav links
  const disableSidebarNavLinks = widgetsDisabled

  // Determine the appropriate test ID based on context
  let navLinkTestId: string
  if (isTopNav && isInDropdown) {
    navLinkTestId = "stTopNavDropdownLink"
  } else if (isTopNav) {
    navLinkTestId = "stTopNavLink"
  } else {
    navLinkTestId = "stSidebarNavLink"
  }
  const navLinkContainerTestId = isTopNav
    ? "stTopNavLinkContainer"
    : "stSidebarNavLinkContainer"

  // External pages can never be the current page
  const effectiveIsActive = isExternal ? false : isActive

  const setAnchorRef = useCallback(
    (element: HTMLAnchorElement | null): void => {
      if (setMenuItemRef && menuItemIndex !== undefined) {
        setMenuItemRef(menuItemIndex, element)
      }
    },
    [setMenuItemRef, menuItemIndex]
  )

  const link = (
    <StyledSidebarNavLink
      ref={setAnchorRef}
      data-testid={navLinkTestId}
      isActive={effectiveIsActive}
      disabled={disableSidebarNavLinks}
      isInDropdown={isInDropdown}
      href={isExternal ? (externalUrl ?? pageUrl) : pageUrl}
      onClick={onClick}
      aria-current={effectiveIsActive ? "page" : undefined}
      // Disabled dropdown menuitems stay focusable (WAI-ARIA). pointer-events:
      // none blocks clicks, and TopNavSection blocks keyboard activation.
      aria-disabled={isInDropdown && disableSidebarNavLinks ? true : undefined}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      role={isInDropdown ? "menuitem" : undefined}
      tabIndex={isInDropdown ? menuTabIndex : undefined}
      aria-describedby={helpContent ? helpDescriptionId : undefined}
    >
      {icon?.length ? (
        <StyledSidebarNavIcon isActive={effectiveIsActive}>
          <DynamicIcon
            size="base"
            iconValue={icon}
            color={
              !effectiveIsActive && isMaterialIcon(icon)
                ? // Apply color with opacity on material icons
                  // But we don't want to apply opacity on emoji icons
                  theme.colors.fadedText60
                : theme.colors.bodyText
            }
          />
        </StyledSidebarNavIcon>
      ) : null}
      <StyledSidebarLinkText
        isActive={effectiveIsActive}
        disabled={disableSidebarNavLinks}
        isTopNav={isTopNav}
        label={children}
      >
        <StreamlitMarkdown
          source={children}
          allowHTML={false}
          isLabel
          disableLinks
          truncate
          inheritFont
        />
      </StyledSidebarLinkText>
      {isExternal && (
        <StyledVisuallyHidden>(opens in new tab)</StyledVisuallyHidden>
      )}
    </StyledSidebarNavLink>
  )

  return (
    <StyledSidebarNavLinkContainer
      disabled={disableSidebarNavLinks}
      data-testid={navLinkContainerTestId}
      role={isInDropdown ? "none" : undefined}
    >
      {helpContent ? (
        <>
          {/*
            Nav-specific tooltip behavior:
            - hideFromAssistiveTech: the hidden copy below is the link's
              description, so the popup would announce the help twice.
            - openOnTouch={false}: a tap navigates, so touch shows no popup.
            - dismissOnClick: a click closes the popup and cancels a pending
              open, so it does not appear on the page the click opens.
            - fitAvailableWidth: long help wraps instead of running off screen.
          */}
          <Tooltip
            content={helpContent.tooltip}
            placement={
              isTopNav && !isInDropdown ? Placement.BOTTOM : Placement.RIGHT
            }
            onMouseEnterDelay={NAV_HELP_TOOLTIP_HOVER_DELAY_MS}
            style={NAV_HELP_TRIGGER_STYLE}
            hideFromAssistiveTech
            openOnTouch={false}
            dismissOnClick
            fitAvailableWidth
          >
            {link}
          </Tooltip>
          {/*
            aria-hidden keeps browse mode from reading the help a second time
            as page text. aria-describedby still reads aria-hidden content.
          */}
          <StyledSidebarNavLinkHelpDescription
            id={helpDescriptionId}
            aria-hidden="true"
          >
            {helpContent.description}
          </StyledSidebarNavLinkHelpDescription>
        </>
      ) : (
        link
      )}
    </StyledSidebarNavLinkContainer>
  )
}

export default SidebarNavLink

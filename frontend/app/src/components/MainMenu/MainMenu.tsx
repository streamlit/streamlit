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

import { memo, ReactElement, useCallback, useMemo } from "react"

import { MoreVert } from "@emotion-icons/material-rounded"
import { ACCESSIBILITY_TYPE, PLACEMENT, StatefulPopover } from "baseui/popover"
import { getLogger } from "loglevel"

import type { Steps } from "@streamlit/app/src/hocs/withScreencast/withScreencast"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import {
  BaseButton,
  BaseButtonKind,
  Icon,
  IGuestToHostMessage,
  IMenuItem,
  useEmotionTheme,
} from "@streamlit/lib"
import { Config, PageConfig } from "@streamlit/protobuf"

import {
  StyledMainMenuContainer,
  StyledMenuContainer,
  StyledMenuDivider,
  StyledMenuItemContent,
  StyledMenuItemLabel,
  StyledMenuItemRow,
  StyledMenuItemShortcut,
  StyledRecordingIndicator,
} from "./styled-components"

const LOG = getLogger("MainMenu")

const SCREENCAST_LABEL: { [s: string]: string } = {
  COUNTDOWN: "Cancel recording",
  RECORDING: "Stop recording",
}

/**
 * Opens a URL in a new browser tab/window with error handling.
 * Logs a warning if the popup is blocked or fails to open.
 */
function openInNewTab(url: string, label: string): void {
  const newWindow = window.open(url, "_blank")
  if (!newWindow) {
    LOG.warn(
      `Failed to open "${label}" link. This may be due to a popup blocker. URL: ${url}`
    )
  }
}

export interface Props {
  /** True if we're connected to the Streamlit server. */
  isServerConnected: boolean

  /** Rerun the current script. */
  quickRerunCallback: () => void

  /** Clear the cache. */
  clearCacheCallback: () => void

  /** Show the screen recording dialog. */
  screencastCallback: () => void

  /** Show the Settings dialog. */
  settingsCallback: () => void

  /** Show the About dialog. */
  aboutCallback: () => void

  /** Open the Print Dialog, if the app is in iFrame first open a new tab with app URL */
  printCallback: () => void

  screenCastState: Steps

  hostMenuItems: IMenuItem[]

  sendMessageToHost: (message: IGuestToHostMessage) => void

  menuItems?: PageConfig.IMenuItems | null

  developmentMode: boolean

  toolbarMode: Config.ToolbarMode

  metricsMgr: MetricsManager
}

/** Configuration for a single menu item (pure data, no React elements) */
interface MenuItemConfig {
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
  isRecording?: boolean
  shortcut?: string
}

/** A section is a group of items separated by dividers */
type MenuSection = MenuItemConfig[]

/**
 * Builds all menu sections as pure data.
 * Returns an array of sections, where each section is an array of item configs.
 * Empty sections are automatically filtered out during rendering.
 *
 * Menu structure (normal mode):
 *   Section 1: Rerun, Settings
 *   --- divider ---
 *   Section 2: Clear cache (dev mode only)
 *   --- divider ---
 *   Section 3: Print, Record screen
 *   --- divider ---
 *   Section 4: Report a bug, Get help, Host items
 *   --- divider ---
 *   Section 5: About
 *
 * Menu structure (minimal mode):
 *   Section 1: Report a bug, Get help, Host items
 *   --- divider ---
 *   Section 2: About
 *   (only shown if any items are configured)
 */
function buildMenuData(props: Props, isMinimalMode: boolean): MenuSection[] {
  const isServerDisconnected = !props.isServerConnected

  // Common items and About appear in both normal and minimal modes
  const commonItems = buildCommonItems(props)
  const aboutItems = buildAboutItem(props)

  if (isMinimalMode) {
    return [commonItems, aboutItems]
  }

  // Normal mode: all sections
  return [
    buildPrimaryItems(props, isServerDisconnected),
    buildDevItems(props, isServerDisconnected),
    buildStandardItems(props),
    commonItems,
    aboutItems,
  ]
}

/**
 * Primary actions: Rerun, Settings
 *
 * Note: Keyboard shortcuts are displayed uppercase for design consistency.
 * The react-hot-keys library normalizes key presses to lowercase, so both
 * 'r' and 'R' trigger the Rerun action (same for 'c'/'C' and Clear cache).
 */
function buildPrimaryItems(
  props: Props,
  isServerDisconnected: boolean
): MenuSection {
  return [
    {
      key: "rerun",
      label: "Rerun",
      onClick: props.quickRerunCallback,
      disabled: isServerDisconnected,
      shortcut: "R",
    },
    {
      key: "settings",
      label: "Settings",
      onClick: props.settingsCallback,
    },
  ]
}

/** Developer items: Clear cache (only in development mode) */
function buildDevItems(
  props: Props,
  isServerDisconnected: boolean
): MenuSection {
  if (!props.developmentMode) {
    return []
  }

  return [
    {
      key: "clearCache",
      label: "Clear cache",
      onClick: props.clearCacheCallback,
      disabled: isServerDisconnected,
      shortcut: "C",
    },
  ]
}

/** Standard items: Print, Record screen */
function buildStandardItems(props: Props): MenuSection {
  const items: MenuSection = [
    {
      key: "print",
      label: "Print",
      onClick: props.printCallback,
    },
  ]

  if (ScreenCastRecorder.isSupportedBrowser()) {
    const screencastLabel =
      SCREENCAST_LABEL[props.screenCastState] || "Record screen"
    items.push({
      key: "recordScreencast",
      label: screencastLabel,
      onClick: props.screencastCallback,
      isRecording: Boolean(SCREENCAST_LABEL[props.screenCastState]),
    })
  }

  return items
}

/**
 * Builds common menu items: Report bug, Get help, host items.
 * These appear in both normal and minimal toolbar modes.
 *
 * Order: Report a bug → Get help → Host items
 *
 * Host/Developer precedence rules:
 * - Developer settings (via st.set_page_config) can override host items
 * - If developer provides aboutSectionMd, host's "about" item is hidden
 * - If developer sets hideGetHelp, host's "reportBug" item is hidden
 * - Non-conflicting host items (e.g., "Fork this app") are shown alongside
 *   developer-configured items
 */
function buildCommonItems(props: Props): MenuSection {
  const items: MenuSection = []
  const { menuItems } = props

  // Report a bug - shown if URL provided and not hidden
  const reportABugUrl = menuItems?.reportABugUrl
  if (reportABugUrl && !menuItems?.hideReportABug) {
    items.push({
      key: "report",
      label: "Report a bug",
      onClick: () => openInNewTab(reportABugUrl, "Report a bug"),
    })
  }

  // Get help - shown if URL provided and not hidden
  const getHelpUrl = menuItems?.getHelpUrl
  if (getHelpUrl && !menuItems?.hideGetHelp) {
    items.push({
      key: "community",
      label: "Get help",
      onClick: () => openInNewTab(getHelpUrl, "Get help"),
    })
  }

  // Host menu items - injected by host (e.g., Streamlit Cloud)
  // Some host items are hidden if developer settings conflict
  for (const hostItem of props.hostMenuItems) {
    if (hostItem.type === "separator") continue
    // Hide host's reportBug if developer wants to hide help-related items
    if (hostItem.key === "reportBug" && menuItems?.hideGetHelp) continue
    // Hide host's about if developer provides custom About content
    if (hostItem.key === "about" && menuItems?.aboutSectionMd) continue

    items.push({
      key: `host-${hostItem.key}`,
      label: hostItem.label,
      onClick: () =>
        props.sendMessageToHost({
          type: "MENU_ITEM_CALLBACK",
          key: hostItem.key,
        }),
    })
  }

  return items
}

/**
 * Builds the About menu item as a separate section.
 * About appears at the bottom of the menu, separated by a divider.
 * Only shown if developer provides markdown content via st.set_page_config.
 */
function buildAboutItem(props: Props): MenuSection {
  if (props.menuItems?.aboutSectionMd) {
    return [
      {
        key: "about",
        label: "About",
        onClick: props.aboutCallback,
      },
    ]
  }
  return []
}

interface MenuItemRowProps {
  item: MenuItemConfig
  onItemClick: (item: MenuItemConfig) => void
}

/**
 * Renders a single menu item.
 * Memoized for performance - prevents unnecessary re-renders.
 */
const MenuItemRow = memo(function MenuItemRow({
  item,
  onItemClick,
}: MenuItemRowProps): ReactElement {
  const handleClick = (): void => {
    if (item.disabled) return
    onItemClick(item)
  }

  return (
    <StyledMenuItemRow
      type="button"
      role="menuitem"
      onClick={handleClick}
      disabled={item.disabled}
      isRecording={item.isRecording}
      data-testid={`stMainMenuItem-${item.label.replace(/\s+/g, "")}`}
    >
      <StyledMenuItemContent>
        <StyledMenuItemLabel data-testid="stMainMenuItemLabel">
          {item.label}
        </StyledMenuItemLabel>
        {item.shortcut && (
          <StyledMenuItemShortcut>{item.shortcut}</StyledMenuItemShortcut>
        )}
      </StyledMenuItemContent>
    </StyledMenuItemRow>
  )
})

interface MenuContentProps {
  sections: MenuSection[]
  closeMenu: () => void
  metricsMgr: MetricsManager
}

/**
 * Renders the menu content from section data.
 * This is the single place where MenuItemConfig[] -> ReactElement conversion happens.
 * Memoized to prevent unnecessary re-renders when parent MainMenu re-renders.
 */
const MenuContent = memo(function MenuContent({
  sections,
  closeMenu,
  metricsMgr,
}: MenuContentProps): ReactElement {
  // Single handler for all menu item clicks
  const handleItemClick = useCallback(
    (item: MenuItemConfig): void => {
      metricsMgr.enqueue("menuClick", { label: item.label })
      item.onClick()
      closeMenu()
    },
    [metricsMgr, closeMenu]
  )

  // Render sections with dividers between non-empty sections
  const elements: ReactElement[] = []
  let dividerCount = 0

  for (const section of sections) {
    if (section.length === 0) continue

    // Add divider before section (except first)
    if (elements.length > 0) {
      elements.push(
        <StyledMenuDivider
          key={`divider-${dividerCount}`}
          role="separator"
          aria-orientation="horizontal"
          data-testid="stMainMenuDivider"
        />
      )
      dividerCount += 1
    }

    // Add items
    for (const item of section) {
      elements.push(
        <MenuItemRow
          key={item.key}
          item={item}
          onItemClick={handleItemClick}
        />
      )
    }
  }

  return (
    <StyledMenuContainer
      role="menu"
      data-testid="stMainMenuList"
      aria-label="Main menu"
    >
      {elements}
    </StyledMenuContainer>
  )
})

function MainMenu(props: Readonly<Props>): ReactElement {
  const theme = useEmotionTheme()
  const isMinimalMode = props.toolbarMode === Config.ToolbarMode.MINIMAL

  // Build menu data once (memoized to avoid rebuilding on every render)
  const sections = useMemo(
    () => buildMenuData(props, isMinimalMode),
    [props, isMinimalMode]
  )

  // Check if menu has any content (for minimal mode visibility)
  const hasContent = sections.some(section => section.length > 0)

  // Hide menu entirely if minimal mode with no content
  if (isMinimalMode && !hasContent) {
    return <></>
  }

  return (
    <StatefulPopover
      focusLock
      placement={PLACEMENT.bottomRight}
      accessibilityType={ACCESSIBILITY_TYPE.menu}
      content={({ close }) => (
        <MenuContent
          sections={sections}
          closeMenu={close}
          metricsMgr={props.metricsMgr}
        />
      )}
      overrides={{
        Body: {
          props: {
            "data-testid": "stMainMenuPopover",
            className: "stMainMenuPopover",
          },
          style: {
            boxShadow: theme.shadows.popover,
          },
        },
      }}
    >
      <StyledMainMenuContainer
        id="MainMenu"
        className="stMainMenu"
        data-testid="stMainMenu"
      >
        <BaseButton
          kind={BaseButtonKind.HEADER_NO_PADDING}
          data-testid="stMainMenuButton"
          aria-label="Main menu"
        >
          <Icon content={MoreVert} size="lg" />
        </BaseButton>
        {props.screenCastState === "RECORDING" && (
          <StyledRecordingIndicator data-testid="stMainMenuRecordingIndicator" />
        )}
      </StyledMainMenuContainer>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

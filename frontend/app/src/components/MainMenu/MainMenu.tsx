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
  FocusEvent,
  KeyboardEvent,
  memo,
  ReactElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

import { MoreVert } from "@emotion-icons/material-rounded"
import { ACCESSIBILITY_TYPE, PLACEMENT, StatefulPopover } from "baseui/popover"
import { focusNextElement, focusPrevElement } from "focus-lock"
import { getLogger } from "loglevel"

import type { Steps } from "@streamlit/app/src/hocs/withScreencast/withScreencast"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import {
  BaseButton,
  BaseButtonKind,
  CopyButton,
  DynamicIcon,
  getPopoverContainerStyle,
  Icon,
  IGuestToHostMessage,
  IMenuItem,
  ThemeContext,
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
  StyledMenuPopoverContent,
  StyledMenuVersionFooter,
  StyledMenuVersionRow,
  StyledMenuVersionText,
  StyledRecordingIndicator,
  StyledThemeRadioGroup,
  StyledThemeRadioIcon,
  StyledThemeRadioItem,
} from "./styled-components"
import { buildThemeSection } from "./themeSection"
import ToggleItemRow from "./ToggleItemRow"

const LOG = getLogger("MainMenu")

const SCREENCAST_LABEL: { [s: string]: string } = {
  COUNTDOWN: "Cancel recording",
  RECORDING: "Stop recording",
}

/** Keys that open the menu when pressed on the menu button. */
const MENU_OPEN_KEYS = new Set(["Enter", " ", "Space", "Spacebar"])

/**
 * Strips the date digits from nightly `.devXXXXXXXX` version suffixes
 * so they fit in the narrow menu footer (e.g. "1.54.1.dev20260217" -> "1.54.1.dev").
 * Stable release versions pass through unchanged.
 */
export function formatDisplayVersion(version: string): string {
  return version.replace(/\.dev\d+/, ".dev")
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

  /** Whether auto-rerun on save is enabled. */
  runOnSave: boolean

  /** Callback to toggle auto-rerun on save. */
  onRunOnSaveChange: (runOnSave: boolean) => void

  /** Whether the auto-rerun toggle is allowed (dev mode + server config). */
  allowRunOnSave: boolean

  /** Streamlit version string from SessionInfo, shown in the menu footer. */
  streamlitVersion?: string
}

/** Configuration for an action menu item (pure data, no React elements) */
interface MenuActionItem {
  type: "action"
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
  isRecording?: boolean
  shortcut?: string
}

/** Configuration for a radio menu item (mutually exclusive choice) */
interface MenuRadioItem {
  type: "radio"
  key: string
  label: string
  /** Material icon identifier, e.g. ":material/contrast:" */
  icon: string
  /** Maps to aria-checked */
  checked: boolean
  /** Toggle handler — does NOT close the menu */
  onSelect: () => void
}

/** Configuration for a toggle (on/off) menu item */
export interface MenuToggleItem {
  type: "toggle"
  key: string
  label: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}

/** Discriminated union of all menu item types */
type MenuItem = MenuActionItem | MenuRadioItem | MenuToggleItem

/** A section is a group of items separated by dividers */
export type MenuSection = MenuItem[]

/** Type guard for radio items */
function isRadioItem(item: MenuItem): item is MenuRadioItem {
  return item.type === "radio"
}

/** Type guard for toggle items */
function isToggleItem(item: MenuItem): item is MenuToggleItem {
  return item.type === "toggle"
}

interface BuildMenuDataOptions {
  isServerConnected: boolean
  developmentMode: boolean
  screenCastState: Steps
  menuItems: PageConfig.IMenuItems | null | undefined
  hostMenuItems: IMenuItem[]
  quickRerunCallback: () => void
  clearCacheCallback: () => void
  printCallback: () => void
  screencastCallback: () => void
  aboutCallback: () => void
  sendMessageToHost: (message: IGuestToHostMessage) => void
  isMinimalMode: boolean
  themeSection: MenuSection
  runOnSave: boolean
  onRunOnSaveChange: (runOnSave: boolean) => void
  allowRunOnSave: boolean
  metricsMgr: MetricsManager
}

/**
 * Builds all menu sections as pure data.
 * Returns an array of sections, where each section is an array of item configs.
 * Empty sections are automatically filtered out during rendering.
 *
 * Menu structure (normal mode):
 *   Section 0: Theme radio group (System, Light, Dark)
 *   --- divider ---
 *   Section 1: Rerun, Auto-rerun toggle (dev mode only)
 *   --- divider ---
 *   Section 2: Clear cache (dev mode only)
 *   --- divider ---
 *   Section 3: Print, Record screen, About
 *   --- divider ---
 *   Section 4: Report a bug, Get help, Host items
 *
 * Menu structure (minimal mode):
 *   Section 0: Theme radio group (System, Light, Dark)
 *   --- divider ---
 *   Section 1: Report a bug, Get help, Host items, About
 *   (only shown if any items are configured)
 */
function buildMenuData({
  isServerConnected,
  developmentMode,
  screenCastState,
  menuItems,
  hostMenuItems,
  quickRerunCallback,
  clearCacheCallback,
  printCallback,
  screencastCallback,
  aboutCallback,
  sendMessageToHost,
  isMinimalMode,
  themeSection,
  runOnSave,
  onRunOnSaveChange,
  allowRunOnSave,
  metricsMgr,
}: BuildMenuDataOptions): MenuSection[] {
  const isServerDisconnected = !isServerConnected

  const commonItems = buildCommonItems(
    menuItems,
    hostMenuItems,
    sendMessageToHost
  )
  const aboutItem = buildAboutItem(menuItems, aboutCallback)

  if (isMinimalMode) {
    return [themeSection, [...commonItems, ...aboutItem]]
  }

  // Normal mode: all sections
  const standardItems = buildStandardItems(
    screenCastState,
    printCallback,
    screencastCallback
  )

  return [
    themeSection,
    buildDevItems(
      developmentMode,
      quickRerunCallback,
      isServerDisconnected,
      runOnSave,
      onRunOnSaveChange,
      allowRunOnSave,
      metricsMgr
    ),
    buildClearCacheItem(
      developmentMode,
      clearCacheCallback,
      isServerDisconnected
    ),
    [...standardItems, ...aboutItem],
    commonItems,
  ]
}

/**
 * Developer items: Rerun, and Auto-rerun toggle (dev mode only).
 *
 * Note: Keyboard shortcuts are displayed uppercase for design consistency.
 * The react-hot-keys library normalizes key presses to lowercase, so both
 * 'r' and 'R' trigger the Rerun action.
 */
function buildDevItems(
  developmentMode: boolean,
  quickRerunCallback: () => void,
  isServerDisconnected: boolean,
  runOnSave: boolean,
  onRunOnSaveChange: (runOnSave: boolean) => void,
  allowRunOnSave: boolean,
  metricsMgr: MetricsManager
): MenuSection {
  if (!developmentMode) {
    return []
  }

  const items: MenuSection = [
    {
      type: "action",
      key: "rerun",
      label: "Rerun",
      onClick: quickRerunCallback,
      disabled: isServerDisconnected,
      shortcut: "R",
    },
  ]

  if (allowRunOnSave) {
    items.push({
      type: "toggle",
      key: "autoRerun",
      label: "Auto rerun",
      checked: runOnSave,
      disabled: isServerDisconnected,
      onToggle: () => {
        metricsMgr.enqueue("menuClick", { label: "autoRerun" })
        onRunOnSaveChange(!runOnSave)
      },
    })
  }

  return items
}

/**
 * Clear cache item (dev mode only, in its own section).
 *
 * Note: Keyboard shortcut displayed uppercase for design consistency.
 * The react-hot-keys library normalizes key presses to lowercase, so both
 * 'c' and 'C' trigger the Clear cache action.
 */
function buildClearCacheItem(
  developmentMode: boolean,
  clearCacheCallback: () => void,
  isServerDisconnected: boolean
): MenuSection {
  if (!developmentMode) {
    return []
  }

  return [
    {
      type: "action",
      key: "clearCache",
      label: "Clear cache",
      onClick: clearCacheCallback,
      disabled: isServerDisconnected,
      shortcut: "C",
    },
  ]
}

/** Standard items: Print, Record screen */
function buildStandardItems(
  screenCastState: Steps,
  printCallback: () => void,
  screencastCallback: () => void
): MenuSection {
  const items: MenuSection = [
    {
      type: "action",
      key: "print",
      label: "Print",
      onClick: printCallback,
    },
  ]

  if (ScreenCastRecorder.isSupportedBrowser()) {
    const screencastLabel =
      SCREENCAST_LABEL[screenCastState] || "Record screen"
    items.push({
      type: "action",
      key: "recordScreencast",
      label: screencastLabel,
      onClick: screencastCallback,
      isRecording: Boolean(SCREENCAST_LABEL[screenCastState]),
      shortcut: SCREENCAST_LABEL[screenCastState] ? "ESC" : undefined,
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
function buildCommonItems(
  menuItems: PageConfig.IMenuItems | null | undefined,
  hostMenuItems: IMenuItem[],
  sendMessageToHost: (message: IGuestToHostMessage) => void
): MenuSection {
  const items: MenuSection = []

  // Report a bug - shown if URL provided and not hidden
  const reportABugUrl = menuItems?.reportABugUrl
  if (reportABugUrl && !menuItems?.hideReportABug) {
    items.push({
      type: "action",
      key: "report",
      label: "Report a bug",
      onClick: () => openInNewTab(reportABugUrl, "Report a bug"),
    })
  }

  // Get help - shown if URL provided and not hidden
  const getHelpUrl = menuItems?.getHelpUrl
  if (getHelpUrl && !menuItems?.hideGetHelp) {
    items.push({
      type: "action",
      key: "community",
      label: "Get help",
      onClick: () => openInNewTab(getHelpUrl, "Get help"),
    })
  }

  // Host menu items - injected by host (e.g., Streamlit Cloud)
  // Some host items are hidden if developer settings conflict
  for (const hostItem of hostMenuItems) {
    // We intentionally ignore host-provided separators to adhere to streamlit menu sectioning rules.
    // All host menu items are inserted in this common section, after “Report a bug” / “Get help”
    // (if present) and before “About” (if present).
    if (hostItem.type === "separator") continue
    // Hide host's reportBug if developer wants to hide help-related items
    if (hostItem.key === "reportBug" && menuItems?.hideGetHelp) continue
    // Hide host's about if developer provides custom About content
    if (hostItem.key === "about" && menuItems?.aboutSectionMd) continue

    items.push({
      type: "action",
      key: `host-${hostItem.key}`,
      label: hostItem.label,
      onClick: () =>
        sendMessageToHost({
          type: "MENU_ITEM_CALLBACK",
          key: hostItem.key,
        }),
    })
  }

  return items
}

/**
 * Builds the About menu item.
 * Only shown if developer provides markdown content via st.set_page_config.
 * Merged into the standard items section (normal mode) or common items (minimal mode).
 */
function buildAboutItem(
  menuItems: PageConfig.IMenuItems | null | undefined,
  aboutCallback: () => void
): MenuSection {
  if (menuItems?.aboutSectionMd) {
    return [
      {
        type: "action",
        key: "about",
        label: "About",
        onClick: aboutCallback,
      },
    ]
  }
  return []
}

interface MenuItemRowProps {
  item: MenuActionItem
  onItemClick: (item: MenuActionItem) => void
  tabIndex: number
  itemIndex: number
  setItemRef: (index: number, element: HTMLElement | null) => void
}

/**
 * Renders a single menu item.
 * Memoized for performance - prevents unnecessary re-renders.
 */
const MenuItemRow = memo(function MenuItemRow({
  item,
  onItemClick,
  tabIndex,
  itemIndex,
  setItemRef,
}: MenuItemRowProps): ReactElement {
  const handleClick = (): void => {
    if (item.disabled) return
    onItemClick(item)
  }

  const handleRef = useCallback(
    (element: HTMLButtonElement | null): void => {
      setItemRef(itemIndex, element)
    },
    [setItemRef, itemIndex]
  )

  return (
    <StyledMenuItemRow
      type="button"
      ref={handleRef}
      onClick={handleClick}
      role="menuitem"
      aria-disabled={item.disabled || undefined}
      tabIndex={tabIndex}
      isRecording={item.isRecording}
      data-testid={`stMainMenuItem-${item.key}`}
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

interface ThemeRadioItemRowProps {
  item: MenuRadioItem
  onRadioSelect: (item: MenuRadioItem) => void
  tabIndex: number
  itemIndex: number
  setItemRef: (index: number, element: HTMLElement | null) => void
}

/**
 * Renders a single theme radio item with icon + label.
 * Memoized for performance - prevents unnecessary re-renders.
 */
const ThemeRadioItemRow = memo(function ThemeRadioItemRow({
  item,
  onRadioSelect,
  tabIndex,
  itemIndex,
  setItemRef,
}: ThemeRadioItemRowProps): ReactElement {
  const handleClick = (): void => {
    onRadioSelect(item)
  }

  const handleRef = useCallback(
    (element: HTMLButtonElement | null): void => {
      setItemRef(itemIndex, element)
    },
    [setItemRef, itemIndex]
  )

  return (
    <StyledThemeRadioItem
      type="button"
      ref={handleRef}
      onClick={handleClick}
      role="menuitemradio"
      aria-checked={item.checked}
      tabIndex={tabIndex}
      isChecked={item.checked}
      data-testid={`stMainMenuItem-${item.key}`}
    >
      <StyledThemeRadioIcon>
        <DynamicIcon iconValue={item.icon} size="lg" />
      </StyledThemeRadioIcon>
      {item.label}
    </StyledThemeRadioItem>
  )
})

/** Why the menu was closed — drives focus-return behavior. */
type CloseReason = "escape" | "tab" | "shift-tab" | "other"

interface MenuContentProps {
  sections: MenuSection[]
  closeMenu: (reason?: CloseReason) => void
  metricsMgr: MetricsManager
  streamlitVersion?: string
}

/**
 * Renders the menu content from section data.
 * This is the single place where MenuItem[] -> ReactElement conversion happens.
 *
 * Note: This component is intentionally not memoized because `closeMenu` comes from
 * BaseWeb's StatefulPopover render prop and is a new function reference on each render,
 * which would invalidate any memoization. Since the popover content only renders when
 * open and menu items are lightweight, this has minimal performance impact.
 */
function MenuContent({
  sections,
  closeMenu,
  metricsMgr,
  streamlitVersion,
}: MenuContentProps): ReactElement {
  const theme = useEmotionTheme()
  // Store button refs so roving tabindex can move focus without DOM queries.
  const menuItemButtonsRef = useRef<Array<HTMLElement | null>>([])
  // Flatten sections to preserve visual grouping but allow linear navigation.
  // All items are focusable, including disabled ones (WAI-ARIA: every menuitem
  // in a menu is focusable, whether or not it is disabled).
  const flatItems = useMemo(() => sections.flat(), [sections])

  // Roving tabIndex: track which item index is currently focused.
  const [focusedIndex, setFocusedIndex] = useState(0)
  const lastIndex = Math.max(0, flatItems.length - 1)
  // Defensive clamp: if items shrink while the menu is open (e.g., a
  // conditional item is removed), keep focusedIndex within bounds.
  const clampedIndex =
    flatItems.length === 0 ? -1 : Math.min(focusedIndex, lastIndex)

  // Focus the item at a given index and update state for tabIndex tracking.
  // Called directly from keyboard handlers rather than going through a
  // state → render → effect cycle.
  const focusAndSetIndex = (index: number): void => {
    setFocusedIndex(index)
    menuItemButtonsRef.current[index]?.focus()
  }

  // Focus the first item when the menu list mounts.
  // Child callback refs (MenuItemRow) fire before this parent ref
  // during React's commit phase, so menuItemButtonsRef is populated.
  // The empty dependency array keeps this stable so it only fires on
  // mount — not on re-renders caused by theme changes or other state
  // updates that rebuild flatItems.
  const menuListRef = useCallback((node: HTMLDivElement | null): void => {
    if (node) {
      menuItemButtonsRef.current[0]?.focus()
    }
  }, [])

  // Stable ref setter so MenuItemRow's memo can bail out when item/tabIndex
  // haven't changed (avoids creating a new closure per item per render).
  const setItemRef = useCallback(
    (index: number, element: HTMLElement | null): void => {
      menuItemButtonsRef.current[index] = element
    },
    []
  )

  // Sync focusedIndex when any item receives focus via mouse click or other
  // non-keyboard means. Uses event delegation (focusin bubbles) so we don't
  // need per-item onFocus props, keeping MenuItemRow's memo untouched.
  const handleMenuFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    const index = menuItemButtonsRef.current.findIndex(el => el === target)
    if (index !== -1) {
      setFocusedIndex(index)
    }
  }

  const handleActionClick = (item: MenuActionItem): void => {
    metricsMgr.enqueue("menuClick", { label: item.label })
    item.onClick()
    closeMenu()
  }

  const handleRadioSelect = (item: MenuRadioItem): void => {
    item.onSelect()
    // Radio items do NOT close the menu — users may want to try different themes.
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (flatItems.length === 0) {
      return
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault()
        focusAndSetIndex(clampedIndex >= lastIndex ? 0 : clampedIndex + 1)
        break
      }
      case "ArrowUp": {
        event.preventDefault()
        focusAndSetIndex(clampedIndex <= 0 ? lastIndex : clampedIndex - 1)
        break
      }
      case "Home": {
        event.preventDefault()
        focusAndSetIndex(0)
        break
      }
      case "End": {
        event.preventDefault()
        focusAndSetIndex(lastIndex)
        break
      }
      case "Escape": {
        // Per WAI-ARIA, Escape closes the menu and returns focus to the
        // trigger button.
        event.preventDefault()
        closeMenu("escape")
        break
      }
      case "Tab": {
        if (streamlitVersion) {
          // A CopyButton exists in the version footer outside role="menu"
          // but inside the popover's focus-lock.  Let focus-lock move
          // focus there instead of closing the menu immediately.
          break
        }
        // No footer — close the menu and advance focus per WAI-ARIA.
        event.preventDefault()
        closeMenu(event.shiftKey ? "shift-tab" : "tab")
        break
      }
      default:
        break
    }
  }

  const handleFooterKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case "Tab": {
        if (!event.shiftKey) {
          // Forward Tab from the footer: close menu and advance focus
          // past the trigger, same as Tab from a bare menu.
          event.preventDefault()
          closeMenu("tab")
        }
        // Shift+Tab: focus-lock moves focus back into the menu.
        break
      }
      case "Escape": {
        event.preventDefault()
        closeMenu("escape")
        break
      }
      default:
        break
    }
  }

  // Render sections with dividers between non-empty sections.
  // Radio sections are wrapped in a role="group" container.
  const elements: ReactElement[] = []
  let dividerCount = 0
  let itemIndex = 0

  for (const section of sections) {
    if (section.length === 0) continue

    // Add divider before section (except first)
    if (elements.length > 0) {
      elements.push(
        <StyledMenuDivider
          key={`divider-${dividerCount}`}
          role="separator"
          aria-hidden="true"
          data-testid="stMainMenuDivider"
        />
      )
      dividerCount += 1
    }

    // Check if this section contains radio items
    const isRadioSection = isRadioItem(section[0])

    if (isRadioSection) {
      // Render radio items inside a role="group" container
      const startIndex = itemIndex
      elements.push(
        <StyledThemeRadioGroup
          key="theme-radio-group"
          role="group"
          aria-label="Theme"
          data-testid="stThemeSwitcher"
        >
          {(section as MenuRadioItem[]).map((item, i) => {
            const idx = startIndex + i
            return (
              <ThemeRadioItemRow
                key={item.key}
                item={item}
                onRadioSelect={handleRadioSelect}
                tabIndex={clampedIndex === idx ? 0 : -1}
                itemIndex={idx}
                setItemRef={setItemRef}
              />
            )
          })}
        </StyledThemeRadioGroup>
      )
      itemIndex += section.length
    } else {
      // Render action and toggle items
      for (const item of section) {
        if (isToggleItem(item)) {
          elements.push(
            <ToggleItemRow
              key={item.key}
              item={item}
              tabIndex={clampedIndex === itemIndex ? 0 : -1}
              itemIndex={itemIndex}
              setItemRef={setItemRef}
            />
          )
        } else {
          elements.push(
            <MenuItemRow
              key={item.key}
              item={item as MenuActionItem}
              onItemClick={handleActionClick}
              tabIndex={clampedIndex === itemIndex ? 0 : -1}
              itemIndex={itemIndex}
              setItemRef={setItemRef}
            />
          )
        }
        itemIndex += 1
      }
    }
  }

  return (
    <StyledMenuPopoverContent>
      <StyledMenuContainer
        ref={menuListRef}
        data-testid="stMainMenuList"
        aria-label="Main menu"
        role="menu"
        onFocus={handleMenuFocus}
        onKeyDown={handleKeyDown}
      >
        {elements}
      </StyledMenuContainer>
      {streamlitVersion && (
        <StyledMenuVersionFooter onKeyDown={handleFooterKeyDown}>
          <StyledMenuVersionRow>
            <StyledMenuVersionText>
              Made with Streamlit v{formatDisplayVersion(streamlitVersion)}
            </StyledMenuVersionText>
            <CopyButton
              text={streamlitVersion}
              buttonSize={theme.iconSizes.md}
              iconSize={theme.iconSizes.sm}
              className="stMenuVersionCopyButton"
              copyLabel="Copy version to clipboard"
              copiedLabel="Copied"
            />
          </StyledMenuVersionRow>
        </StyledMenuVersionFooter>
      )}
    </StyledMenuPopoverContent>
  )
}

function MainMenu(props: Readonly<Props>): ReactElement | null {
  const {
    isServerConnected,
    developmentMode,
    screenCastState,
    menuItems,
    hostMenuItems,
    toolbarMode,
    metricsMgr,
    quickRerunCallback,
    clearCacheCallback,
    printCallback,
    screencastCallback,
    aboutCallback,
    sendMessageToHost,
    runOnSave,
    onRunOnSaveChange,
    allowRunOnSave,
    streamlitVersion,
  } = props

  const theme = useEmotionTheme()
  const isMinimalMode = toolbarMode === Config.ToolbarMode.MINIMAL

  // Access ThemeContext for the theme switcher radio group
  const { activeTheme, availableThemes, setTheme } = useContext(ThemeContext)

  // Build the theme section separately so it can be included in both modes
  const themeSection = useMemo(
    () =>
      buildThemeSection(activeTheme, availableThemes, setTheme, metricsMgr),
    [activeTheme, availableThemes, setTheme, metricsMgr]
  )

  // Build menu data (memoized). Callbacks are included in deps but parent components
  // should provide stable refs via useCallback, so this typically only rebuilds
  // when data props (isServerConnected, developmentMode, etc.) change.
  const sections = useMemo(
    () =>
      buildMenuData({
        isServerConnected,
        developmentMode,
        screenCastState,
        menuItems,
        hostMenuItems,
        quickRerunCallback,
        clearCacheCallback,
        printCallback,
        screencastCallback,
        aboutCallback,
        sendMessageToHost,
        isMinimalMode,
        themeSection,
        runOnSave,
        onRunOnSaveChange,
        allowRunOnSave,
        metricsMgr,
      }),
    [
      isServerConnected,
      developmentMode,
      screenCastState,
      menuItems,
      hostMenuItems,
      quickRerunCallback,
      clearCacheCallback,
      printCallback,
      screencastCallback,
      aboutCallback,
      sendMessageToHost,
      isMinimalMode,
      themeSection,
      runOnSave,
      onRunOnSaveChange,
      allowRunOnSave,
      metricsMgr,
    ]
  )

  // Track popover open state for aria-expanded on the menu button.
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Ref to the menu trigger button for returning focus after close.
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // Tracks *why* the menu was closed so the returnFocus callback can
  // decide whether to restore focus to the trigger.  Set by MenuContent
  // just before calling BaseWeb's close(), read + reset in handleReturnFocus.
  const closeReasonRef = useRef<CloseReason>("other")

  const handlePopoverOpen = useCallback((): void => {
    setIsMenuOpen(true)
  }, [])

  const handlePopoverClose = useCallback((): void => {
    setIsMenuOpen(false)
  }, [])

  // Callback passed to BaseWeb's returnFocus prop, invoked by
  // react-focus-lock when the popover unmounts.  Returning false tells
  // focus-lock to skip its default restoration (which would land on the
  // wrong sibling due to DOM ordering).
  //
  // - Escape / click-away: focus returns to the menu trigger button.
  // - Tab: focus advances to the next tabbable element after the button.
  // - Shift+Tab: focus moves to the previous tabbable element.
  //
  // Note: On WebKit (Safari), these focus calls may be ignored because
  // react-focus-lock invokes the callback after BaseWeb's close animation
  // timer, which puts it outside the user-activation context.
  const handleReturnFocus = useCallback((_returnTo: Element): false => {
    const reason = closeReasonRef.current
    closeReasonRef.current = "other" // reset for next open/close cycle

    const button = menuButtonRef.current
    if (button) {
      if (reason === "tab") {
        focusNextElement(button)
      } else if (reason === "shift-tab") {
        focusPrevElement(button)
      } else {
        button.focus()
      }
    }
    // Always return false to prevent react-focus-lock's default
    // restoration, which targets the wrong element (Deploy button).
    return false
  }, [])

  const handleMenuButtonKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>): void => {
      if (MENU_OPEN_KEYS.has(event.key)) {
        event.preventDefault()
        event.currentTarget.click()
      }
    },
    []
  )

  // Check if menu has any content (for minimal mode visibility)
  const hasContent = sections.some(section => section.length > 0)

  // Hide menu entirely if minimal mode with no content
  if (isMinimalMode && !hasContent) {
    return null
  }

  return (
    <StatefulPopover
      focusLock
      returnFocus={handleReturnFocus}
      // We handle aria-haspopup and aria-expanded on the <button> directly,
      // so disable BaseWeb's ARIA on the wrapper div.
      accessibilityType={ACCESSIBILITY_TYPE.none}
      onOpen={handlePopoverOpen}
      onClose={handlePopoverClose}
      placement={PLACEMENT.bottomRight}
      content={({ close }) => (
        <MenuContent
          sections={sections}
          closeMenu={(reason?: CloseReason) => {
            closeReasonRef.current = reason ?? "other"
            close()
          }}
          metricsMgr={metricsMgr}
          streamlitVersion={streamlitVersion}
        />
      )}
      overrides={{
        Body: {
          props: {
            "data-testid": "stMainMenuPopover",
            className: "stMainMenuPopover",
          },
          style: {
            ...getPopoverContainerStyle(theme),
          },
        },
      }}
    >
      {/* onKeyDown is on the span (not the button) because BaseWeb injects
          its popover-opening click handler here via cloneElement. The handler
          calls currentTarget.click() to trigger that injected handler. */}
      <StyledMainMenuContainer
        id="MainMenu"
        className="stMainMenu"
        data-testid="stMainMenu"
        onKeyDown={handleMenuButtonKeyDown}
      >
        <BaseButton
          ref={menuButtonRef}
          kind={BaseButtonKind.HEADER_NO_PADDING}
          data-testid="stMainMenuButton"
          aria-label="Main menu"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <Icon content={MoreVert} size="lg" />
        </BaseButton>
        {screenCastState === "RECORDING" && (
          <StyledRecordingIndicator data-testid="stMainMenuRecordingIndicator" />
        )}
      </StyledMainMenuContainer>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

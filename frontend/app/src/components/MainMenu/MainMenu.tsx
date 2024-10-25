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

import React, { forwardRef, memo, MouseEvent, ReactElement } from "react"

import { StatefulMenu } from "baseui/menu"
import { PLACEMENT, StatefulPopover } from "baseui/popover"
import { MoreVert } from "@emotion-icons/material-rounded"
import { useTheme } from "@emotion/react"

import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"
import {
  BaseButton,
  BaseButtonKind,
  Config,
  EmotionTheme,
  Icon,
  IGuestToHostMessage,
  IMenuItem,
  PageConfig,
} from "@streamlit/lib"
import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"

import {
  StyledCoreItem,
  StyledDevItem,
  StyledMainMenuContainer,
  StyledMenuContainer,
  StyledMenuDivider,
  StyledMenuItem,
  StyledMenuItemLabel,
  StyledMenuItemShortcut,
  StyledRecordingIndicator,
} from "./styled-components"

const SCREENCAST_LABEL: { [s: string]: string } = {
  COUNTDOWN: "Cancel screencast",
  RECORDING: "Stop recording",
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

  screenCastState: string

  hostMenuItems: IMenuItem[]

  sendMessageToHost: (message: IGuestToHostMessage) => void

  menuItems?: PageConfig.IMenuItems | null

  developmentMode: boolean

  toolbarMode: Config.ToolbarMode

  metricsMgr: MetricsManager
}

const getOpenInWindowCallback = (url: string) => (): void => {
  window.open(url, "_blank")
}

export const isLocalhost = (): boolean => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
}

export interface MenuItemProps {
  item: any
  "aria-selected": boolean
  onClick: (e: MouseEvent<HTMLLIElement>) => void
  onMouseEnter: (e: MouseEvent<HTMLLIElement>) => void
  $disabled: boolean
  $isHighlighted: boolean
}

export interface SubMenuProps {
  menuItems: any[]
  closeMenu: () => void
  isDevMenu: boolean
  metricsMgr: MetricsManager
}

// BaseWeb provides a very basic list item (or option) for its dropdown
// menus. We want to customize it to our liking. We want to support:
//  * Shortcuts
//  * Red coloring for the stop recording
//  * Dividers (There's no special MenuListItem divider, so items have
//    a hasDividerAbove property to add the border properly.
// Unfortunately, because we are overriding the component, we need to
// implement some of the built in-features, namely:
//  * A11y for selected and disabled
//  * $disabled field (BaseWeb does not use CSS :disabled here)
//  * $isHighlighted field (BaseWeb does not use CSS :hover here)
//  * creating a forward ref to add properties to the DOM element.
function buildMenuItemComponent(
  StyledMenuItemType: typeof StyledCoreItem | typeof StyledDevItem,
  metricsMgr: MetricsManager
): any {
  const MenuItem = forwardRef<HTMLLIElement, MenuItemProps>(
    (
      {
        item,
        "aria-selected": ariaSelected,
        onClick,
        onMouseEnter,
        $disabled,
        $isHighlighted,
      },
      ref
    ) => {
      const {
        label,
        shortcut,
        hasDividerAbove,
        styleProps,
        noHighlight,
        interactions,
      } = item
      const itemProps = {
        isDisabled: $disabled,
        isRecording: Boolean(item.stopRecordingIndicator),
      }
      const itemStyleProps = {
        isHighlighted: !noHighlight && $isHighlighted,
        styleProps,
      }
      const interactiveProps =
        interactions ||
        ($disabled
          ? {}
          : {
              onClick: (e: MouseEvent<HTMLLIElement>) => {
                metricsMgr.enqueue("menuClick", {
                  label,
                })
                onClick(e)
              },
              onMouseEnter,
            })

      return (
        <>
          {hasDividerAbove && (
            <StyledMenuDivider data-testid="stMainMenuDivider" />
          )}
          <StyledMenuItem
            ref={ref}
            role="option"
            aria-selected={ariaSelected}
            aria-disabled={$disabled}
            {...itemProps}
            {...interactiveProps}
          >
            <StyledMenuItemType {...itemStyleProps}>
              <StyledMenuItemLabel {...itemProps}>{label}</StyledMenuItemLabel>
              {shortcut && (
                <StyledMenuItemShortcut {...itemProps}>
                  {shortcut}
                </StyledMenuItemShortcut>
              )}
            </StyledMenuItemType>
          </StyledMenuItem>
        </>
      )
    }
  )
  MenuItem.displayName = "MenuItem"
  return MenuItem
}

const SubMenu = (props: SubMenuProps): ReactElement => {
  const { colors, sizes }: EmotionTheme = useTheme()
  const StyledMenuItemType = props.isDevMenu ? StyledDevItem : StyledCoreItem
  return (
    <StatefulMenu
      items={props.menuItems}
      onItemSelect={({ item }) => {
        item.onClick()
        props.closeMenu()
      }}
      overrides={{
        Option: buildMenuItemComponent(StyledMenuItemType, props.metricsMgr),
        List: {
          props: {
            "data-testid": "stMainMenuList",
          },
          style: {
            backgroundColor: "inherit",

            borderBottomRadius: 0,
            borderTopRadius: 0,
            borderLeftRadius: 0,
            borderRightRadius: 0,

            ":focus": {
              outline: "none",
            },
            border: `${sizes.borderWidth} solid ${colors.borderColor}`,
          },
        },
      }}
    />
  )
}

function getDevMenuItems(
  theme: EmotionTheme,
  coreDevMenuItems: Record<string, any>
): any[] {
  const devMenuItems = []
  const preferredDevMenuOrder: any[] = [
    coreDevMenuItems.developerOptions,
    coreDevMenuItems.clearCache,
  ]

  let devLastMenuItem = null

  for (const devMenuItem of preferredDevMenuOrder) {
    if (devMenuItem) {
      if (devMenuItem !== coreDevMenuItems.DIVIDER) {
        if (devLastMenuItem === coreDevMenuItems.DIVIDER) {
          devMenuItems.push({ ...devMenuItem, hasDividerAbove: true })
        } else {
          devMenuItems.push(devMenuItem)
        }
      }

      devLastMenuItem = devMenuItem
    }
  }

  if (notNullOrUndefined(devLastMenuItem)) {
    devLastMenuItem.styleProps = {
      margin: `0 0 -${theme.spacing.sm} 0`,
      padding: `${theme.spacing.twoXS} ${theme.spacing.none} ${theme.spacing.twoXS} ${theme.spacing.twoXL}`,
    }
  }
  return devMenuItems
}

function getPreferredMenuOrder(
  props: Props,
  hostMenuItems: any[],
  coreMenuItems: Record<string, any>
): any[] {
  let preferredMenuOrder: any[]
  if (props.toolbarMode == Config.ToolbarMode.MINIMAL) {
    // If toolbar mode == minimal then show only host menu items if any.
    preferredMenuOrder = [
      coreMenuItems.report,
      coreMenuItems.community,
      coreMenuItems.DIVIDER,
      ...(hostMenuItems.length > 0 ? hostMenuItems : [coreMenuItems.DIVIDER]),
      coreMenuItems.about,
    ]

    preferredMenuOrder = preferredMenuOrder.filter(d => d)
    // If the first or last item is a divider, delete it, because
    // we don't want to start/end the menu with it.
    // TODO(sfc-gh-kbregula): We should use Array#at when supported by
    //  browsers or transpilers.
    //  See: https://github.com/tc39/proposal-relative-indexing-method
    while (
      preferredMenuOrder.length > 0 &&
      preferredMenuOrder[0] == coreMenuItems.DIVIDER
    ) {
      preferredMenuOrder.shift()
    }
    while (
      preferredMenuOrder.length > 0 &&
      preferredMenuOrder.at(preferredMenuOrder.length - 1) ==
        coreMenuItems.DIVIDER
    ) {
      preferredMenuOrder.pop()
    }
    return preferredMenuOrder
  }
  return [
    coreMenuItems.rerun,
    coreMenuItems.settings,
    coreMenuItems.DIVIDER,
    coreMenuItems.print,
    ...(ScreenCastRecorder.isSupportedBrowser()
      ? [coreMenuItems.recordScreencast]
      : []),
    coreMenuItems.DIVIDER,
    coreMenuItems.report,
    coreMenuItems.community,
    ...(hostMenuItems.length > 0 ? hostMenuItems : [coreMenuItems.DIVIDER]),
    coreMenuItems.about,
  ]
}

function MainMenu(props: Readonly<Props>): ReactElement {
  const theme: EmotionTheme = useTheme()

  const isServerDisconnected = !props.isServerConnected

  const showAboutMenu =
    props.toolbarMode != Config.ToolbarMode.MINIMAL ||
    (props.toolbarMode == Config.ToolbarMode.MINIMAL &&
      props.menuItems?.aboutSectionMd)

  const coreMenuItems = {
    DIVIDER: { isDivider: true },
    rerun: {
      disabled: isServerDisconnected,
      onClick: props.quickRerunCallback,
      label: "Rerun",
      shortcut: "r",
    },
    print: { onClick: props.printCallback, label: "Print" },
    recordScreencast: {
      onClick: props.screencastCallback,
      label: SCREENCAST_LABEL[props.screenCastState] || "Record a screencast",
      shortcut: SCREENCAST_LABEL[props.screenCastState] ? "esc" : "",
      stopRecordingIndicator: Boolean(SCREENCAST_LABEL[props.screenCastState]),
    },
    saveSnapshot: {
      disabled: isServerDisconnected,
      label: "Save a snapshot",
    },
    ...(!props.menuItems?.hideGetHelp &&
      props.menuItems?.getHelpUrl && {
        community: {
          onClick: getOpenInWindowCallback(props.menuItems?.getHelpUrl),
          label: "Get help",
        },
      }),
    ...(!props.menuItems?.hideReportABug &&
      props.menuItems?.reportABugUrl && {
        report: {
          onClick: getOpenInWindowCallback(props.menuItems?.reportABugUrl),
          label: "Report a bug",
        },
      }),
    settings: { onClick: props.settingsCallback, label: "Settings" },
    ...(showAboutMenu && {
      about: { onClick: props.aboutCallback, label: "About" },
    }),
  }

  const coreDevMenuItems = {
    DIVIDER: { isDivider: true },
    developerOptions: {
      label: "Developer options",
      noHighlight: true,
      interactions: {},
      styleProps: {
        fontSize: theme.fontSizes.twoSmPx,
        margin: `-${theme.spacing.sm} 0 0 0`,
        padding: `${theme.spacing.twoXS} ${theme.spacing.none} ${theme.spacing.twoXS} ${theme.spacing.twoXL}`,
        pointerEvents: "none",
      },
    },
    clearCache: {
      disabled: isServerDisconnected,
      onClick: props.clearCacheCallback,
      label: "Clear cache",
      shortcut: "c",
    },
  }

  const hostMenuItems = props.hostMenuItems.map(item => {
    if (item.type === "separator") {
      return coreMenuItems.DIVIDER
    }

    if (item.key === "reportBug" && props.menuItems?.hideGetHelp) {
      return null
    }

    if (item.key === "about" && props.menuItems?.aboutSectionMd !== "") {
      return null
    }

    return {
      onClick: () =>
        props.sendMessageToHost({
          type: "MENU_ITEM_CALLBACK",
          key: item.key,
        }),
      label: item.label,
    }
  }, [] as any[])

  const preferredMenuOrder = getPreferredMenuOrder(
    props,
    hostMenuItems,
    coreMenuItems
  )

  // Remove empty entries, and add dividers into menu options as needed.
  const menuItems: any[] = []
  let lastMenuItem = null
  for (const menuItem of preferredMenuOrder) {
    if (menuItem) {
      if (menuItem !== coreMenuItems.DIVIDER) {
        if (lastMenuItem === coreMenuItems.DIVIDER) {
          menuItems.push({ ...menuItem, hasDividerAbove: true })
        } else {
          menuItems.push(menuItem)
        }
      }

      lastMenuItem = menuItem
    }
  }

  const devMenuItems: any[] = props.developmentMode
    ? getDevMenuItems(theme, coreDevMenuItems)
    : []

  if (menuItems.length == 0 && devMenuItems.length == 0) {
    // Don't show an empty menu.
    return <></>
  }

  return (
    <StatefulPopover
      focusLock
      placement={PLACEMENT.bottomRight}
      content={({ close }) => (
        <StyledMenuContainer>
          {menuItems.length != 0 && (
            <SubMenu
              menuItems={menuItems}
              closeMenu={close}
              isDevMenu={false}
              metricsMgr={props.metricsMgr}
            />
          )}
          {devMenuItems.length != 0 && (
            <SubMenu
              menuItems={devMenuItems}
              closeMenu={close}
              isDevMenu={true}
              metricsMgr={props.metricsMgr}
            />
          )}
        </StyledMenuContainer>
      )}
      overrides={{
        Body: {
          props: {
            "data-testid": "stMainMenuPopover",
            className: "stMainMenuPopover",
          },
        },
      }}
    >
      <StyledMainMenuContainer
        id="MainMenu"
        className="stMainMenu"
        data-testid="stMainMenu"
      >
        <BaseButton kind={BaseButtonKind.HEADER_NO_PADDING}>
          <Icon content={MoreVert} size="lg" />
        </BaseButton>
        {props.screenCastState === "RECORDING" && <StyledRecordingIndicator />}
      </StyledMainMenuContainer>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

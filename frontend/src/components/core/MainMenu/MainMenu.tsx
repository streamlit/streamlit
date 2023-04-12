/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, {
  forwardRef,
  memo,
  MouseEvent,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
} from "react"
import { StatefulMenu } from "baseui/menu"
import { Menu } from "@emotion-icons/material-outlined"

import { useTheme } from "@emotion/react"
import { EmotionTheme } from "src/theme"
import Button, { Kind } from "src/components/shared/Button"
import { PLACEMENT, StatefulPopover } from "baseui/popover"
import {
  DetachedHead,
  ModuleIsNotAdded,
  NoRepositoryDetected,
} from "src/components/core/StreamlitDialog/DeployErrorDialogs"
import Icon from "src/components/shared/Icon"
import {
  IGuestToHostMessage,
  IMenuItem,
} from "src/hocs/withHostCommunication/types"
import { GitInfo, IGitInfo, PageConfig } from "src/autogen/proto"
import { MetricsManager } from "src/lib/MetricsManager"
import { DEPLOY_URL, STREAMLIT_CLOUD_URL } from "src/urls"
import {
  StyledMenuDivider,
  StyledMenuItem,
  StyledMenuItemLabel,
  StyledMenuItemShortcut,
  StyledRecordingIndicator,
  StyledCoreItem,
  StyledDevItem,
  StyledUl,
} from "./styled-components"

const { GitStates } = GitInfo

const SCREENCAST_LABEL: { [s: string]: string } = {
  COUNTDOWN: "Cancel screencast",
  RECORDING: "Stop recording",
}

export interface Props {
  /** True if we're connected to the Streamlit server. */
  isServerConnected: boolean

  /** Rerun the current script. */
  quickRerunCallback: () => void

  /** Reload git information message */
  loadGitInfo: () => void

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

  gitInfo: IGitInfo | null

  showDeployError: (
    title: string,
    errorNode: ReactNode,
    onContinue?: () => void
  ) => void

  closeDialog: () => void

  isDeployErrorModalOpen: boolean

  canDeploy: boolean

  menuItems?: PageConfig.IMenuItems | null

  hostIsOwner?: boolean

  metricsMgr: MetricsManager
}

const getOpenInWindowCallback = (url: string) => (): void => {
  window.open(url, "_blank")
}

export const getDeployAppUrl = (gitInfo: IGitInfo | null): (() => void) => {
  // If the app was run inside a GitHub repo, autofill for a one-click deploy.
  // E.g.: https://share.streamlit.io/deploy?repository=melon&branch=develop&mainModule=streamlit_app.py
  if (gitInfo) {
    const deployUrl = new URL(DEPLOY_URL)

    deployUrl.searchParams.set("repository", gitInfo.repository || "")
    deployUrl.searchParams.set("branch", gitInfo.branch || "")
    deployUrl.searchParams.set("mainModule", gitInfo.module || "")

    return getOpenInWindowCallback(deployUrl.toString())
  }

  // Otherwise, just direct them to the Streamlit Cloud page.
  return getOpenInWindowCallback(STREAMLIT_CLOUD_URL)
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
          {hasDividerAbove && <StyledMenuDivider />}
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
  const { colors }: EmotionTheme = useTheme()
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
            "data-testid": "main-menu-list",
          },
          style: {
            backgroundColor: "inherit",

            ":focus": {
              outline: "none",
            },
            border: `1px solid ${colors.fadedText10}`,
          },
        },
      }}
    />
  )
}

function MainMenu(props: Props): ReactElement {
  const isServerDisconnected = !props.isServerConnected

  const onClickDeployApp = useCallback((): void => {
    const { showDeployError, isDeployErrorModalOpen, gitInfo, closeDialog } =
      props

    if (!gitInfo) {
      const dialog = NoRepositoryDetected()

      showDeployError(dialog.title, dialog.body)

      return
    }

    const {
      repository,
      branch,
      module,
      untrackedFiles,
      state: gitState,
    } = gitInfo
    const hasMissingGitInfo = !repository || !branch || !module

    if (hasMissingGitInfo && gitState === GitStates.DEFAULT) {
      const dialog = NoRepositoryDetected()

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (gitState === GitStates.HEAD_DETACHED) {
      const dialog = DetachedHead()

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (module && untrackedFiles?.includes(module)) {
      const dialog = ModuleIsNotAdded(module)

      showDeployError(dialog.title, dialog.body)

      return
    }

    // We should close the modal when we try again and everything goes fine
    if (isDeployErrorModalOpen) {
      closeDialog()
    }

    getDeployAppUrl(gitInfo)()
  }, [props])

  useEffect(() => {
    if (!props.gitInfo || !props.isDeployErrorModalOpen) {
      return
    }

    onClickDeployApp()
  }, [props.gitInfo, props.isDeployErrorModalOpen, onClickDeployApp])
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
    about: { onClick: props.aboutCallback, label: "About" },
  }

  const coreDevMenuItems = {
    DIVIDER: { isDivider: true },
    deployApp: {
      onClick: onClickDeployApp,
      label: "Deploy this app",
    },
    developerOptions: {
      label: "Developer options",
      noHighlight: true,
      interactions: {},
      styleProps: {
        fontSize: "0.75rem",
        margin: "-.5rem 0 0 0",
        padding: ".25rem 0 .25rem 1.5rem",
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

  const lastDevMenuItemStyleProps = {
    margin: "0 0 -.5rem 0",
    padding: ".25rem 0 .25rem 1.5rem",
  }

  const hostMenuItems = props.hostMenuItems.map(item => {
    if (item.type === "separator") {
      return coreMenuItems.DIVIDER
    }

    if (item.key === "reportBug") {
      if (props.menuItems?.hideGetHelp) {
        return null
      }
    }

    if (item.key === "about") {
      if (props.menuItems?.aboutSectionMd !== "") {
        return null
      }
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

  const shouldShowHostMenu = !!hostMenuItems.length
  const showDeploy = isLocalhost() && !shouldShowHostMenu && props.canDeploy
  const preferredMenuOrder: any[] = [
    coreMenuItems.rerun,
    coreMenuItems.settings,
    coreMenuItems.DIVIDER,
    coreMenuItems.print,
    coreMenuItems.recordScreencast,
    coreMenuItems.DIVIDER,
    coreMenuItems.report,
    coreMenuItems.community,
    ...(shouldShowHostMenu ? hostMenuItems : [coreMenuItems.DIVIDER]),
    coreMenuItems.about,
  ]

  const preferredDevMenuOrder: any[] = [
    coreDevMenuItems.developerOptions,
    coreDevMenuItems.clearCache,
    showDeploy && coreDevMenuItems.deployApp,
  ]

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

  const devMenuItems: any[] = []
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

  if (devLastMenuItem != null) {
    devLastMenuItem.styleProps = lastDevMenuItemStyleProps
  }

  const { hostIsOwner } = props

  return (
    <StatefulPopover
      focusLock
      onOpen={() => {
        if (showDeploy) {
          props.loadGitInfo()
        }
      }}
      placement={PLACEMENT.bottomRight}
      content={({ close }) => (
        <>
          <SubMenu
            menuItems={menuItems}
            closeMenu={close}
            isDevMenu={false}
            metricsMgr={props.metricsMgr}
          />
          {(hostIsOwner || isLocalhost()) && (
            <StyledUl>
              <SubMenu
                menuItems={devMenuItems}
                closeMenu={close}
                isDevMenu={true}
                metricsMgr={props.metricsMgr}
              />
            </StyledUl>
          )}
        </>
      )}
      overrides={{
        Body: {
          props: {
            "data-testid": "main-menu-popover",
          },
        },
      }}
    >
      <span id="MainMenu">
        <Button kind={Kind.HEADER_BUTTON}>
          <Icon content={Menu} size="lg" />
        </Button>
        {props.screenCastState === "RECORDING" && <StyledRecordingIndicator />}
      </span>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

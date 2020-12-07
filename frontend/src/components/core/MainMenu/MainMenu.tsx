/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, {
  ReactElement,
  memo,
  forwardRef,
  MouseEvent,
  ReactNode,
  useEffect,
} from "react"
import { StatefulMenu } from "baseui/menu"
import { Menu } from "@emotion-icons/open-iconic"
import Button, { Kind } from "components/shared/Button"
import { StatefulPopover, PLACEMENT } from "baseui/popover"
import {
  NoRepositoryDetected,
  DetachedHead,
  RepoIsAhead,
  ModuleIsNotAdded,
  UncommittedChanges,
  UntrackedFiles,
} from "components/core/StreamlitDialog/DeployErrorDialogs"

import Icon from "components/shared/Icon"
import {
  IMenuItem,
  IGuestToHostMessage,
} from "hocs/withS4ACommunication/types"

import { IDeployParams } from "autogen/proto"
import {
  BUG_URL,
  COMMUNITY_URL,
  DEPLOY_URL,
  ONLINE_DOCS_URL,
  STREAMLIT_SHARE_URL,
  TEAMS_URL,
} from "urls"
import {
  StyledMenuItem,
  StyledMenuDivider,
  StyledMenuItemLabel,
  StyledMenuItemShortcut,
  StyledRecordingIndicator,
} from "./styled-components"

const SCREENCAST_LABEL: { [s: string]: string } = {
  COUNTDOWN: "Cancel screencast",
  RECORDING: "Stop recording",
}

export interface Props {
  /** True if report sharing is properly configured and enabled. */
  sharingEnabled: boolean

  /** True if we're connected to the Streamlit server. */
  isServerConnected: boolean

  /** Rerun the report. */
  quickRerunCallback: () => void

  /** Reload report message */
  reloadReportMessage: () => void

  /** Clear the cache. */
  clearCacheCallback: () => void

  /** Show the screen recording dialog. */
  screencastCallback: () => void

  /** Share the report to S3. */
  shareCallback: () => void

  /** Show the Settings dialog. */
  settingsCallback: () => void

  /** Show the About dialog. */
  aboutCallback: () => void

  screenCastState: string

  s4aMenuItems: IMenuItem[]

  sendS4AMessage: (message: IGuestToHostMessage) => void

  deployParams?: IDeployParams | null

  showDeployError: (
    title: string,
    errorNode: ReactNode,
    onContinue?: () => void
  ) => void

  closeDialog: () => void

  isDeployErrorModalOpen: boolean
}

const getOpenInWindowCallback = (url: string) => (): void => {
  window.open(url, "_blank")
}

const getDeployAppUrl = (
  deployParams: IDeployParams | null | undefined
): (() => void) => {
  // If the app was run inside a GitHub repo, autofill for a one-click deploy.
  // E.g.: https://share.streamlit.io/deploy?repository=melon&branch=develop&mainModule=streamlit_app.py
  if (deployParams) {
    const deployUrl = new URL(DEPLOY_URL)

    console.log("== getDeployAppUrl", deployUrl)

    deployUrl.searchParams.set("repository", deployParams.repository || "")
    deployUrl.searchParams.set("branch", deployParams.branch || "")
    deployUrl.searchParams.set("mainModule", deployParams.module || "")

    return getOpenInWindowCallback(deployUrl.toString())
  }

  console.log("== getDeployAppUrl share")

  // Otherwise, just direct them to the Streamlit Share page.
  return getOpenInWindowCallback(STREAMLIT_SHARE_URL)
}

const isLocalhost = (): boolean => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
}

export interface MenuListItemProps {
  item: any
  "aria-selected": boolean
  onClick: (e: MouseEvent<HTMLLIElement>) => void
  onMouseEnter: (e: MouseEvent<HTMLLIElement>) => void
  $disabled: boolean
  $isHighlighted: boolean
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
const MenuListItem = forwardRef<HTMLLIElement, MenuListItemProps>(
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
    const { label, shortcut, hasDividerAbove } = item
    const menuItemProps = {
      isDisabled: $disabled,
      isHighlighted: $isHighlighted,
      isRecording: Boolean(item.stopRecordingIndicator),
    }
    const interactiveProps = $disabled
      ? {}
      : {
          onClick,
          onMouseEnter,
        }

    return (
      <>
        {hasDividerAbove && <StyledMenuDivider />}
        <StyledMenuItem
          ref={ref}
          role="option"
          aria-selected={ariaSelected}
          aria-disabled={$disabled}
          {...menuItemProps}
          {...interactiveProps}
        >
          <StyledMenuItemLabel {...menuItemProps}>{label}</StyledMenuItemLabel>
          {shortcut && (
            <StyledMenuItemShortcut {...menuItemProps}>
              {shortcut}
            </StyledMenuItemShortcut>
          )}
        </StyledMenuItem>
      </>
    )
  }
)

function MainMenu(props: Props): ReactElement {
  const isServerDisconnected = !props.isServerConnected

  console.log("== deployParams", props.deployParams)

  const onClickDeployApp = (): void => {
    const {
      deployParams,
      showDeployError,
      closeDialog,
      isDeployErrorModalOpen,
    } = props

    console.log("== deployParams clicked", deployParams)

    if (
      !deployParams ||
      !deployParams.repository ||
      !deployParams.branch ||
      !deployParams.module
    ) {
      const dialog = NoRepositoryDetected()

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (deployParams.isHeadDetached) {
      const dialog = DetachedHead()

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (deployParams?.untrackedFiles?.includes(deployParams.module)) {
      const dialog = ModuleIsNotAdded(deployParams.module)

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (deployParams?.uncommittedFiles?.length) {
      const dialog = UncommittedChanges(deployParams.module)

      showDeployError(dialog.title, dialog.body)

      return
    }

    if (deployParams?.isAhead) {
      const dialog = RepoIsAhead()

      showDeployError(dialog.title, dialog.body, getDeployAppUrl(deployParams))

      return
    }

    if (deployParams?.untrackedFiles?.length) {
      const dialog = UntrackedFiles()

      showDeployError(dialog.title, dialog.body, getDeployAppUrl(deployParams))

      return
    }

    console.log("== acaa")

    if (isDeployErrorModalOpen) closeDialog()

    getDeployAppUrl(deployParams)
  }

  useEffect(() => {
    if (!props.deployParams || !props.isDeployErrorModalOpen) return

    onClickDeployApp()
  }, [props.deployParams, props.isDeployErrorModalOpen])

  const coreMenuOptions = {
    DIVIDER: { isDivider: true },
    rerun: {
      disabled: isServerDisconnected,
      onClick: props.quickRerunCallback,
      label: "Rerun",
      shortcut: "r",
    },
    clearCache: {
      disabled: isServerDisconnected,
      onClick: props.clearCacheCallback,
      label: "Clear cache",
      shortcut: "c",
    },
    recordScreencast: {
      onClick: props.screencastCallback,
      label: SCREENCAST_LABEL[props.screenCastState] || "Record a screencast",
      shortcut: SCREENCAST_LABEL[props.screenCastState] ? "esc" : "",
      stopRecordingIndicator: Boolean(SCREENCAST_LABEL[props.screenCastState]),
    },
    deployApp: {
      onClick: onClickDeployApp,
      label: "Deploy this app",
    },
    saveSnapshot: {
      disabled: isServerDisconnected,
      onClick: props.shareCallback,
      label: "Save a snapshot",
    },
    documentation: {
      onClick: getOpenInWindowCallback(ONLINE_DOCS_URL),
      label: "Documentation",
    },
    community: {
      onClick: getOpenInWindowCallback(COMMUNITY_URL),
      label: "Ask a question",
    },
    report: {
      onClick: getOpenInWindowCallback(BUG_URL),
      label: "Report a bug",
    },
    s4t: {
      onClick: getOpenInWindowCallback(TEAMS_URL),
      label: "Streamlit for Teams",
    },
    settings: { onClick: props.settingsCallback, label: "Settings" },
    about: { onClick: props.aboutCallback, label: "About" },
  }

  const S4AMenuOptions = props.s4aMenuItems.map(item => {
    if (item.type === "separator") {
      return coreMenuOptions.DIVIDER
    }

    return {
      onClick: () =>
        props.sendS4AMessage({
          type: "MENU_ITEM_CALLBACK",
          key: item.key,
        }),
      label: item.label,
    }
  }, [] as any[])

  const shouldShowS4AMenu = !!S4AMenuOptions.length

  const showDeploy = isLocalhost() && !shouldShowS4AMenu
  const showSnapshot = !shouldShowS4AMenu && props.sharingEnabled
  const showClearCache = !shouldShowS4AMenu
  const preferredMenuOrder: any[] = [
    coreMenuOptions.rerun,
    showClearCache && coreMenuOptions.clearCache,
    shouldShowS4AMenu && coreMenuOptions.settings,
    coreMenuOptions.DIVIDER,
    showDeploy && coreMenuOptions.deployApp,
    showSnapshot && coreMenuOptions.saveSnapshot,
    coreMenuOptions.recordScreencast,
    ...(shouldShowS4AMenu
      ? S4AMenuOptions
      : [
          coreMenuOptions.DIVIDER,
          coreMenuOptions.documentation,
          coreMenuOptions.community,
          coreMenuOptions.report,
          coreMenuOptions.DIVIDER,
          coreMenuOptions.s4t,
          coreMenuOptions.settings,
          coreMenuOptions.about,
        ]),
  ]

  // Remove empty entries, and add dividers into menu options as needed.
  const menuOptions: any[] = []
  let lastMenuItem = null
  for (const menuItem of preferredMenuOrder) {
    if (menuItem) {
      if (menuItem !== coreMenuOptions.DIVIDER) {
        if (lastMenuItem === coreMenuOptions.DIVIDER) {
          menuOptions.push({ ...menuItem, hasDividerAbove: true })
        } else {
          menuOptions.push(menuItem)
        }
      }

      lastMenuItem = menuItem
    }
  }

  return (
    <StatefulPopover
      focusLock
      placement={PLACEMENT.bottomRight}
      content={({ close }) => (
        <StatefulMenu
          items={menuOptions}
          onItemSelect={({ item }) => {
            item.onClick()
            close()
          }}
          overrides={{
            Option: MenuListItem,
            List: {
              props: {
                "data-testid": "main-menu-list",
              },
              style: {
                ":focus": {
                  outline: "none",
                },
              },
            },
          }}
        />
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
        <Button kind={Kind.ICON}>
          <Icon content={Menu} />
        </Button>
        {props.screenCastState === "RECORDING" && <StyledRecordingIndicator />}
      </span>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

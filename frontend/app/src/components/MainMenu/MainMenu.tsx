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

import { memo, ReactElement } from "react"

import { MoreVert } from "@emotion-icons/material-rounded"
import { Checkbox, STYLE_TYPE } from "baseui/checkbox"
import { PLACEMENT, StatefulPopover } from "baseui/popover"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import {
  BaseButton,
  BaseButtonKind,
  hasLightBackgroundColor,
  Icon,
  IGuestToHostMessage,
  IMenuItem,
  SessionInfo,
  useEmotionTheme,
} from "@streamlit/lib"
import { Config, PageConfig } from "@streamlit/protobuf"

import {
  StyledMainMenuContainer,
  StyledMenuContainer,
  StyledMenuDivider,
  StyledMenuItemRow,
  StyledRecordingIndicator,
  StyledToggleLabel,
  StyledToggleRow,
  StyledVersionFooter,
} from "./styled-components"
import ThemeSwitcher from "./ThemeSwitcher"

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

  /** Whether auto-rerun on save is enabled. */
  runOnSave: boolean

  /** Callback to toggle auto-rerun on save. */
  onRunOnSaveChange: (runOnSave: boolean) => void

  /** Whether auto-rerun toggle is allowed (developer mode). */
  allowRunOnSave: boolean

  /** Session info for version display. */
  sessionInfo: SessionInfo
}

const getOpenInWindowCallback = (url: string) => (): void => {
  window.open(url, "_blank")
}

interface MenuItemConfig {
  label: string
  onClick: () => void
  disabled?: boolean
  isRecording?: boolean
}

interface MenuItemRowProps {
  item: MenuItemConfig
  closeMenu: () => void
  metricsMgr: MetricsManager
}

const MenuItemRow = ({
  item,
  closeMenu,
  metricsMgr,
}: MenuItemRowProps): ReactElement => {
  const handleClick = (): void => {
    if (item.disabled) return
    metricsMgr.enqueue("menuClick", { label: item.label })
    item.onClick()
    closeMenu()
  }

  return (
    <StyledMenuItemRow
      onClick={handleClick}
      isDisabled={item.disabled}
      isRecording={item.isRecording}
      data-testid={`stMainMenuItem-${item.label.replace(/\s+/g, "")}`}
    >
      {item.label}
    </StyledMenuItemRow>
  )
}

function MainMenu(props: Readonly<Props>): ReactElement {
  const isServerDisconnected = !props.isServerConnected
  const theme = useEmotionTheme()
  const lightTheme = hasLightBackgroundColor(theme)

  // Build menu items based on mode
  const buildMenuItems = (closeMenu: () => void): ReactElement[] => {
    const items: ReactElement[] = []

    // For minimal mode, only show configured items
    if (props.toolbarMode === Config.ToolbarMode.MINIMAL) {
      if (props.menuItems?.reportABugUrl && !props.menuItems?.hideReportABug) {
        items.push(
          <MenuItemRow
            key="report"
            item={{
              label: "Report a bug",
              onClick: getOpenInWindowCallback(props.menuItems.reportABugUrl),
            }}
            closeMenu={closeMenu}
            metricsMgr={props.metricsMgr}
          />
        )
      }
      if (props.menuItems?.getHelpUrl && !props.menuItems?.hideGetHelp) {
        items.push(
          <MenuItemRow
            key="community"
            item={{
              label: "Get help",
              onClick: getOpenInWindowCallback(props.menuItems.getHelpUrl),
            }}
            closeMenu={closeMenu}
            metricsMgr={props.metricsMgr}
          />
        )
      }
      // Host menu items
      props.hostMenuItems.forEach(hostItem => {
        if (hostItem.type === "separator") return
        if (hostItem.key === "reportBug" && props.menuItems?.hideGetHelp)
          return
        if (hostItem.key === "about" && props.menuItems?.aboutSectionMd !== "")
          return

        items.push(
          <MenuItemRow
            key={`host-${hostItem.key}`}
            item={{
              label: hostItem.label,
              onClick: () =>
                props.sendMessageToHost({
                  type: "MENU_ITEM_CALLBACK",
                  key: hostItem.key,
                }),
            }}
            closeMenu={closeMenu}
            metricsMgr={props.metricsMgr}
          />
        )
      })
      if (props.menuItems?.aboutSectionMd) {
        items.push(
          <MenuItemRow
            key="about"
            item={{
              label: "About",
              onClick: props.aboutCallback,
            }}
            closeMenu={closeMenu}
            metricsMgr={props.metricsMgr}
          />
        )
      }
      return items
    }

    // Standard menu order: Rerun, Clear cache (dev), Print, Record screen
    // Rerun
    items.push(
      <MenuItemRow
        key="rerun"
        item={{
          label: "Rerun",
          onClick: props.quickRerunCallback,
          disabled: isServerDisconnected,
        }}
        closeMenu={closeMenu}
        metricsMgr={props.metricsMgr}
      />
    )

    // Clear cache (only in development mode)
    if (props.developmentMode) {
      items.push(
        <MenuItemRow
          key="clearCache"
          item={{
            label: "Clear cache",
            onClick: props.clearCacheCallback,
            disabled: isServerDisconnected,
          }}
          closeMenu={closeMenu}
          metricsMgr={props.metricsMgr}
        />
      )
    }

    // Print
    items.push(
      <MenuItemRow
        key="print"
        item={{
          label: "Print",
          onClick: props.printCallback,
        }}
        closeMenu={closeMenu}
        metricsMgr={props.metricsMgr}
      />
    )

    // Record screen (if supported)
    if (ScreenCastRecorder.isSupportedBrowser()) {
      items.push(
        <MenuItemRow
          key="recordScreencast"
          item={{
            label:
              SCREENCAST_LABEL[props.screenCastState] || "Record a screencast",
            onClick: props.screencastCallback,
            isRecording: Boolean(SCREENCAST_LABEL[props.screenCastState]),
          }}
          closeMenu={closeMenu}
          metricsMgr={props.metricsMgr}
        />
      )
    }

    // Optional configured items
    if (props.menuItems?.reportABugUrl && !props.menuItems?.hideReportABug) {
      items.push(
        <MenuItemRow
          key="report"
          item={{
            label: "Report a bug",
            onClick: getOpenInWindowCallback(props.menuItems.reportABugUrl),
          }}
          closeMenu={closeMenu}
          metricsMgr={props.metricsMgr}
        />
      )
    }
    if (props.menuItems?.getHelpUrl && !props.menuItems?.hideGetHelp) {
      items.push(
        <MenuItemRow
          key="community"
          item={{
            label: "Get help",
            onClick: getOpenInWindowCallback(props.menuItems.getHelpUrl),
          }}
          closeMenu={closeMenu}
          metricsMgr={props.metricsMgr}
        />
      )
    }

    // Host menu items
    props.hostMenuItems.forEach(hostItem => {
      if (hostItem.type === "separator") return
      if (hostItem.key === "reportBug" && props.menuItems?.hideGetHelp) return
      if (hostItem.key === "about" && props.menuItems?.aboutSectionMd !== "")
        return

      items.push(
        <MenuItemRow
          key={`host-${hostItem.key}`}
          item={{
            label: hostItem.label,
            onClick: () =>
              props.sendMessageToHost({
                type: "MENU_ITEM_CALLBACK",
                key: hostItem.key,
              }),
          }}
          closeMenu={closeMenu}
          metricsMgr={props.metricsMgr}
        />
      )
    })

    if (props.menuItems?.aboutSectionMd) {
      items.push(
        <MenuItemRow
          key="about"
          item={{
            label: "About",
            onClick: props.aboutCallback,
          }}
          closeMenu={closeMenu}
          metricsMgr={props.metricsMgr}
        />
      )
    }

    return items
  }

  // Check if menu should be shown at all in minimal mode
  if (props.toolbarMode === Config.ToolbarMode.MINIMAL) {
    const hasContent =
      props.hostMenuItems.length > 0 ||
      props.menuItems?.aboutSectionMd ||
      (props.menuItems?.getHelpUrl && !props.menuItems?.hideGetHelp) ||
      (props.menuItems?.reportABugUrl && !props.menuItems?.hideReportABug)
    if (!hasContent) {
      return <></>
    }
  }

  return (
    <StatefulPopover
      focusLock
      placement={PLACEMENT.bottomRight}
      content={({ close }) => {
        // For minimal mode, use the buildMenuItems approach
        if (props.toolbarMode === Config.ToolbarMode.MINIMAL) {
          const menuItems = buildMenuItems(close)
          return (
            <StyledMenuContainer>
              <ThemeSwitcher metricsMgr={props.metricsMgr} />
              {menuItems.length > 0 && <StyledMenuDivider />}
              {menuItems}
              <StyledMenuDivider />
              <StyledVersionFooter data-testid="stMainMenuVersion">
                Made with Streamlit v
                {props.sessionInfo.current.streamlitVersion}
              </StyledVersionFooter>
            </StyledMenuContainer>
          )
        }

        // Standard menu - render explicitly with dividers around Clear cache
        const afterClearCacheItems: ReactElement[] = []

        // Print
        afterClearCacheItems.push(
          <MenuItemRow
            key="print"
            item={{
              label: "Print",
              onClick: props.printCallback,
            }}
            closeMenu={close}
            metricsMgr={props.metricsMgr}
          />
        )

        // Record screen (if supported)
        if (ScreenCastRecorder.isSupportedBrowser()) {
          afterClearCacheItems.push(
            <MenuItemRow
              key="recordScreencast"
              item={{
                label:
                  SCREENCAST_LABEL[props.screenCastState] || "Record screen",
                onClick: props.screencastCallback,
                isRecording: Boolean(SCREENCAST_LABEL[props.screenCastState]),
              }}
              closeMenu={close}
              metricsMgr={props.metricsMgr}
            />
          )
        }

        // Optional configured items
        if (
          props.menuItems?.reportABugUrl &&
          !props.menuItems?.hideReportABug
        ) {
          afterClearCacheItems.push(
            <MenuItemRow
              key="report"
              item={{
                label: "Report a bug",
                onClick: getOpenInWindowCallback(
                  props.menuItems.reportABugUrl
                ),
              }}
              closeMenu={close}
              metricsMgr={props.metricsMgr}
            />
          )
        }
        if (props.menuItems?.getHelpUrl && !props.menuItems?.hideGetHelp) {
          afterClearCacheItems.push(
            <MenuItemRow
              key="community"
              item={{
                label: "Get help",
                onClick: getOpenInWindowCallback(props.menuItems.getHelpUrl),
              }}
              closeMenu={close}
              metricsMgr={props.metricsMgr}
            />
          )
        }

        // Host menu items
        props.hostMenuItems.forEach(hostItem => {
          if (hostItem.type === "separator") return
          if (hostItem.key === "reportBug" && props.menuItems?.hideGetHelp)
            return
          if (
            hostItem.key === "about" &&
            props.menuItems?.aboutSectionMd !== ""
          )
            return

          afterClearCacheItems.push(
            <MenuItemRow
              key={`host-${hostItem.key}`}
              item={{
                label: hostItem.label,
                onClick: () =>
                  props.sendMessageToHost({
                    type: "MENU_ITEM_CALLBACK",
                    key: hostItem.key,
                  }),
              }}
              closeMenu={close}
              metricsMgr={props.metricsMgr}
            />
          )
        })

        if (props.menuItems?.aboutSectionMd) {
          afterClearCacheItems.push(
            <MenuItemRow
              key="about"
              item={{
                label: "About",
                onClick: props.aboutCallback,
              }}
              closeMenu={close}
              metricsMgr={props.metricsMgr}
            />
          )
        }

        return (
          <StyledMenuContainer>
            <ThemeSwitcher metricsMgr={props.metricsMgr} />
            <StyledMenuDivider />
            <MenuItemRow
              key="rerun"
              item={{
                label: "Rerun",
                onClick: props.quickRerunCallback,
                disabled: isServerDisconnected,
              }}
              closeMenu={close}
              metricsMgr={props.metricsMgr}
            />
            <StyledToggleRow
              onClick={() => {
                props.metricsMgr.enqueue("menuClick", {
                  label: "autoRerun",
                })
                props.onRunOnSaveChange(!props.runOnSave)
              }}
              data-testid="stMainMenuAutoRerun"
            >
              <StyledToggleLabel>Auto rerun</StyledToggleLabel>
              <Checkbox
                checked={props.runOnSave}
                checkmarkType={STYLE_TYPE.toggle}
                onChange={() => {}}
                overrides={{
                  Root: {
                    style: {
                      marginTop: 0,
                      marginBottom: 0,
                    },
                  },
                  Toggle: {
                    style: ({ $checked }: { $checked: boolean }) => {
                      const backgroundColor = lightTheme
                        ? theme.colors.bgColor
                        : theme.colors.bodyText
                      return {
                        width: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
                        height: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
                        transform: $checked
                          ? `translateX(${theme.sizes.checkbox})`
                          : "",
                        backgroundColor,
                        boxShadow: "",
                      }
                    },
                  },
                  ToggleTrack: {
                    style: ({
                      $checked,
                      $isHovered,
                    }: {
                      $checked: boolean
                      $isHovered: boolean
                    }) => {
                      let backgroundColor = theme.colors.borderColor
                      if ($isHovered) {
                        backgroundColor = theme.colors.darkenedBgMix15
                      }
                      if ($checked) {
                        backgroundColor = theme.colors.primary
                      }
                      return {
                        marginRight: 0,
                        marginLeft: 0,
                        marginBottom: 0,
                        marginTop: 0,
                        paddingLeft: theme.spacing.threeXS,
                        paddingRight: theme.spacing.threeXS,
                        width: `calc(2 * ${theme.sizes.checkbox})`,
                        minWidth: `calc(2 * ${theme.sizes.checkbox})`,
                        height: theme.sizes.checkbox,
                        minHeight: theme.sizes.checkbox,
                        borderBottomLeftRadius: theme.radii.full,
                        borderTopLeftRadius: theme.radii.full,
                        borderBottomRightRadius: theme.radii.full,
                        borderTopRightRadius: theme.radii.full,
                        backgroundColor,
                      }
                    },
                  },
                }}
              />
            </StyledToggleRow>
            {props.developmentMode && (
              <>
                <StyledMenuDivider />
                <MenuItemRow
                  key="clearCache"
                  item={{
                    label: "Clear cache",
                    onClick: props.clearCacheCallback,
                    disabled: isServerDisconnected,
                  }}
                  closeMenu={close}
                  metricsMgr={props.metricsMgr}
                />
                <StyledMenuDivider />
              </>
            )}
            {afterClearCacheItems}
            <StyledMenuDivider />
            <StyledVersionFooter data-testid="stMainMenuVersion">
              Made with Streamlit v{props.sessionInfo.current.streamlitVersion}
            </StyledVersionFooter>
          </StyledMenuContainer>
        )
      }}
      overrides={{
        Body: {
          props: {
            "data-testid": "stMainMenuPopover",
            className: "stMainMenuPopover",
          },
          style: {
            // Testing a dark theme box shadow
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
        <BaseButton kind={BaseButtonKind.HEADER_NO_PADDING}>
          <Icon content={MoreVert} size="lg" />
        </BaseButton>
        {props.screenCastState === "RECORDING" && <StyledRecordingIndicator />}
      </StyledMainMenuContainer>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

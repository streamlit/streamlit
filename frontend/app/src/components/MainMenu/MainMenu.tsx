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
import { Checkbox, LABEL_PLACEMENT, STYLE_TYPE } from "baseui/checkbox"
import { CheckboxOverrides } from "baseui/checkbox/types"
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

const getMenuItemTestId = (label: string): string =>
  `stMainMenuItem-${label.replace(/\s+/g, "")}`

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
      type="button"
      onClick={handleClick}
      disabled={item.disabled}
      isRecording={item.isRecording}
      role="menuitem"
      data-testid={getMenuItemTestId(item.label)}
    >
      {item.label}
    </StyledMenuItemRow>
  )
}

interface CommonMenuItemsProps {
  menuItems: PageConfig.IMenuItems | null | undefined
  hostMenuItems: IMenuItem[]
  sendMessageToHost: (message: IGuestToHostMessage) => void
  aboutCallback: () => void
  closeMenu: () => void
  metricsMgr: MetricsManager
}

const buildCommonMenuItems = ({
  menuItems,
  hostMenuItems,
  sendMessageToHost,
  aboutCallback,
  closeMenu,
  metricsMgr,
}: CommonMenuItemsProps): ReactElement[] => {
  const items: ReactElement[] = []

  if (menuItems?.reportABugUrl && !menuItems?.hideReportABug) {
    items.push(
      <MenuItemRow
        key="report"
        item={{
          label: "Report a bug",
          onClick: getOpenInWindowCallback(menuItems.reportABugUrl),
        }}
        closeMenu={closeMenu}
        metricsMgr={metricsMgr}
      />
    )
  }

  if (menuItems?.getHelpUrl && !menuItems?.hideGetHelp) {
    items.push(
      <MenuItemRow
        key="community"
        item={{
          label: "Get help",
          onClick: getOpenInWindowCallback(menuItems.getHelpUrl),
        }}
        closeMenu={closeMenu}
        metricsMgr={metricsMgr}
      />
    )
  }

  hostMenuItems.forEach(hostItem => {
    if (hostItem.type === "separator") return
    if (hostItem.key === "reportBug" && menuItems?.hideGetHelp) return
    if (hostItem.key === "about" && menuItems?.aboutSectionMd !== "") return

    items.push(
      <MenuItemRow
        key={`host-${hostItem.key}`}
        item={{
          label: hostItem.label,
          onClick: () =>
            sendMessageToHost({
              type: "MENU_ITEM_CALLBACK",
              key: hostItem.key,
            }),
        }}
        closeMenu={closeMenu}
        metricsMgr={metricsMgr}
      />
    )
  })

  if (menuItems?.aboutSectionMd) {
    items.push(
      <MenuItemRow
        key="about"
        item={{
          label: "About",
          onClick: aboutCallback,
        }}
        closeMenu={closeMenu}
        metricsMgr={metricsMgr}
      />
    )
  }

  return items
}

const getToggleOverrides = (
  theme: ReturnType<typeof useEmotionTheme>,
  lightTheme: boolean,
  isDisabled: boolean
): CheckboxOverrides => ({
  Root: {
    style: ({ $isHovered }: { $isHovered: boolean }) => ({
      width: "100%",
      margin: 0,
      padding: `${theme.spacing.threeXS} ${theme.spacing.lg}`,
      display: "flex",
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: isDisabled ? "not-allowed" : "pointer",
      backgroundColor:
        $isHovered && !isDisabled
          ? theme.colors.darkenedBgMix15
          : theme.colors.transparent,
    }),
  },
  Label: {
    style: {
      paddingLeft: theme.spacing.none,
      marginLeft: theme.spacing.none,
      marginRight: theme.spacing.none,
      fontSize: theme.fontSizes.sm,
      lineHeight: theme.lineHeights.menuRow,
      color: isDisabled ? theme.colors.fadedText60 : theme.colors.bodyText,
    },
  },
  Toggle: {
    style: ({ $checked }: { $checked: boolean }) => {
      let backgroundColor = lightTheme
        ? theme.colors.bgColor
        : theme.colors.bodyText

      if (isDisabled) {
        backgroundColor = lightTheme
          ? theme.colors.gray70
          : theme.colors.gray90
      }

      return {
        width: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
        height: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
        transform: $checked ? `translateX(${theme.sizes.checkbox})` : "",
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

      if ($isHovered && !isDisabled) {
        backgroundColor = theme.colors.darkenedBgMix15
      }

      if ($checked && !isDisabled) {
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
})

function MainMenu(props: Readonly<Props>): ReactElement {
  const isServerDisconnected = !props.isServerConnected
  const theme = useEmotionTheme()
  const lightTheme = hasLightBackgroundColor(theme)

  return (
    <StatefulPopover
      focusLock
      placement={PLACEMENT.bottomRight}
      content={({ close }) => {
        const commonMenuItems = buildCommonMenuItems({
          menuItems: props.menuItems,
          hostMenuItems: props.hostMenuItems,
          sendMessageToHost: props.sendMessageToHost,
          aboutCallback: props.aboutCallback,
          closeMenu: close,
          metricsMgr: props.metricsMgr,
        })

        const renderDivider = (key: string): ReactElement => (
          <StyledMenuDivider key={key} data-testid="stMainMenuDivider" />
        )

        if (props.toolbarMode === Config.ToolbarMode.MINIMAL) {
          return (
            <StyledMenuContainer role="menu" data-testid="stMainMenuContent">
              <ThemeSwitcher
                key="theme-switcher"
                metricsMgr={props.metricsMgr}
              />
              {commonMenuItems.length > 0 && renderDivider("divider-minimal")}
              {commonMenuItems}
              {props.sessionInfo.isSet && (
                <>
                  {renderDivider("divider-minimal-footer")}
                  <StyledVersionFooter
                    key="version-footer-minimal"
                    data-testid="stMainMenuVersion"
                  >
                    Made with Streamlit v
                    {props.sessionInfo.current.streamlitVersion}
                  </StyledVersionFooter>
                </>
              )}
            </StyledMenuContainer>
          )
        }

        const contentSections: ReactElement[] = []
        let dividerCount = 0
        const addSection = (section: ReactElement | ReactElement[]): void => {
          if (Array.isArray(section) ? section.length === 0 : !section) {
            return
          }
          if (contentSections.length > 0) {
            contentSections.push(renderDivider(`divider-${dividerCount}`))
            dividerCount += 1
          }
          if (Array.isArray(section)) {
            contentSections.push(...section)
          } else {
            contentSections.push(section)
          }
        }

        addSection(
          <ThemeSwitcher key="theme-switcher" metricsMgr={props.metricsMgr} />
        )

        const rerunItems: ReactElement[] = [
          <MenuItemRow
            key="rerun"
            item={{
              label: "Rerun",
              onClick: props.quickRerunCallback,
              disabled: isServerDisconnected,
            }}
            closeMenu={close}
            metricsMgr={props.metricsMgr}
          />,
        ]

        if (props.allowRunOnSave) {
          const isToggleDisabled = isServerDisconnected
          rerunItems.push(
            <StyledToggleRow
              key="auto-rerun"
              isDisabled={isToggleDisabled}
              data-testid="stMainMenuAutoRerun"
            >
              <Checkbox
                checked={props.runOnSave}
                checkmarkType={STYLE_TYPE.toggle}
                disabled={isToggleDisabled}
                onChange={() => {
                  props.metricsMgr.enqueue("menuClick", {
                    label: "autoRerun",
                  })
                  props.onRunOnSaveChange(!props.runOnSave)
                }}
                overrides={getToggleOverrides(
                  theme,
                  lightTheme,
                  isToggleDisabled
                )}
                labelPlacement={LABEL_PLACEMENT.right}
                aria-label="Auto rerun"
              >
                Auto rerun
              </Checkbox>
            </StyledToggleRow>
          )
        }

        addSection(rerunItems)

        if (props.developmentMode) {
          addSection(
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
          )
        }

        const standardOnlyItems: ReactElement[] = [
          <MenuItemRow
            key="print"
            item={{ label: "Print", onClick: props.printCallback }}
            closeMenu={close}
            metricsMgr={props.metricsMgr}
          />,
        ]

        if (ScreenCastRecorder.isSupportedBrowser()) {
          standardOnlyItems.push(
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

        addSection(standardOnlyItems)
        addSection(commonMenuItems)

        if (props.sessionInfo.isSet) {
          addSection(
            <StyledVersionFooter
              key="version-footer"
              data-testid="stMainMenuVersion"
            >
              Made with Streamlit v{props.sessionInfo.current.streamlitVersion}
            </StyledVersionFooter>
          )
        }

        return (
          <StyledMenuContainer role="menu" data-testid="stMainMenuContent">
            {contentSections}
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
        {props.screenCastState === "RECORDING" && <StyledRecordingIndicator />}
      </StyledMainMenuContainer>
    </StatefulPopover>
  )
}

export default memo(MainMenu)

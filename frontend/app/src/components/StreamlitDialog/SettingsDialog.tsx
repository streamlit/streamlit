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

import React, {
  ChangeEvent,
  FC,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react"

import {
  BaseButton,
  BaseButtonKind,
  LibContext,
  Modal,
  ModalBody,
  ModalHeader,
  ThemeConfig,
  UISelectbox,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"

import {
  StyledButtonContainer,
  StyledCheckbox,
  StyledDialogBody,
  StyledFullRow,
  StyledHeader,
  StyledLabel,
  StyledSmall,
} from "./styled-components"
import { UserSettings } from "./UserSettings"

export interface Props {
  isServerConnected: boolean
  onClose: () => void
  onSave: (settings: UserSettings) => void
  settings: UserSettings
  allowRunOnSave: boolean
  developerMode: boolean
  openThemeCreator: () => void
  animateModal: boolean
  metricsMgr: SegmentMetricsManager
}

const ThemeCreatorButton: FC<Pick<Props, "openThemeCreator">> = ({
  openThemeCreator,
}) => {
  return (
    <StyledButtonContainer data-testid="edit-theme">
      <BaseButton onClick={openThemeCreator} kind={BaseButtonKind.SECONDARY}>
        Edit active theme
      </BaseButton>
    </StyledButtonContainer>
  )
}

/**
 * Implements a dialog that is used to configure user settings.
 */
export const SettingsDialog: FC<Props> = memo(function SettingsDialog({
  isServerConnected,
  onClose,
  onSave,
  settings,
  allowRunOnSave,
  developerMode,
  openThemeCreator,
  animateModal,
  metricsMgr,
}) {
  const libContext = useContext(LibContext)
  const activeSettings = useRef(settings)
  const isFirstRun = useRef(true)
  const [state, setState] = React.useState<UserSettings>({ ...settings })

  const changeSingleSetting = useCallback(
    (name: string, value: boolean): void => {
      setState(state => ({ ...state, [name]: value }))
    },
    []
  )

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    activeSettings.current = state
    onSave(activeSettings.current)
  }, [onSave, state])

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      changeSingleSetting(e.target.name, e.target.checked)
    },
    [changeSingleSetting]
  )

  const handleThemeChange = useCallback(
    (index: number | null): void => {
      const newTheme = libContext.availableThemes[index ?? 0]

      metricsMgr.enqueue("menuClick", {
        label: "changeTheme",
      })

      libContext.setTheme(newTheme)
    },
    [libContext, metricsMgr]
  )

  const themeIndex = libContext.availableThemes.findIndex(
    (theme: ThemeConfig) => theme.name === libContext.activeTheme.name
  )

  return (
    <Modal animate={animateModal} isOpen onClose={onClose}>
      <ModalHeader>Settings</ModalHeader>
      <ModalBody>
        <StyledDialogBody>
          {allowRunOnSave && (
            <React.Fragment>
              <StyledFullRow>
                <StyledHeader>Development</StyledHeader>
                <label>
                  <StyledCheckbox
                    disabled={!isServerConnected}
                    type="checkbox"
                    name="runOnSave"
                    checked={state.runOnSave && isServerConnected}
                    onChange={handleCheckboxChange}
                  />{" "}
                  Run on save
                </label>
                <StyledSmall>
                  Automatically updates the app when the underlying code is
                  updated.
                </StyledSmall>
              </StyledFullRow>
            </React.Fragment>
          )}

          <StyledFullRow>
            <StyledHeader>Appearance</StyledHeader>
            <label>
              <StyledCheckbox
                type="checkbox"
                name="wideMode"
                checked={state.wideMode}
                onChange={handleCheckboxChange}
              />{" "}
              Wide mode
            </label>
            <StyledSmall>
              Turn on to make this app occupy the entire width of the screen
            </StyledSmall>
          </StyledFullRow>

          {!!libContext.availableThemes.length && (
            <StyledFullRow>
              <StyledLabel>Choose app theme, colors and fonts</StyledLabel>
              <UISelectbox
                options={libContext.availableThemes.map(
                  (theme: ThemeConfig) => theme.name
                )}
                disabled={false}
                onChange={handleThemeChange}
                value={themeIndex}
              />
              {developerMode && (
                <ThemeCreatorButton openThemeCreator={openThemeCreator} />
              )}
            </StyledFullRow>
          )}
        </StyledDialogBody>
      </ModalBody>
    </Modal>
  )
})

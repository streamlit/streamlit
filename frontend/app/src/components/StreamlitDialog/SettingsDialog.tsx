/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  useState,
} from "react"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  BaseButton,
  BaseButtonKind,
  LibContext,
  Modal,
  ModalBody,
  ModalHeader,
  SessionInfo,
  StreamlitMarkdown,
  ThemeConfig,
  UISelectbox,
} from "@streamlit/lib"

import {
  StyledButtonContainer,
  StyledCheckbox,
  StyledDialogBody,
  StyledFullRow,
  StyledHeader,
  StyledLabel,
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
  metricsMgr: MetricsManager
  sessionInfo: SessionInfo
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
  sessionInfo,
}) {
  const libContext = useContext(LibContext)
  const activeSettings = useRef(settings)
  const isFirstRun = useRef(true)
  const [state, setState] = useState<UserSettings>({ ...settings })

  const changeSingleSetting = useCallback(
    (name: string, value: boolean): void => {
      setState(prevState => ({ ...prevState, [name]: value }))
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
    (themeName: string | null): void => {
      let newTheme = undefined
      if (themeName) {
        newTheme = libContext.availableThemes.find(
          (theme: ThemeConfig) => theme.name === themeName
        )
      }
      if (newTheme === undefined) {
        newTheme = libContext.availableThemes[0]
      }

      metricsMgr.enqueue("menuClick", {
        label: "changeTheme",
      })

      libContext.setTheme(newTheme)
    },
    [libContext, metricsMgr]
  )

  return (
    <Modal animate={animateModal} isOpen onClose={onClose}>
      <ModalHeader>Settings</ModalHeader>
      <ModalBody>
        <StyledDialogBody>
          {allowRunOnSave && (
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
              <StreamlitMarkdown
                source="Automatically updates the app when the underlying code is updated."
                allowHTML={false}
                isCaption
              />
            </StyledFullRow>
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
            <StreamlitMarkdown
              source=" Turn on to make this app occupy the entire width of the screen."
              allowHTML={false}
              isCaption
            />
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
                value={libContext.activeTheme.name}
                placeholder=""
                acceptNewOptions={false}
              />
              {developerMode && (
                <ThemeCreatorButton openThemeCreator={openThemeCreator} />
              )}
            </StyledFullRow>
          )}

          {/* Show our version string only if SessionInfo has been created. If Streamlit
          hasn't yet connected to the server, the SessionInfo singleton will be null. */}
          {sessionInfo.isSet && (
            <div data-testid="stVersionInfo">
              <StreamlitMarkdown
                source={`Made with Streamlit ${sessionInfo.current.streamlitVersion}`}
                allowHTML={false}
                isCaption
              />
            </div>
          )}
        </StyledDialogBody>
      </ModalBody>
    </Modal>
  )
})

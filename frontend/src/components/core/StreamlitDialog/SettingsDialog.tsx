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
  ChangeEvent,
  PureComponent,
  ReactElement,
  ReactNode,
} from "react"
import { ThemeConfig } from "src/theme"
import Button, { Kind } from "src/components/shared/Button"
import Modal, { ModalHeader, ModalBody } from "src/components/shared/Modal"
import AppContext, {
  Props as AppContextProps,
} from "src/components/core/AppContext"
import UISelectbox from "src/components/shared/Dropdown"
import { MetricsManager } from "src/lib/MetricsManager"

import {
  StyledCheckbox,
  StyledDialogBody,
  StyledFullRow,
  StyledHeader,
  StyledHr,
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
}

/**
 * Implements a dialog that is used to configure user settings.
 */
export class SettingsDialog extends PureComponent<Props, UserSettings> {
  private activeSettings: UserSettings

  static contextType = AppContext

  constructor(props: Props) {
    super(props)
    // Holds the settings that will be saved when the "save" button is clicked.
    this.state = { ...this.props.settings }

    // Holds the actual settings that Streamlit is using.
    this.activeSettings = { ...this.props.settings }
  }

  private renderThemeCreatorButton = (): ReactElement | false =>
    this.props.developerMode && (
      <div>
        <Button onClick={this.props.openThemeCreator} kind={Kind.PRIMARY}>
          Edit active theme
        </Button>
      </div>
    )

  public render(): ReactNode {
    const themeIndex = this.context.availableThemes.findIndex(
      (theme: ThemeConfig) => theme.name === this.context.activeTheme.name
    )

    return (
      <Modal
        animate={this.props.animateModal}
        isOpen
        onClose={this.handleCancelButtonClick}
      >
        <ModalHeader>Settings</ModalHeader>
        <ModalBody>
          <StyledDialogBody>
            {this.props.allowRunOnSave && (
              <React.Fragment>
                <StyledFullRow>
                  <StyledHeader>Development</StyledHeader>
                  <label>
                    <StyledCheckbox
                      disabled={!this.props.isServerConnected}
                      type="checkbox"
                      name="runOnSave"
                      checked={
                        this.state.runOnSave && this.props.isServerConnected
                      }
                      onChange={this.handleCheckboxChange}
                    />{" "}
                    Run on save
                  </label>
                  <StyledSmall>
                    Automatically updates the app when the underlying code is
                    updated.
                  </StyledSmall>
                </StyledFullRow>

                <StyledFullRow>
                  <StyledHr />
                </StyledFullRow>
              </React.Fragment>
            )}

            <StyledFullRow>
              <StyledHeader>Appearance</StyledHeader>
              <label>
                <StyledCheckbox
                  type="checkbox"
                  name="wideMode"
                  checked={this.state.wideMode}
                  onChange={this.handleCheckboxChange}
                />{" "}
                Wide mode
              </label>
              <StyledSmall>
                Turn on to make this app occupy the entire width of the screen
              </StyledSmall>
            </StyledFullRow>

            {this.context.availableThemes.length && (
              <StyledFullRow>
                <StyledLabel>Theme</StyledLabel>
                <StyledSmall>Choose app and font colors/styles</StyledSmall>
                <UISelectbox
                  options={this.context.availableThemes.map(
                    (theme: ThemeConfig) => theme.name
                  )}
                  disabled={false}
                  onChange={this.handleThemeChange}
                  value={themeIndex}
                />
                {this.renderThemeCreatorButton()}
              </StyledFullRow>
            )}
          </StyledDialogBody>
        </ModalBody>
      </Modal>
    )
  }

  public componentDidMount(): void {
    this.setState({ ...this.activeSettings })
  }

  private changeSingleSetting = (name: string, value: boolean): void => {
    // TypeScript doesn't currently have a good solution for setState with
    // a dynamic key name:
    // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/26635
    this.setState(state => ({ ...state, [name]: value }), this.saveSettings)
  }

  private handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.changeSingleSetting(e.target.name, e.target.checked)
  }

  private handleThemeChange = (index: number): void => {
    const { activeTheme: oldTheme, availableThemes }: AppContextProps =
      this.context
    const newTheme = availableThemes[index]

    MetricsManager.current.enqueue("themeChanged", {
      oldThemeName: oldTheme.name,
      newThemeName: newTheme.name,
    })

    this.context.setTheme(newTheme)
  }

  private handleCancelButtonClick = (): void => {
    // Discard settings from this.state by not saving them in this.settings.
    // this.settings = {...this.state};
    this.props.onClose()
  }

  private saveSettings = (): void => {
    this.activeSettings = { ...this.state }
    this.props.onSave(this.activeSettings)
  }
}

/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React, { ChangeEvent, PureComponent, ReactNode } from "react"
import UISelectbox from "components/shared/Dropdown"
import { CustomThemeConfig } from "autogen/proto"
import { createPresetThemes, createTheme, ThemeConfig } from "theme"
import Modal, { ModalHeader, ModalBody } from "components/shared/Modal"
import { Small } from "components/shared/TextElements"
import ThemeCreator from "./ThemeCreator"
import { UserSettings } from "./UserSettings"
import { StyledHeader, StyledLabel, StyledSmall } from "./styled-components"

export interface Props {
  isServerConnected: boolean
  onClose: () => void
  onSave: (settings: UserSettings) => void
  settings: UserSettings
  allowRunOnSave: boolean
  allowedThemes: ThemeConfig[]
}

/**
 * Implements a dialog that is used to configure user settings.
 */
export class SettingsDialog extends PureComponent<Props, UserSettings> {
  private activeSettings: UserSettings

  constructor(props: Props) {
    super(props)
    // Holds the settings that will be saved when the "save" button is clicked.
    this.state = { ...this.props.settings }

    // Holds the actual settings that Streamlit is using.
    this.activeSettings = { ...this.props.settings }
  }

  public render = (): ReactNode => {
    const themeIndex = this.props.allowedThemes.findIndex(
      theme => theme.name === this.activeSettings.activeTheme.name
    )
    const hasCustomTheme =
      this.props.allowedThemes.length !== createPresetThemes().length

    return (
      <Modal isOpen onClose={this.handleCancelButtonClick}>
        <ModalHeader>Settings</ModalHeader>
        <ModalBody>
          {this.props.allowRunOnSave ? (
            <>
              <StyledHeader>Development</StyledHeader>
              <label>
                <input
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
              <br />
              <Small>
                Automatically updates the app when the underlying code is
                updated
              </Small>
            </>
          ) : null}
          <h3>Appearance</h3>
          <label>
            <input
              type="checkbox"
              name="wideMode"
              checked={this.state.wideMode}
              onChange={this.handleCheckboxChange}
            />{" "}
            Wide mode
          </label>
          <div>
            <Small>
              Turn on to make this app occupy the entire width of the screen
            </Small>
          </div>
          {this.props.allowedThemes.length > 1 ? (
            <>
              <StyledLabel>Theme</StyledLabel>
              <StyledSmall>Choose app and font colors/styles</StyledSmall>
              <UISelectbox
                options={this.props.allowedThemes.map(theme => theme.name)}
                disabled={false}
                onChange={this.handleThemeChange}
                value={themeIndex}
              />
              <ThemeCreator
                label={
                  hasCustomTheme
                    ? "Edit Existing Custom Theme"
                    : "Create a new Custom Theme"
                }
                updateThemeInput={this.handleThemeCreator}
                themeInput={{
                  name: this.state.activeTheme.name,
                  primaryColor: this.state.activeTheme.emotion.colors.primary,
                  secondaryColor: this.state.activeTheme.emotion.colors
                    .secondary,
                  backgroundColor: this.state.activeTheme.emotion.colors
                    .bgColor,
                  secondaryBackgroundColor: this.state.activeTheme.emotion
                    .colors.secondaryBg,
                  textColor: this.state.activeTheme.emotion.colors.bodyText,
                }}
              />
            </>
          ) : null}
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
    this.setState(
      {
        activeTheme: this.props.allowedThemes[index],
      },
      this.saveSettings
    )
  }

  private handleThemeCreator = (
    themeInput: Partial<CustomThemeConfig>
  ): void => {
    this.setState({
      activeTheme: createTheme(themeInput),
    })
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

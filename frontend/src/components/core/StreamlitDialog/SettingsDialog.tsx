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
import { Kind } from "components/shared/Button"
import Modal, {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from "components/shared/Modal"
import { UserSettings } from "./UserSettings"

export interface Props {
  isServerConnected: boolean
  onClose: () => void
  onSave: (settings: UserSettings) => void
  settings: UserSettings
  allowRunOnSave: boolean
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
    return (
      <Modal isOpen onClose={this.handleCancelButtonClick}>
        <ModalHeader>Settings</ModalHeader>
        <ModalBody>
          {this.props.allowRunOnSave ? (
            <>
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
            </>
          ) : null}
          <label>
            <input
              type="checkbox"
              name="wideMode"
              checked={this.state.wideMode}
              onChange={this.handleCheckboxChange}
            />{" "}
            Show app in wide mode
          </label>
        </ModalBody>
        <ModalFooter>
          <ModalButton
            kind={Kind.SECONDARY}
            onClick={this.handleCancelButtonClick}
          >
            Cancel
          </ModalButton>
          <ModalButton
            kind={Kind.PRIMARY}
            onClick={this.handleSaveButtonClick}
          >
            Save
          </ModalButton>
        </ModalFooter>
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
    this.setState(state => ({ ...state, [name]: value }))
  }

  private handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.changeSingleSetting(e.target.name, e.target.checked)
  }

  private handleCancelButtonClick = (): void => {
    // Discard settings from this.state by not saving them in this.settings.
    // this.settings = {...this.state};
    this.props.onClose()
  }

  private handleSaveButtonClick = (): void => {
    this.activeSettings = { ...this.state }
    this.props.onSave(this.activeSettings)
    this.props.onClose()
  }
}

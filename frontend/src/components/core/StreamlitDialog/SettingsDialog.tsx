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

import * as React from "react"
import { ChangeEvent, PureComponent, ReactNode } from "react"
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "reactstrap"
import { UserSettings } from "./UserSettings"

export interface Props {
  isServerConnected: boolean
  onClose: () => void
  onSave: (settings: UserSettings) => void
  settings: UserSettings
}

/**
 * Implements a dialog that is used to configure user settings.
 */
export class SettingsDialog extends PureComponent<Props, UserSettings> {
  private _settings: UserSettings

  constructor(props: Props) {
    super(props)

    // Holds the settings that will be saved when the "save" button is clicked.
    this.state = { ...this.props.settings }

    // Holds the actual settings that Streamlit is using.
    this._settings = { ...this.props.settings }
  }

  public render = (): ReactNode => {
    return (
      <Modal
        isOpen={true}
        toggle={this.handleCancelButtonClick}
        onOpened={this.handleDialogOpen}
      >
        <ModalHeader toggle={this.handleCancelButtonClick}>
          Settings
        </ModalHeader>

        <ModalBody>
          <label>
            <input
              disabled={!this.props.isServerConnected}
              type="checkbox"
              name="runOnSave"
              checked={this.state.runOnSave && this.props.isServerConnected}
              onChange={this.handleCheckboxChange}
            />{" "}
            Run on save
          </label>
          <br />
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
          <Button
            outline
            color="secondary"
            onClick={this.handleCancelButtonClick}
          >
            Cancel
          </Button>
          <Button outline color="primary" onClick={this.handleSaveButtonClick}>
            Save
          </Button>
        </ModalFooter>
      </Modal>
    )
  }

  private handleDialogOpen = (): void => {
    this.setState({ ...this._settings })
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
    this._settings = { ...this.state }
    this.props.onSave(this._settings)
    this.props.onClose()
  }
}

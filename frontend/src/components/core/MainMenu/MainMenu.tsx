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

import React, { PureComponent } from "react"
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from "reactstrap"
import Icon from "components/shared/Icon"

import ScreencastOption from "./component/ScreencastOption"
import "./MainMenu.scss"

const ONLINE_DOCS_URL = "https://docs.streamlit.io"
const COMMUNITY_URL = "https://discuss.streamlit.io"
const TEAMS_URL = "https://streamlit.io/forteams"
const BUG_URL = "https://github.com/streamlit/streamlit/issues/new/choose"

interface Props {
  /** True if report sharing is properly configured and enabled. */
  sharingEnabled: boolean

  /** True if we're connected to the Streamlit server. */
  isServerConnected: () => boolean

  /** Rerun the report. */
  quickRerunCallback: () => void

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
}

interface State {
  /** True if the menu is currently visible. */
  dropdownOpen: boolean
}

class MainMenu extends PureComponent<Props, State> {
  /**
   * Constructor.
   */
  constructor(props: Props) {
    super(props)
    this.state = {
      dropdownOpen: false,
    }
  }

  toggle = (): void => {
    this.setState(({ dropdownOpen }) => ({
      dropdownOpen: !dropdownOpen,
    }))
  }

  getOpenInWindowCallback = (url: string) => () => {
    window.open(url, "_blank")
  }

  public render(): JSX.Element {
    const isServerDisconnected = !this.props.isServerConnected()

    return (
      <Dropdown
        id="MainMenu"
        isOpen={this.state.dropdownOpen}
        toggle={this.toggle}
      >
        <DropdownToggle outline color="secondary" id="MainMenuButton">
          <Icon type="menu" />

          {this.props.screenCastState === "RECORDING" && (
            <span className="recording-indicator" />
          )}
        </DropdownToggle>

        <DropdownMenu right>
          <DropdownItem
            disabled={isServerDisconnected}
            onClick={this.props.quickRerunCallback}
          >
            <span>Rerun</span>
            <span className="shortcut">R</span>
          </DropdownItem>

          <DropdownItem
            disabled={isServerDisconnected}
            onClick={this.props.clearCacheCallback}
          >
            <span>Clear cache</span>
            <span className="shortcut">C</span>
          </DropdownItem>

          <DropdownItem divider />

          <ScreencastOption
            screenCastState={this.props.screenCastState}
            onClick={this.props.screencastCallback}
          />

          {/* We hide 'Share Report' + divider if sharing is not configured */}
          {this.props.sharingEnabled && (
            <DropdownItem
              disabled={isServerDisconnected}
              onClick={this.props.shareCallback}
            >
              Save a snapshot
            </DropdownItem>
          )}

          <DropdownItem divider />

          <DropdownItem
            onClick={this.getOpenInWindowCallback(ONLINE_DOCS_URL)}
          >
            Documentation
          </DropdownItem>

          <DropdownItem onClick={this.getOpenInWindowCallback(COMMUNITY_URL)}>
            Ask a question
          </DropdownItem>

          <DropdownItem onClick={this.getOpenInWindowCallback(BUG_URL)}>
            Report a bug
          </DropdownItem>

          <DropdownItem divider />

          <DropdownItem onClick={this.getOpenInWindowCallback(TEAMS_URL)}>
            Streamlit for teams
          </DropdownItem>

          <DropdownItem onClick={this.props.settingsCallback}>
            Settings
          </DropdownItem>

          <DropdownItem onClick={this.props.aboutCallback}>About</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    )
  }
}

export default MainMenu

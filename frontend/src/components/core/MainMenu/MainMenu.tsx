/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import "./MainMenu.scss"

const ONLINE_DOCS_URL = "https://streamlit.io/docs"
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

  /** Share the report to S3. */
  shareCallback: () => void

  /** Show the Settings dialog. */
  settingsCallback: () => void

  /** Show the About dialog. */
  aboutCallback: () => void
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

  public toggle(): void {
    this.setState(({ dropdownOpen }) => ({
      dropdownOpen: !dropdownOpen,
    }))
  }

  public render(): JSX.Element {
    return (
      <Dropdown
        id="MainMenu"
        isOpen={this.state.dropdownOpen}
        toggle={() => this.toggle()}
      >
        <DropdownToggle outline color="secondary" id="MainMenuButton">
          <Icon type="menu" />
        </DropdownToggle>

        <DropdownMenu right>
          <DropdownItem
            disabled={!this.props.isServerConnected()}
            onClick={() => this.props.quickRerunCallback()}
          >
            <span>Rerun</span>
            <span className="shortcut">R</span>
          </DropdownItem>

          <DropdownItem
            disabled={!this.props.isServerConnected()}
            onClick={this.props.clearCacheCallback}
          >
            <span>Clear cache</span>
            <span className="shortcut">C</span>
          </DropdownItem>

          <DropdownItem divider />

          <DropdownItem onClick={() => window.open(ONLINE_DOCS_URL, "_blank")}>
            Documentation
          </DropdownItem>

          <DropdownItem onClick={() => window.open(COMMUNITY_URL, "_blank")}>
            Ask a question
          </DropdownItem>

          <DropdownItem onClick={() => window.open(BUG_URL, "_blank")}>
            Report a bug
          </DropdownItem>

          <DropdownItem divider />

          {/* We hide 'Share Report' + divider if sharing is not configured */}
          {this.props.sharingEnabled && (
            <DropdownItem
              disabled={!this.props.isServerConnected()}
              onClick={this.props.shareCallback}
            >
              Save a snapshot
            </DropdownItem>
          )}

          {this.props.sharingEnabled && <DropdownItem divider />}

          <DropdownItem onClick={() => window.open(TEAMS_URL, "_blank")}>
            Streamlit for teams
          </DropdownItem>

          <DropdownItem onClick={() => this.props.settingsCallback()}>
            Settings
          </DropdownItem>

          <DropdownItem onClick={() => this.props.aboutCallback()}>
            About
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    )
  }
}

export default MainMenu

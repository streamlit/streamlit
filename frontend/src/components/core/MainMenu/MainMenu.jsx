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
import Icon from "components/core/Icon"

import "./MainMenu.scss"

const ONLINE_DOCS_URL = "https://streamlit.io/docs"
const COMMUNITY_URL = "https://discuss.streamlit.io"
const TEAMS_URL = "https://streamlit.io/teams"
const BUG_URL = "https://github.com/streamlit/streamlit/issues/new/choose"

class MainMenu extends PureComponent {
  /**
   * Constructor.
   */
  constructor(props) {
    super(props)
    this.state = {
      dropdownOpen: false,
    }
  }

  toggle() {
    this.setState(({ dropdownOpen }) => ({
      dropdownOpen: !dropdownOpen,
    }))
  }

  render() {
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

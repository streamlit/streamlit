/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, {Component} from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from 'reactstrap';
import './MainMenu.scss';

const ONLINE_DOCS_URL = '//streamlit.io/secret/docs';

/**
 *
 */
class MainMenu extends Component {
  /**
   * Constructor.
   */
  constructor(props) {
    super(props);
    this.state = {
      dropdownOpen: false,
    };
  }

  toggle() {
    this.setState(({dropdownOpen}) => ({
      dropdownOpen: !dropdownOpen,
    }));
  }

  render() {
    return (
      <Dropdown
        id="MainMenu"
        isOpen={this.state.dropdownOpen}
        toggle={() => this.toggle()}
      >
        <DropdownToggle outline color="secondary" id="MainMenuButton">
          <svg className="icon" viewBox="0 0 8 8">
            <use xlinkHref="./open-iconic.min.svg#menu" />
          </svg>
        </DropdownToggle>

        <DropdownMenu right>
          <DropdownItem
            disabled={!this.props.isProxyConnected()}
            onClick={this.props.quickRerunCallback}>
            <span>Rerun</span>
            <span className="shortcut">R</span>
          </DropdownItem>

          <DropdownItem
            disabled={!this.props.isProxyConnected()}
            onClick={this.props.rerunCallback}>
            <span>Edit command</span>
            <span className="shortcut">&#x21e7;R</span>
          </DropdownItem>

          <DropdownItem
            disabled={!this.props.isProxyConnected()}
            onClick={this.props.clearCacheCallback}>
            <span>Clear cache</span>
            <span className="shortcut">C</span>
          </DropdownItem>

          <DropdownItem divider/>

          <DropdownItem
            disabled={!this.props.isProxyConnected()}
            onClick={this.props.saveCallback}>
            Share report
          </DropdownItem>

          <DropdownItem divider/>

          <DropdownItem
            onClick={() => this.props.settingsCallback()}>
            Settings
          </DropdownItem>

          <DropdownItem
            onClick={() => window.open(ONLINE_DOCS_URL, '_blank')}>
            Documentation
          </DropdownItem>

          <DropdownItem
            onClick={() => this.props.aboutCallback()}>
            About
          </DropdownItem>

        </DropdownMenu>
      </Dropdown>
    );
  }
}

export default MainMenu;

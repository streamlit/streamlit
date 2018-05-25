/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, { PureComponent } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from 'reactstrap';
import './MainMenu.css';

const NORMAL_CLOSURE = 1000;
const RECONNECT_TIMEOUT = 200.0;
const DISCONNECTED_STATE = 'disconnected';
const CONNECTED_STATE = 'connected';
const ERROR_STATE = 'error'

/**
 *
 */
class MainMenu extends PureComponent {
  /**
   * Constructor.
   */
  constructor(props) {
    super(props);
    this.state = {
      dropdownOpen: false,
    };
  }

  handleSaveButtonClicked() {
    this.props.saveButtonCallback();
  }

  handleHelpButtonClicked() {
    this.props.helpButtonCallback();
  }

  toggle() {
    this.setState(s => ({
      dropdownOpen: !s.dropdownOpen,
    }));
  }

  render() {
    return (
      <Dropdown
          id="MainMenu"
          isOpen={this.state.dropdownOpen} toggle={() => this.toggle()}
          >
        <DropdownToggle id="MainMenuButton">
          <svg className="icon" viewBox="0 0 8 8">
            <use xlinkHref="./open-iconic.min.svg#menu" />
          </svg>
        </DropdownToggle>

        <DropdownMenu right>

          <DropdownItem
              disabled={this.state.itemsDisabled}
              onClick={() => this.handleSaveButtonClicked()}>
            Save report
          </DropdownItem>

          <DropdownItem divider/>

          <DropdownItem
              disabled={this.state.itemsDisabled}
              onClick={() => this.handleHelpButtonClicked()}>
            Help
          </DropdownItem>

        </DropdownMenu>
      </Dropdown>
    )
  };
};

export default MainMenu;


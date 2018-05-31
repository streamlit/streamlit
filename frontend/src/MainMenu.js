/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, {PureComponent} from 'react';
import {ConnectionState} from './ConnectionState';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from 'reactstrap';
import './MainMenu.css';

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

  getDisabledItems() {
    return {
      save: this.props.connectionState == ConnectionState.STATIC ||
            this.props.connectionState == ConnectionState.DISCONNECTED ||
            this.props.connectionState == null,
      help: this.props.isHelpPage ||
            this.props.connectionState == ConnectionState.STATIC ||
            this.props.connectionState == ConnectionState.DISCONNECTED ||
            this.props.connectionState == null,
    }
  }

  render() {
    const disabledItems = this.getDisabledItems();

    return (
      <Dropdown
          id="MainMenu"
          isOpen={this.state.dropdownOpen}
          toggle={() => this.toggle()}
          >
        <DropdownToggle id="MainMenuButton">
          <svg className="icon" viewBox="0 0 8 8">
            <use xlinkHref="./open-iconic.min.svg#menu" />
          </svg>
        </DropdownToggle>

        <DropdownMenu right>

          <DropdownItem
              disabled={disabledItems.save}
              onClick={() => this.handleSaveButtonClicked()}>
            Save report
          </DropdownItem>

          <DropdownItem divider/>

          <DropdownItem
              disabled={disabledItems.help}
              onClick={() => this.handleHelpButtonClicked()}>
            Help
          </DropdownItem>

        </DropdownMenu>
      </Dropdown>
    )
  };
};

export default MainMenu;


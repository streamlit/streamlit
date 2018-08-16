/**
 * Implements a persistent websocket connection.
 * Displays itself as an icon indicating the connection type.
 */

import React, {Component} from 'react';
import ConnectionState from './ConnectionState';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from 'reactstrap';
import './MainMenu.css';

const ONLINE_DOCS_URL = 'http://streamlit.io/docs';

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

  getDisabledItems() {
    return {
      rerun: this.props.connectionState === ConnectionState.STATIC ||
             this.props.connectionState === ConnectionState.DISCONNECTED ||
             this.props.connectionState === null,
      save:  this.props.connectionState === ConnectionState.STATIC ||
             this.props.connectionState === ConnectionState.DISCONNECTED ||
             this.props.connectionState === null,
      help:  this.props.isHelpPage ||
             this.props.connectionState === ConnectionState.STATIC ||
             this.props.connectionState === ConnectionState.DISCONNECTED ||
             this.props.connectionState === null,
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
              disabled={disabledItems.rerun}
              onClick={this.props.quickRerunCallback}>
            <span>Rerun</span>
            <span className="shortcut">R</span>
          </DropdownItem>

          <DropdownItem
              disabled={disabledItems.rerun}
              onClick={this.props.rerunCallback}>
            <span>Edit Command</span>
            <span className="shortcut">&#x21e7;R</span>
          </DropdownItem>

          <DropdownItem divider/>

          <DropdownItem
              disabled={disabledItems.save}
              onClick={this.props.saveCallback}>
            Save report
          </DropdownItem>

          <DropdownItem divider/>

          <DropdownItem
              onClick={() => this.handleDocButtonClicked()}>
            Documentation
          </DropdownItem>

          <DropdownItem
              disabled={disabledItems.help}
              onClick={this.props.helpCallback}>
            Help
          </DropdownItem>

        </DropdownMenu>
      </Dropdown>
    )
  };
};

export default MainMenu;

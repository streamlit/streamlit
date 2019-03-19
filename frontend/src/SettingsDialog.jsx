/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Implements a dialog that is used to configure user settings.
 */

import React, { PureComponent } from 'react';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';

/**
 *
 */
class SettingsDialog extends PureComponent {
  /**
   * Constructor.
   */
  constructor(props) {
    super(props);

    // Holds the settings that will be saved when the "save" button is clicked.
    this.state = { ...this.props.settings };

    // Holds the actual settings that Streamlit is using.
    this.settings = { ...this.props.settings };

    this.handleDialogOpen = this.handleDialogOpen.bind(this);
    this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
    this.handleSaveButtonClick = this.handleSaveButtonClick.bind(this);
    this.handleCancelButtonClick = this.handleCancelButtonClick.bind(this);
  }

  render() {
    return (
      <Modal
        isOpen={this.props.isOpen}
        toggle={this.handleCancelButtonClick}
        onOpened={this.handleDialogOpen}
      >
        <ModalHeader toggle={this.handleCancelButtonClick}>Settings</ModalHeader>

        <ModalBody>
          <label>
            <input
              type="checkbox"
              name="wideMode"
              checked={this.state.wideMode}
              onChange={this.handleCheckboxChange}
            />
            {' '}
            Show report in wide mode
          </label>
        </ModalBody>

        <ModalFooter>
          <Button
            color="secondary"
            onClick={this.handleCancelButtonClick}>
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={this.handleSaveButtonClick}>
            Save
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  handleDialogOpen() {
    this.setState({ ...this.settings });
  }

  changeSingleSetting(name, value) {
    this.setState({ [name]: value });
  }

  handleCheckboxChange(e) {
    this.changeSingleSetting(e.target.name, e.target.checked);
  }

  handleCancelButtonClick() {
    // Discard settings from this.state by not saving them in this.settings.
    // this.settings = {...this.state};
    this.props.onClose();
  }

  handleSaveButtonClick() {
    this.settings = { ...this.state };
    this.props.onSave(this.settings);
    this.props.onClose();
  }
}

export default SettingsDialog;

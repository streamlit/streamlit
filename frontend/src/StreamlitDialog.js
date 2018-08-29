import React from 'react';

import {
  // Alert,
  Button,
  // Col,
  // Container,
  Modal,
  ModalBody,
  ModalFooter,
  Progress,
  // Row,
  // UncontrolledTooltip,
} from 'reactstrap';

import SettingsDialog from './SettingsDialog';
import {CopyToClipboard} from 'react-copy-to-clipboard';

import './StreamlitDialog.css';

function StreamlitDialog({ dialogProps }) {
  // This table of functions constructs the dialog based on dialogProps.type
  const populateDialogTable = {
    'uploadProgress': uploadProgressDialog,
    'uploaded': uploadedDialog,
    'warning': warningDialog,
    'rerunScript': rerunScriptDialog,
    'settings': settingsDialog,
    [undefined]: noDialog,
  };
  const populateDialogFunc =
    populateDialogTable[dialogProps.type] || typeNotRecognizedDialog;

  // We call that function to populate the dialog.
  const {body, footer, custom} = populateDialogFunc(dialogProps);

  // Show custom dialog.
  if (custom) {
    return custom;
  }

  // Show generic dialog.

  const isOpen = ((body !== undefined) || (footer !== undefined));

  return (
    <Modal
        isOpen={isOpen}
        toggle={dialogProps.onClose}
        className="streamlit-dialog"
    >
      { body }
      { footer }
    </Modal>
  );
}

/**
 * Shows the progress of an upload in progress.
 */
function uploadProgressDialog({progress}) {

  return { body:
    <ModalBody>
      <div className="streamlit-upload-first-line">
        Saving report...
      </div>
      <div>
        <Progress animated value={progress}/>
      </div>
    </ModalBody>
  }
}

/**
 * Shows the URL after something has been uploaded.
 */
function uploadedDialog({url, onClose}) {
  return {
    body: (
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Report saved to:
        </div>
        <div id="streamlit-upload-url"> {url} </div>
      </ModalBody>
    ),
    footer: (
      <ModalFooter>
        <CopyToClipboard text={url} onCopy={onClose}>
          <Button>Copy to clipboard</Button>
        </CopyToClipboard>{' '}
        <Button onClick={onClose}>Done</Button>
      </ModalFooter>
    ),
  };
}

/**
 * Returns an empty dictionary, indicating that no object is to be displayed.
 */
function noDialog() {
  return {}
}

/**
 * Prints out a warning
 */
function warningDialog({msg, onClose}) {
  return {
    body: <ModalBody>{msg}</ModalBody>,
    footer: (
      <ModalFooter>
        <Button onClick={onClose}>Done</Button>
      </ModalFooter>
    ),
  };
}

/**
 * Dialog shown when the user wants to rerun a script.
 *
 * getCommandLine - callback to get the script's command line
 * setCommandLine - callback to set the script's command line
 * rerunCallback  - callback to rerun the script's command line
 * onClose        - callback to close the dialog
 */
function rerunScriptDialog({getCommandLine, setCommandLine,
    rerunCallback, onClose}) {
  return {
    body: (
      <ModalBody>
        <div className="rerun-header">Command Line:</div>
        <div>
          <textarea autoFocus
            className="command-line"
            value={getCommandLine()}
            onChange={(event) => setCommandLine(event.target.value)}
          />
        </div>
      </ModalBody>
    ),
    footer: (
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>Cancel</Button>{' '}
        <Button color="primary" onClick={rerunCallback}>Rerun</Button>
      </ModalFooter>
    ),
  };
}


/*8
 * Shows the settings dialog.
 */
function settingsDialog({settings, isOpen, onSave, onClose}) {
  return {
    custom: (
      <SettingsDialog
        settings={settings}
        isOpen={isOpen}
        onSave={onSave}
        onClose={onClose}
      />
    ),
  };
}

/**
 * If the dialog type is not recognized, dipslay this dialog.
 */
function typeNotRecognizedDialog({type}) {
  return {
    body: <ModalBody>{`Dialog type "${type}" not recognized.`}</ModalBody>
  };
}

export default StreamlitDialog;

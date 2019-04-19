/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react';

import {
  // Alert,
  Button,
  // Col,
  // Container,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
  // Row,
  // UncontrolledTooltip,
} from 'reactstrap';

import SettingsDialog from './SettingsDialog';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import {STREAMLIT_VERSION} from './baseconsts';

import './StreamlitDialog.css';

function StreamlitDialog({dialogProps}) {
  // This table of functions constructs the dialog based on dialogProps.type
  const populateDialogTable = {
    'about': aboutDialog,
    'uploadProgress': uploadProgressDialog,
    'uploaded': uploadedDialog,
    'warning': warningDialog,
    'rerunScript': rerunScriptDialog,
    'clearCache': clearCacheDialog,
    'settings': settingsDialog,
    [undefined]: noDialog,
  };

  const populateDialogFunc =
    populateDialogTable[dialogProps.type] || typeNotRecognizedDialog;

  return populateDialogFunc(dialogProps);
}

function BasicDialog({children, onClose}) {
  const isOpen = children !== undefined;
  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      className="streamlit-dialog"
    >
      { children }
    </Modal>
  );
}

/**
 * Shows the progress of an upload in progress.
 */
function uploadProgressDialog({progress, onClose}) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Saving report...
        </div>
        <div>
          <Progress animated value={progress}/>
        </div>
      </ModalBody>
    </BasicDialog>
  );
}

/**
 * Shows the URL after something has been uploaded.
 */
function uploadedDialog({url, onClose}) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Report saved to:
        </div>
        <div id="streamlit-upload-url"> {url} </div>
      </ModalBody>
      <ModalFooter>
        <CopyToClipboard text={url} onCopy={onClose}>
          <Button outline>Copy to clipboard</Button>
        </CopyToClipboard>{' '}
        <Button outline onClick={onClose}>Done</Button>
      </ModalFooter>
    </BasicDialog>
  );
}

/**
 * Returns an empty dictionary, indicating that no object is to be displayed.
 */
function noDialog({onClose}) {
  return <BasicDialog onClose={onClose}></BasicDialog>;
}

/**
 * Prints out a warning
 */
function warningDialog({msg, onClose}) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalBody>{msg}</ModalBody>,
      <ModalFooter>
        <Button outline onClick={onClose}>Done</Button>
      </ModalFooter>
    </BasicDialog>
  );
}

/**
 * Dialog shown when the user wants to rerun a script.
 *
 * getCommandLine - callback to get the script's command line
 * setCommandLine - callback to set the script's command line
 * rerunCallback  - callback to rerun the script's command line
 * onClose        - callback to close the dialog
 */
function rerunScriptDialog(
  {getCommandLine, setCommandLine, rerunCallback, onClose}) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalBody>
        <div className="rerun-header">Command line:</div>
        <div>
          <textarea autoFocus
            className="command-line"
            value={getCommandLine()}
            onChange={(event) => setCommandLine(event.target.value)}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="secondary" onClick={onClose}>Cancel</Button>{' '}
        <Button outline color="primary" onClick={rerunCallback}>Rerun</Button>
      </ModalFooter>
    </BasicDialog>
  );
}

/**
 * Dialog shown when the user wants to clear the cache.
 *
 * confirmCallback - callback to send the clear_cache request to the Proxy
 * onClose         - callback to close the dialog
 */
function clearCacheDialog({ confirmCallback, onClose }) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalBody>
        <div className="streamlit-container">
          Are you sure you want to clear the <code>@st.cache</code> function cache?
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="secondary" onClick={onClose}>Cancel</Button>{' '}
        <Button outline color="primary" onClick={confirmCallback}>Clear cache</Button>
      </ModalFooter>
    </BasicDialog>
  );
}


/**
 * Shows the settings dialog.
 */
function settingsDialog({settings, isProxyConnected, isOpen, onSave, onClose}) {
  return (
    <SettingsDialog
      settings={settings}
      isProxyConnected={isProxyConnected}
      isOpen={isOpen}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

/**
 * If the dialog type is not recognized, dipslay this dialog.
 */
function typeNotRecognizedDialog({type, onClose}) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalBody>{`Dialog type "${type}" not recognized.`}</ModalBody>
    </BasicDialog>
  );
}

/**
 * About Dialog
 * onClose          - callback to close the dialog
 */
function aboutDialog({onClose}) {
  return (
    <BasicDialog onClose={onClose}>
      <ModalHeader toggle={onClose}>About</ModalHeader>
      <ModalBody>
        <div>
            Streamlit v{STREAMLIT_VERSION}<br/>
          <a href="https://streamlit.io">https://streamlit.io</a><br/>
            Copyright 2019 Streamlit Inc. All rights reserved.
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="primary" onClick={onClose}>Close</Button>
      </ModalFooter>
    </BasicDialog>
  );
}

export default StreamlitDialog;

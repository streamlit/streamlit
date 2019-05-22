/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React, {ReactElement, ReactNode} from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import {Button, Modal, ModalBody, ModalFooter, ModalHeader, Progress} from 'reactstrap'

import {Exception} from 'autogen/protobuf'
import {Props as SettingsDialogProps, SettingsDialog} from './SettingsDialog'
import {STREAMLIT_VERSION} from 'lib/baseconsts'

import './StreamlitDialog.scss'

type CloseHandler = () => void;

type DialogProps =
  AboutProps |
  ClearCacheProps |
  RerunScriptProps |
  SettingsProps |
  ScriptCompileErrorProps |
  UploadProgressProps |
  UploadedProps |
  WarningProps;

export function StreamlitDialog(dialogProps: DialogProps): ReactNode {
  switch (dialogProps.type) {
    case 'about':
      return aboutDialog(dialogProps)
    case 'clearCache':
      return clearCacheDialog(dialogProps)
    case 'rerunScript':
      return rerunScriptDialog(dialogProps)
    case 'settings':
      return settingsDialog(dialogProps)
    case 'scriptCompileError':
      return scriptCompileErrorDialog(dialogProps)
    case 'uploadProgress':
      return uploadProgressDialog(dialogProps)
    case 'uploaded':
      return uploadedDialog(dialogProps)
    case 'warning':
      return warningDialog(dialogProps)
    case undefined:
      return noDialog(dialogProps)
    default:
      return typeNotRecognizedDialog(dialogProps)
  }
}

interface AboutProps {
  type: 'about';

  /** Callback to close the dialog */
  onClose: CloseHandler;
}

/** About Dialog */
function aboutDialog(props: AboutProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalHeader toggle={props.onClose}>About</ModalHeader>
      <ModalBody>
        <div>
          Streamlit v{STREAMLIT_VERSION}<br/>
          <a href="https://streamlit.io">https://streamlit.io</a><br/>
          Copyright 2019 Streamlit Inc. All rights reserved.
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="primary" onClick={props.onClose}>Close</Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface ClearCacheProps {
  type: 'clearCache';
  /** callback to send the clear_cache request to the Proxy */
  confirmCallback: () => void;

  /** callback to close the dialog */
  onClose: CloseHandler;
}

/**
 * Dialog shown when the user wants to clear the cache.
 *
 * confirmCallback - callback to send the clear_cache request to the Proxy
 * onClose         - callback to close the dialog
 */
function clearCacheDialog(props: ClearCacheProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>
        <div className="streamlit-container">
          Are you sure you want to clear the <code>@st.cache</code> function cache?
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="secondary" onClick={props.onClose}>Cancel</Button>{' '}
        <Button outline color="primary" onClick={props.confirmCallback}>Clear cache</Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface RerunScriptProps {
  type: 'rerunScript';

  /** Callback to get the script's command line */
  getCommandLine: () => string | string[];

  /** Callback to set the script's command line */
  setCommandLine: (value: string) => void;

  /** Callback to rerun the script */
  rerunCallback: () => void;

  /** Callback to close the dialog */
  onClose: CloseHandler;
}

/**
 * Dialog shown when the user wants to rerun a script.
 */
function rerunScriptDialog(props: RerunScriptProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>
        <div className="rerun-header">Command line:</div>
        <div>
          <textarea
            autoFocus
            className="command-line"
            value={props.getCommandLine()}
            onChange={(event) => props.setCommandLine(event.target.value)}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="secondary" onClick={props.onClose}>Cancel</Button>{' '}
        <Button outline color="primary" onClick={props.rerunCallback}>Rerun</Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface ScriptCompileErrorProps {
  type: 'scriptCompileError';
  exception: Exception;
  onClose: CloseHandler;
}

function scriptCompileErrorDialog(props: ScriptCompileErrorProps): ReactElement {
  let message = props.exception.message
  if (message) {
    message = `: ${message}`
  }

  return (
    <BasicDialog onClose={props.onClose}>
      <ModalHeader toggle={props.onClose}>Script Error</ModalHeader>
      <ModalBody>
        <div>
          <strong>{props.exception.type}</strong>{message}
          <br/>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="primary" onClick={props.onClose}>Close</Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface SettingsProps extends SettingsDialogProps {
  type: 'settings';
}

/**
 * Shows the settings dialog.
 */
function settingsDialog(props: SettingsProps): ReactElement {
  return (
    <SettingsDialog {...props}/>
  )
}

interface UploadProgressProps {
  type: 'uploadProgress';
  progress?: string | number;
  onClose: CloseHandler;
}

/**
 * Shows the progress of an upload in progress.
 */
function uploadProgressDialog(props: UploadProgressProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Saving report...
        </div>
        <div>
          <Progress animated value={props.progress}/>
        </div>
      </ModalBody>
    </BasicDialog>
  )
}

interface UploadedProps {
  type: 'uploaded';
  url: string;
  onClose: CloseHandler;
}

/**
 * Shows the URL after something has been uploaded.
 */
function uploadedDialog(props: UploadedProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Report saved to:
        </div>
        <div id="streamlit-upload-url"> {props.url} </div>
      </ModalBody>
      <ModalFooter>
        <CopyToClipboard text={props.url} onCopy={props.onClose}>
          <Button outline>Copy to clipboard</Button>
        </CopyToClipboard>{' '}
        <Button outline onClick={props.onClose}>Done</Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface WarningProps {
  type: 'warning';
  msg: ReactNode;
  onClose: CloseHandler;
}

/**
 * Prints out a warning
 */
function warningDialog(props: WarningProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>{props.msg}</ModalBody>
      <ModalFooter>
        <Button outline onClick={props.onClose}>Done</Button>
      </ModalFooter>
    </BasicDialog>
  )
}

function BasicDialog({children, onClose}: { children?: ReactNode; onClose?: CloseHandler }): ReactElement {
  const isOpen = children !== undefined
  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      className="streamlit-dialog"
    >
      {children}
    </Modal>
  )
}

/**
 * Returns an empty dictionary, indicating that no object is to be displayed.
 */
function noDialog({onClose}: { onClose: CloseHandler }): ReactElement {
  return <BasicDialog onClose={onClose}/>
}

interface NotRecognizedProps {
  type: string;
  onClose: CloseHandler;
}

/**
 * If the dialog type is not recognized, display this dialog.
 */
function typeNotRecognizedDialog(props: NotRecognizedProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>{`Dialog type "${props.type}" not recognized.`}</ModalBody>
    </BasicDialog>
  )
}

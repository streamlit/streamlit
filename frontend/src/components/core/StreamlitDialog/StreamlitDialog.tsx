/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import CopyToClipboard from "react-copy-to-clipboard"
import React, { ReactElement, ReactNode } from "react"
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
} from "reactstrap"
import { HotKeys } from "react-hotkeys"

import {
  ScriptChangedDialog,
  Props as ScriptChangedDialogProps,
} from "components/core/StreamlitDialog/ScriptChangedDialog"
import { IException } from "autogen/proto"
import { Props as SettingsDialogProps, SettingsDialog } from "./SettingsDialog"
import { SessionInfo } from "lib/SessionInfo"

import "./StreamlitDialog.scss"

type PlainEventHandler = () => void

interface SettingsProps extends SettingsDialogProps {
  type: DialogType.SETTINGS
}

interface ScriptChangedProps extends ScriptChangedDialogProps {
  type: DialogType.SCRIPT_CHANGED
}

export type DialogProps =
  | AboutProps
  | ClearCacheProps
  | RerunScriptProps
  | SettingsProps
  | ScriptChangedProps
  | ScriptCompileErrorProps
  | UploadProgressProps
  | UploadedProps
  | WarningProps

export enum DialogType {
  ABOUT = "about",
  CLEAR_CACHE = "clearCache",
  RERUN_SCRIPT = "rerunScript",
  SETTINGS = "settings",
  SCRIPT_CHANGED = "scriptChanged",
  SCRIPT_COMPILE_ERROR = "scriptCompileError",
  UPLOAD_PROGRESS = "uploadProgress",
  UPLOADED = "uploaded",
  WARNING = "warning",
}

export function StreamlitDialog(dialogProps: DialogProps): ReactNode {
  switch (dialogProps.type) {
    case DialogType.ABOUT:
      return aboutDialog(dialogProps)
    case DialogType.CLEAR_CACHE:
      return clearCacheDialog(dialogProps)
    case DialogType.RERUN_SCRIPT:
      return rerunScriptDialog(dialogProps)
    case DialogType.SETTINGS:
      return settingsDialog(dialogProps)
    case DialogType.SCRIPT_CHANGED:
      return <ScriptChangedDialog {...dialogProps} />
    case DialogType.SCRIPT_COMPILE_ERROR:
      return scriptCompileErrorDialog(dialogProps)
    case DialogType.UPLOAD_PROGRESS:
      return uploadProgressDialog(dialogProps)
    case DialogType.UPLOADED:
      return uploadedDialog(dialogProps)
    case DialogType.WARNING:
      return warningDialog(dialogProps)
    case undefined:
      return noDialog(dialogProps)
    default:
      return typeNotRecognizedDialog(dialogProps)
  }
}

interface AboutProps {
  type: DialogType.ABOUT

  /** Callback to close the dialog */
  onClose: PlainEventHandler
}

/** About Dialog */
function aboutDialog(props: AboutProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalHeader toggle={props.onClose}>About</ModalHeader>
      <ModalBody>
        <div>
          Streamlit v{SessionInfo.current.streamlitVersion}
          <br />
          <a href="https://streamlit.io">https://streamlit.io</a>
          <br />
          Copyright 2020 Streamlit Inc. All rights reserved.
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="primary" onClick={props.onClose}>
          Close
        </Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface ClearCacheProps {
  type: DialogType.CLEAR_CACHE
  /** callback to send the clear_cache request to the Proxy */
  confirmCallback: () => void

  /** callback to close the dialog */
  onClose: PlainEventHandler

  /** callback to run the default action */
  defaultAction: () => void
}

/**
 * Dialog shown when the user wants to clear the cache.
 *
 * confirmCallback - callback to send the clear_cache request to the Proxy
 * onClose         - callback to close the dialog
 */
function clearCacheDialog(props: ClearCacheProps): ReactElement {
  const keyHandlers = {
    enter: () => props.defaultAction(),
  }

  // Not sure exactly why attach is necessary on the HotKeys
  // component here but it's not working without it
  return (
    <HotKeys handlers={keyHandlers} attach={window}>
      <BasicDialog onClose={props.onClose}>
        <ModalBody>
          <div>
            Are you sure you want to clear the <code>@st.cache</code> function
            cache?
          </div>
        </ModalBody>
        <ModalFooter>
          <Button outline color="secondary" onClick={props.onClose}>
            Cancel
          </Button>{" "}
          <Button outline color="primary" onClick={props.confirmCallback}>
            Clear cache
          </Button>
        </ModalFooter>
      </BasicDialog>
    </HotKeys>
  )
}

interface RerunScriptProps {
  type: DialogType.RERUN_SCRIPT

  /** Callback to get the script's command line */
  getCommandLine: () => string | string[]

  /** Callback to set the script's command line */
  setCommandLine: (value: string) => void

  /** Callback to rerun the script */
  rerunCallback: () => void

  /** Callback to close the dialog */
  onClose: PlainEventHandler

  /** Callback to run the default action */
  defaultAction: () => void
}

/**
 * Dialog shown when the user wants to rerun a script.
 */
function rerunScriptDialog(props: RerunScriptProps): ReactElement {
  const keyHandlers = {
    enter: () => props.defaultAction(),
  }

  // Not sure exactly why attach is necessary on the HotKeys
  // component here but it's not working without it
  return (
    <HotKeys handlers={keyHandlers} attach={window}>
      <BasicDialog onClose={props.onClose}>
        <ModalBody>
          <div className="rerun-header">Command line:</div>
          <div>
            <textarea
              autoFocus
              className="command-line"
              value={props.getCommandLine()}
              onChange={event => props.setCommandLine(event.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button outline color="secondary" onClick={props.onClose}>
            Cancel
          </Button>{" "}
          <Button
            outline
            color="primary"
            onClick={() => props.rerunCallback()}
          >
            Rerun
          </Button>
        </ModalFooter>
      </BasicDialog>
    </HotKeys>
  )
}

interface ScriptCompileErrorProps {
  type: DialogType.SCRIPT_COMPILE_ERROR
  exception: IException | null | undefined
  onClose: PlainEventHandler
}

function scriptCompileErrorDialog(
  props: ScriptCompileErrorProps
): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalHeader toggle={props.onClose}>Script execution error</ModalHeader>
      <ModalBody>
        <div>
          <pre>
            <code>
              {props.exception ? props.exception.message : "No message"}
            </code>
          </pre>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button outline color="primary" onClick={props.onClose}>
          Close
        </Button>
      </ModalFooter>
    </BasicDialog>
  )
}

/**
 * Shows the settings dialog.
 */
function settingsDialog(props: SettingsProps): ReactElement {
  return <SettingsDialog {...props} />
}

interface UploadProgressProps {
  type: DialogType.UPLOAD_PROGRESS
  progress?: string | number
  onClose: PlainEventHandler
}

/**
 * Shows the progress of an upload in progress.
 */
function uploadProgressDialog(props: UploadProgressProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>
        <div className="streamlit-upload-first-line">
          Saving app snapshot...
        </div>
        <div>
          <Progress animated value={props.progress} />
        </div>
      </ModalBody>
    </BasicDialog>
  )
}

interface UploadedProps {
  type: DialogType.UPLOADED
  url: string
  onClose: PlainEventHandler
}

/**
 * Shows the URL after something has been uploaded.
 */
function uploadedDialog(props: UploadedProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalBody>
        <div className="streamlit-upload-first-line">
          App snapshot saved to:
        </div>
        <pre id="streamlit-upload-url">
          <a href={props.url} target="_blank" rel="noopener noreferrer">
            {props.url}
          </a>
        </pre>
      </ModalBody>
      <ModalFooter>
        <CopyToClipboard text={props.url} onCopy={props.onClose}>
          <Button outline className="mr-auto">
            Copy to clipboard
          </Button>
        </CopyToClipboard>{" "}
        <Button
          outline
          onClick={() => {
            window.open(props.url, "_blank")
            props.onClose()
          }}
        >
          Open
        </Button>
        <Button outline onClick={props.onClose}>
          Done
        </Button>
      </ModalFooter>
    </BasicDialog>
  )
}

interface WarningProps {
  type: DialogType.WARNING
  title: string
  msg: ReactNode
  onClose: PlainEventHandler
}

/**
 * Prints out a warning
 */
function warningDialog(props: WarningProps): ReactElement {
  return (
    <BasicDialog onClose={props.onClose}>
      <ModalHeader>{props.title}</ModalHeader>
      <ModalBody>{props.msg}</ModalBody>
      <ModalFooter>
        <Button outline onClick={props.onClose}>
          Done
        </Button>
      </ModalFooter>
    </BasicDialog>
  )
}

export function BasicDialog({
  children,
  onClose,
}: {
  children?: ReactNode
  onClose?: PlainEventHandler
}): ReactElement {
  const isOpen = children !== undefined
  return (
    <Modal isOpen={isOpen} toggle={onClose} className="streamlit-dialog">
      {children}
    </Modal>
  )
}

/**
 * Returns an empty dictionary, indicating that no object is to be displayed.
 */
function noDialog({ onClose }: { onClose: PlainEventHandler }): ReactElement {
  return <BasicDialog onClose={onClose} />
}

interface NotRecognizedProps {
  type: string
  onClose: PlainEventHandler
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

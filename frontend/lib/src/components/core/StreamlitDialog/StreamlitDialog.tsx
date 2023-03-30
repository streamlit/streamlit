/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, ReactNode, CSSProperties } from "react"
import { Kind } from "src/components/shared/Button"
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
} from "src/components/shared/Modal"
import { HotKeys } from "react-hotkeys"

import {
  ScriptChangedDialog,
  ScriptChangedDialogProps,
} from "src/components/core/StreamlitDialog/ScriptChangedDialog"
import { IException } from "src/autogen/proto"
import { SessionInfo } from "src/lib/SessionInfo"
import { STREAMLIT_HOME_URL } from "src/urls"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { SettingsDialogProps, SettingsDialog } from "./SettingsDialog"
import ThemeCreatorDialog, {
  ThemeCreatorDialogProps,
} from "./ThemeCreatorDialog"
import { DeployDialog, DeployDialogProps } from "./DeployDialog"

import {
  StyledRerunHeader,
  StyledCommandLine,
  StyledDeployErrorContent,
  StyledAboutInfo,
} from "./styled-components"

export type PlainEventHandler = () => void

interface SettingsProps extends SettingsDialogProps {
  type: DialogType.SETTINGS
}

interface ScriptChangedProps extends ScriptChangedDialogProps {
  type: DialogType.SCRIPT_CHANGED
}

interface ThemeCreatorProps extends ThemeCreatorDialogProps {
  type: DialogType.THEME_CREATOR
}

export type DialogProps =
  | AboutProps
  | ClearCacheProps
  | RerunScriptProps
  | SettingsProps
  | ScriptChangedProps
  | ScriptCompileErrorProps
  | ThemeCreatorProps
  | WarningProps
  | DeployErrorProps
  | DeployDialogProps

export enum DialogType {
  ABOUT = "about",
  CLEAR_CACHE = "clearCache",
  RERUN_SCRIPT = "rerunScript",
  SETTINGS = "settings",
  SCRIPT_CHANGED = "scriptChanged",
  SCRIPT_COMPILE_ERROR = "scriptCompileError",
  THEME_CREATOR = "themeCreator",
  WARNING = "warning",
  DEPLOY_ERROR = "deployError",
  DEPLOY_DIALOG = "deployDialog",
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
    case DialogType.THEME_CREATOR:
      return <ThemeCreatorDialog {...dialogProps} />
    case DialogType.WARNING:
      return warningDialog(dialogProps)
    case DialogType.DEPLOY_DIALOG:
      return <DeployDialog {...dialogProps} />
    case DialogType.DEPLOY_ERROR:
      return deployErrorDialog(dialogProps)
    case undefined:
      return noDialog(dialogProps)
    default:
      return typeNotRecognizedDialog(dialogProps)
  }
}

interface AboutProps {
  type: DialogType.ABOUT

  sessionInfo: SessionInfo

  /** Callback to close the dialog */
  onClose: PlainEventHandler

  aboutSectionMd?: string | null
}

/** About Dialog */
function aboutDialog(props: AboutProps): ReactElement {
  if (props.aboutSectionMd) {
    const markdownStyle: CSSProperties = {
      overflowY: "auto",
      overflowX: "hidden",
      maxHeight: "35vh",
    }

    // Markdown New line is 2 spaces + \n
    const newLineMarkdown = "  \n"
    const StreamlitInfo = [
      `Made with Streamlit v${props.sessionInfo.current.streamlitVersion}`,
      STREAMLIT_HOME_URL,
      `Copyright ${new Date().getFullYear()} Snowflake Inc. All rights reserved.`,
    ].join(newLineMarkdown)

    const source = `${props.aboutSectionMd} ${newLineMarkdown} ${newLineMarkdown} ${StreamlitInfo}`

    return (
      <Modal isOpen onClose={props.onClose}>
        <ModalHeader>About</ModalHeader>
        <ModalBody>
          <StyledAboutInfo>
            <StreamlitMarkdown
              source={source}
              allowHTML={false}
              style={markdownStyle}
            />
          </StyledAboutInfo>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={Kind.SECONDARY} onClick={props.onClose}>
            Close
          </ModalButton>
        </ModalFooter>
      </Modal>
    )
  }
  return (
    <Modal isOpen onClose={props.onClose}>
      <ModalHeader>Powered by</ModalHeader>
      <ModalBody>
        <div>
          {/* Show our version string only if SessionInfo has been created. If Streamlit
          hasn't yet connected to the server, the SessionInfo singleton will be null. */}
          {props.sessionInfo.isSet && (
            <>
              Streamlit v{props.sessionInfo.current.streamlitVersion}
              <br />
            </>
          )}
          <a href={STREAMLIT_HOME_URL}>{STREAMLIT_HOME_URL}</a>
          <br />
          Copyright {new Date().getFullYear()} Snowflake Inc. All rights
          reserved.
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalButton kind={Kind.SECONDARY} onClick={props.onClose}>
          Close
        </ModalButton>
      </ModalFooter>
    </Modal>
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
      <div data-testid="stClearCacheDialog">
        <Modal isOpen onClose={props.onClose}>
          <ModalHeader>Clear Caches</ModalHeader>
          <ModalBody>
            <div>
              <b>Are you sure you want to clear the app's function caches?</b>
            </div>
            <div>
              This will remove all cached entries from functions using{" "}
              <code>@st.cache</code>, <code>@st.cache_data</code>, and{" "}
              <code>@st.cache_resource</code>.
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalButton kind={Kind.TERTIARY} onClick={props.onClose}>
              Cancel
            </ModalButton>
            <ModalButton
              autoFocus
              kind={Kind.SECONDARY}
              onClick={props.confirmCallback}
            >
              Clear caches
            </ModalButton>
          </ModalFooter>
        </Modal>
      </div>
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
      <Modal isOpen onClose={props.onClose}>
        <ModalBody>
          <StyledRerunHeader>Command line:</StyledRerunHeader>
          <div>
            <StyledCommandLine
              autoFocus
              className="command-line"
              value={props.getCommandLine()}
              onChange={event => props.setCommandLine(event.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={Kind.TERTIARY} onClick={props.onClose}>
            Cancel
          </ModalButton>
          <ModalButton
            kind={Kind.SECONDARY}
            onClick={() => props.rerunCallback()}
          >
            Rerun
          </ModalButton>
        </ModalFooter>
      </Modal>
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
    <Modal isOpen onClose={props.onClose} size="auto">
      <ModalHeader>Script execution error</ModalHeader>
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
        <ModalButton kind={Kind.SECONDARY} onClick={props.onClose}>
          Close
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/**
 * Shows the settings dialog.
 */
function settingsDialog(props: SettingsProps): ReactElement {
  return <SettingsDialog {...props} />
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
    <Modal isOpen onClose={props.onClose}>
      <ModalHeader>{props.title}</ModalHeader>
      <ModalBody>{props.msg}</ModalBody>
      <ModalFooter>
        <ModalButton kind={Kind.SECONDARY} onClick={props.onClose}>
          Done
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

interface DeployErrorProps {
  type: DialogType.DEPLOY_ERROR
  title: string
  msg: ReactNode
  onClose: PlainEventHandler
  onContinue?: PlainEventHandler
  onTryAgain: PlainEventHandler
}

/**
 * Modal used to show deployment errors
 */
function deployErrorDialog({
  title,
  msg,
  onClose,
  onContinue,
  onTryAgain,
}: DeployErrorProps): ReactElement {
  const handlePrimaryButton = (): void => {
    onClose()

    if (onContinue) {
      onContinue()
    }
  }

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>
        <StyledDeployErrorContent>{msg}</StyledDeployErrorContent>
      </ModalBody>
      <ModalFooter>
        <ModalButton kind={Kind.TERTIARY} onClick={onTryAgain}>
          Try again
        </ModalButton>
        <ModalButton kind={Kind.SECONDARY} onClick={handlePrimaryButton}>
          {onContinue ? "Continue anyway" : "Close"}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/**
 * Returns an empty dictionary, indicating that no object is to be displayed.
 */
function noDialog({ onClose }: { onClose: PlainEventHandler }): ReactElement {
  return <Modal isOpen={false} onClose={onClose} />
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
    <Modal isOpen onClose={props.onClose}>
      <ModalBody>{`Dialog type "${props.type}" not recognized.`}</ModalBody>
    </Modal>
  )
}

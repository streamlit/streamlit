/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { CSSProperties, ReactElement, ReactNode } from "react"

import {
  BaseButtonKind,
  IException,
  Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
  SessionInfo,
  StreamlitMarkdown,
} from "@streamlit/lib"
import { STREAMLIT_HOME_URL } from "@streamlit/app/src/urls"
import {
  StyledCode,
  StyledInlineCode,
  StyledPre,
} from "@streamlit/lib/src/components/elements/CodeBlock/styled-components"

import { SettingsDialog, Props as SettingsDialogProps } from "./SettingsDialog"
import ThemeCreatorDialog, {
  Props as ThemeCreatorDialogProps,
} from "./ThemeCreatorDialog"
import { DeployDialog, DeployDialogProps } from "./DeployDialog"
import {
  StyledAboutInfo,
  StyledAboutLink,
  StyledDeployErrorContent,
} from "./styled-components"

export type PlainEventHandler = () => void

interface SettingsProps extends SettingsDialogProps {
  type: DialogType.SETTINGS
}

interface ThemeCreatorProps extends ThemeCreatorDialogProps {
  type: DialogType.THEME_CREATOR
}

export type DialogProps =
  | AboutProps
  | ClearCacheProps
  | SettingsProps
  | ScriptCompileErrorProps
  | ThemeCreatorProps
  | WarningProps
  | DeployErrorProps
  | DeployDialogProps

export enum DialogType {
  ABOUT = "about",
  CLEAR_CACHE = "clearCache",
  SETTINGS = "settings",
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
    case DialogType.SETTINGS:
      return settingsDialog(dialogProps)
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
      </Modal>
    )
  }
  return (
    <Modal isOpen onClose={props.onClose}>
      <ModalHeader>Made with</ModalHeader>
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
          <StyledAboutLink href={STREAMLIT_HOME_URL}>
            {STREAMLIT_HOME_URL}
          </StyledAboutLink>
          <br />
          Copyright {new Date().getFullYear()} Snowflake Inc. All rights
          reserved.
        </div>
      </ModalBody>
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
  return (
    <div data-testid="stClearCacheDialog">
      <Modal isOpen onClose={props.onClose}>
        <ModalHeader>Clear caches</ModalHeader>
        <ModalBody>
          <div>
            <b>Are you sure you want to clear the app's function caches?</b>
          </div>
          <div>
            This will remove all cached entries from functions using{" "}
            <StyledInlineCode>@st.cache_data</StyledInlineCode> and{" "}
            <StyledInlineCode>@st.cache_resource</StyledInlineCode>.
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={BaseButtonKind.TERTIARY} onClick={props.onClose}>
            Cancel
          </ModalButton>
          <ModalButton
            autoFocus
            kind={BaseButtonKind.SECONDARY}
            onClick={props.confirmCallback}
          >
            Clear caches
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
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
    <Modal isOpen onClose={props.onClose} size="auto" autoFocus={false}>
      <ModalHeader>Script execution error</ModalHeader>
      <ModalBody>
        <div>
          <StyledPre>
            <StyledCode>
              {props.exception ? props.exception.message : "No message"}
            </StyledCode>
          </StyledPre>
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalButton kind={BaseButtonKind.SECONDARY} onClick={props.onClose}>
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
        <ModalButton kind={BaseButtonKind.TERTIARY} onClick={onTryAgain}>
          Try again
        </ModalButton>
        <ModalButton
          kind={BaseButtonKind.SECONDARY}
          onClick={handlePrimaryButton}
        >
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

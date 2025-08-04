/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { ReactElement, ReactNode } from "react"

import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import {
  BaseButtonKind,
  Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
  SessionInfo,
  StreamlitMarkdown,
  StreamlitSyntaxHighlighter,
} from "@streamlit/lib"
import { IException } from "@streamlit/protobuf"

import { DeployDialog, DeployDialogProps } from "./DeployDialog"
import { SettingsDialog, Props as SettingsDialogProps } from "./SettingsDialog"
import { StyledDeployErrorContent } from "./styled-components"
import ThemeCreatorDialog, {
  Props as ThemeCreatorDialogProps,
} from "./ThemeCreatorDialog"

export type PlainEventHandler = () => void

interface SettingsProps extends SettingsDialogProps {
  type: DialogType.SETTINGS
  sessionInfo: SessionInfo
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
  | ConnectionErrorProps

export function StreamlitDialog(dialogProps: DialogProps): ReactNode {
  switch (dialogProps.type) {
    case DialogType.ABOUT:
      return <AboutDialog {...dialogProps} />
    case DialogType.CLEAR_CACHE:
      return <ClearCacheDialog {...dialogProps} />
    case DialogType.SETTINGS:
      return <SettingsDialog {...dialogProps} />
    case DialogType.SCRIPT_COMPILE_ERROR:
      return <ScriptCompileErrorDialog {...dialogProps} />
    case DialogType.THEME_CREATOR:
      return <ThemeCreatorDialog {...dialogProps} />
    case DialogType.WARNING:
    case DialogType.CONNECTION_ERROR:
      return <WarningDialog {...dialogProps} />
    case DialogType.DEPLOY_DIALOG:
      return <DeployDialog {...dialogProps} />
    case DialogType.DEPLOY_ERROR:
      return <DeployErrorDialog {...dialogProps} />
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

  aboutSectionMd?: string | null
}

/** About Dialog */
function AboutDialog(props: AboutProps): ReactElement {
  return (
    <Modal isOpen onClose={props.onClose}>
      <ModalHeader>About</ModalHeader>
      <ModalBody>
        {props.aboutSectionMd && (
          <StreamlitMarkdown source={props.aboutSectionMd} allowHTML={false} />
        )}
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
function ClearCacheDialog(props: ClearCacheProps): ReactElement {
  // Markdown New line is 2 spaces + \n
  const newLineMarkdown = "  \n"
  const clearCacheInfo = [
    `**Are you sure you want to clear the app's function caches?**`,
    "This will remove all cached entries from functions using",
    "`@st.cache_data` and `@st.cache_resource`.",
  ].join(newLineMarkdown)

  return (
    <div data-testid="stClearCacheDialog">
      <Modal isOpen onClose={props.onClose}>
        <ModalHeader>Clear caches</ModalHeader>
        <ModalBody>
          <StreamlitMarkdown source={clearCacheInfo} allowHTML={false} />
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={BaseButtonKind.GHOST} onClick={props.onClose}>
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

export interface ScriptCompileErrorProps {
  type: DialogType.SCRIPT_COMPILE_ERROR
  exception: IException | null | undefined
  onClose: PlainEventHandler
}

function ScriptCompileErrorDialog(
  props: ScriptCompileErrorProps
): ReactElement {
  return (
    <Modal isOpen onClose={props.onClose} size="auto" autoFocus={false}>
      <ModalHeader>Script execution error</ModalHeader>
      <ModalBody>
        <StreamlitSyntaxHighlighter showLineNumbers={false} wrapLines={false}>
          {props.exception?.message ? props.exception.message : "No message"}
        </StreamlitSyntaxHighlighter>
      </ModalBody>
      <ModalFooter>
        <ModalButton kind={BaseButtonKind.SECONDARY} onClick={props.onClose}>
          Close
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

interface CommonWarningProps {
  title: string
  msg: ReactNode
  onClose: PlainEventHandler
}

export interface WarningProps extends CommonWarningProps {
  type: DialogType.WARNING
}

export interface ConnectionErrorProps extends CommonWarningProps {
  type: DialogType.CONNECTION_ERROR
}

/**
 * Prints out a warning
 */
function WarningDialog(
  props: WarningProps | ConnectionErrorProps
): ReactElement {
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
function DeployErrorDialog({
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
        <ModalButton kind={BaseButtonKind.GHOST} onClick={onTryAgain}>
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

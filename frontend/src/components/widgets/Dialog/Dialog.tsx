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

import React, { ReactElement, ReactNode, useEffect, useState } from "react"
import Modal, { ModalHeader, ModalBody } from "src/components/shared/Modal"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import {
  shouldDialogBeOpened,
  clearShouldDialogBeOpened,
  shouldDialogBeClosed,
  closeDialog,
} from "src/lib/utils"

export interface State {
  isOpen: boolean
}

export interface Props {
  formId: string
  clearOnSubmit: boolean
  hasSubmitButton: boolean
  scriptRunState: ScriptRunState
  children?: ReactNode
  widgetMgr: WidgetStateManager
  title: string
  closeOnSubmit: boolean
  clearOnClose: boolean
  dismissible: boolean
}

export function Dialog(props: Props): ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  const {
    clearOnSubmit,
    widgetMgr,
    formId,
    children,
    title,
    closeOnSubmit,
    clearOnClose,
    dismissible,
  } = props

  // Tell WidgetStateManager if this dialog form state so that it can
  // do the right thing when the dialog form is submitted.
  useEffect(() => {
    widgetMgr.setFormState(
      formId,
      clearOnSubmit,
      closeOnSubmit,
      clearOnClose,
      setIsOpen
    )
  }, [
    widgetMgr,
    formId,
    clearOnSubmit,
    clearOnClose,
    closeOnSubmit,
    setIsOpen,
  ])

  if (shouldDialogBeOpened(formId)) {
    clearShouldDialogBeOpened(formId)
    setIsOpen(true)
  } else if (shouldDialogBeClosed(formId)) {
    if (clearOnClose) {
      widgetMgr.clearForm(formId)
    }
    closeDialog(formId)
    setIsOpen(false)
  }
  return (
    <Modal
      isOpen={isOpen}
      closeable={dismissible}
      onClose={() => {
        if (clearOnClose) {
          widgetMgr.clearForm(formId)
        }
        closeDialog(formId)
        setIsOpen(false)
      }}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{children}</ModalBody>
    </Modal>
  )
}

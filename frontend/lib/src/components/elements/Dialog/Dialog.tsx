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

import React, {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"

import { Block as BlockProto } from "@streamlit/protobuf"

import IsDialogContext from "~lib/components/core/IsDialogContext"
import Modal, { ModalBody, ModalHeader } from "~lib/components/shared/Modal"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { assertNever } from "~lib/util/assertNever"
import { notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledDialogTitle } from "./styled-components"

/**
 * Maps the dialog width to the modal size.
 * @param dialogWidth - The dialog width from the proto.
 * @returns The modal size.
 */
function mapDialogWidthToModalSize(
  dialogWidth: BlockProto.Dialog.DialogWidth
): "default" | "medium" | "large" {
  switch (dialogWidth) {
    case BlockProto.Dialog.DialogWidth.MEDIUM:
      return "medium"
    case BlockProto.Dialog.DialogWidth.LARGE:
      return "large"
    case BlockProto.Dialog.DialogWidth.SMALL:
      return "default"
    default: {
      // Ensure exhaustive checking if new enum values are added
      assertNever(dialogWidth)
      return "default"
    }
  }
}

export interface Props {
  element: BlockProto.Dialog
  deltaMsgReceivedAt?: number
  widgetMgr: WidgetStateManager
  fragmentId: string | undefined
}

const Dialog: React.FC<React.PropsWithChildren<Props>> = ({
  element,
  deltaMsgReceivedAt,
  children,
  widgetMgr,
  fragmentId,
}): ReactElement => {
  const { title, dismissible, width, isOpen: initialIsOpen, id } = element
  const [isOpen, setIsOpen] = useState<boolean>(false)

  useEffect(() => {
    // Only apply the open state if it was actually set in the proto.
    if (notNullOrUndefined(initialIsOpen)) {
      setIsOpen(initialIsOpen)
    }

    // when the deltaMsgReceivedAt changes, we might want to open the dialog again.
    // since dismissing is a UI-only action, the initialIsOpen prop might not have
    // changed which would lead to the dialog not opening again.
  }, [initialIsOpen, deltaMsgReceivedAt])

  // Handle dialog dismiss with widget event
  const handleClose = useCallback(() => {
    setIsOpen(false)

    // Send widget event if on_dismiss is activated (indicated by presence of id)
    if (id && widgetMgr) {
      void widgetMgr.setTriggerValue(
        { id, formId: "" }, // WidgetInfo object - dialogs are not compatible with forms
        { fromUi: true },
        fragmentId
      )
    }
  }, [id, widgetMgr, fragmentId])

  // Handler to suppress the R key when dialog is open and non-dismissible
  // Otherwise, R would allow to dismiss the dialog by rerunning the script.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (isOpen && e.key.toLowerCase() === "r" && !element.dismissible) {
        const target = e.target as HTMLElement

        // We don't want to prevent typing in input fields.
        // This is the same check that is also done by react-hot-keys.
        if (
          target &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          return
        }

        // Prevent the R key from bubbling up to the App level
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [isOpen, element.dismissible]
  )

  // Set up keyboard event listener when dialog is open
  useEffect(() => {
    if (isOpen && !element.dismissible) {
      // Add event listener with capture=true to intercept before App level
      document.addEventListener("keydown", handleKeyDown, true)

      return () => {
        document.removeEventListener("keydown", handleKeyDown, true)
      }
    }
  }, [isOpen, element.dismissible, handleKeyDown])

  // don't use the Modal's isOpen prop as it feels laggy when using it
  if (!isOpen) {
    return <></>
  }
  return (
    <Modal
      isOpen
      closeable={dismissible}
      onClose={handleClose}
      size={mapDialogWidthToModalSize(width)}
    >
      <ModalHeader>
        <StyledDialogTitle>
          <StreamlitMarkdown
            source={title}
            allowHTML={false}
            isLabel
            inheritFont
          />
        </StyledDialogTitle>
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
    </Modal>
  )
}

function DialogWithProvider(
  props: React.PropsWithChildren<Props>
): ReactElement {
  return (
    <IsDialogContext.Provider value={true}>
      <Dialog {...props} />
    </IsDialogContext.Provider>
  )
}

export default memo(DialogWithProvider)

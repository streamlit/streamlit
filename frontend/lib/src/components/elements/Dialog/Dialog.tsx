/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, useCallback, useEffect, useState } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"

import IsDialogContext from "~lib/components/core/IsDialogContext"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import Modal, {
  ModalBody,
  ModalHeader,
} from "~lib/components/shared/Modal/Modal"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { assertNever } from "~lib/util/assertNever"
import { notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledDialogIcon, StyledDialogTitle } from "./styled-components"

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

/**
 * Maps the dialog position proto enum to Modal placement.
 * Match CENTER explicitly: it is 0, so a truthy check would treat centered dialogs as unset.
 * Treat a missing value as center so payloads that omit the enum still render.
 */
function mapDialogPositionToModalPosition(
  dialogPosition: BlockProto.Dialog.DialogPosition | undefined
): "left" | "center" | "right" {
  switch (dialogPosition) {
    case BlockProto.Dialog.DialogPosition.LEFT:
      return "left"
    case BlockProto.Dialog.DialogPosition.RIGHT:
      return "right"
    case BlockProto.Dialog.DialogPosition.CENTER:
    case undefined:
      return "center"
    default: {
      assertNever(dialogPosition)
      return "center"
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
  const {
    title,
    dismissible,
    width,
    isOpen: initialIsOpen,
    id,
    icon,
    position,
  } = element
  // Open on the first paint when the proto says so. Starting closed and
  // flipping in an effect delayed the drawer by a frame, so the fully-rendered
  // panel popped in with no chance to play the enter animation.
  const [isOpen, setIsOpen] = useState<boolean>(() => Boolean(initialIsOpen))

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
      // Dialogs are not compatible with forms.
      void widgetMgr.setTriggerValue(id, {
        formId: "",
        fragmentId,
        fromUser: true,
      })
    }
  }, [id, widgetMgr, fragmentId])

  // Suppress R while a non-dismissible dialog is open so the app-level
  // shortcut cannot rerun (and close) the dialog. Capture-phase keydown
  // must stopImmediatePropagation so GlobalHotkeys never sees the event.
  const handleRKeySuppress = useCallback(
    (e: KeyboardEvent): void => {
      if (isOpen && e.key.toLowerCase() === "r" && !element.dismissible) {
        const target = e.target as HTMLElement

        // Allow typing R in inputs, textareas, and contenteditable fields.
        if (
          target &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          return
        }

        e.preventDefault()
        e.stopImmediatePropagation()
      }
    },
    [isOpen, element.dismissible]
  )

  // Set up keyboard event listeners when dialog is open
  useEffect(() => {
    if (isOpen && !element.dismissible) {
      // capture=true to intercept before App-level hotkeys
      document.addEventListener("keydown", handleRKeySuppress, true)

      return () => {
        document.removeEventListener("keydown", handleRKeySuppress, true)
      }
    }
    return undefined
  }, [isOpen, element.dismissible, handleRKeySuppress])

  // Unmount when closed so dismiss is immediate. Drawer enter motion is CSS
  // on mount (`data-entering`); an exit animation would need the overlay to
  // stay mounted after close.
  if (!isOpen) {
    return <></>
  }
  return (
    <Modal
      isOpen
      closeable={dismissible}
      onClose={handleClose}
      size={mapDialogWidthToModalSize(width)}
      position={mapDialogPositionToModalPosition(position)}
    >
      <ModalHeader>
        <StyledDialogTitle>
          {icon && (
            <StyledDialogIcon data-testid="stDialogIcon">
              <DynamicIcon iconValue={icon} size="lg" />
            </StyledDialogIcon>
          )}
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

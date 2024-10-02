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

import React, { ReactElement, useEffect, useState } from "react"

import Modal, {
  ModalBody,
  ModalHeader,
} from "@streamlit/lib/src/components/shared/Modal"
import { Block as BlockProto } from "@streamlit/lib/src/proto"
import IsDialogContext from "@streamlit/lib/src/components/core/IsDialogContext"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"

import { StyledDialogContent } from "./styled-components"

export interface Props {
  element: BlockProto.Dialog
  deltaMsgReceivedAt?: number
}

const Dialog: React.FC<React.PropsWithChildren<Props>> = ({
  element,
  deltaMsgReceivedAt,
  children,
}): ReactElement => {
  const { title, dismissible, width, isOpen: initialIsOpen } = element
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

  // don't use the Modal's isOpen prop as it feels laggy when using it
  if (!isOpen) {
    return <></>
  }

  return (
    <Modal
      isOpen
      closeable={dismissible}
      onClose={() => setIsOpen(false)}
      size={width === BlockProto.Dialog.DialogWidth.LARGE ? "full" : "default"}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>
        <StyledDialogContent>{children}</StyledDialogContent>
      </ModalBody>
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

export default DialogWithProvider

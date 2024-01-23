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

import React, { ReactElement, ReactNode, useEffect, useState } from "react"
import Modal, {
  ModalHeader,
  ModalBody,
} from "@streamlit/lib/src/components/shared/Modal"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"
import { Block as BlockProto } from "@streamlit/lib/src/proto"

export interface Props {
  element: BlockProto.Dialog
  children?: ReactNode
}

const Dialog: React.FC<Props> = ({ element, children }): ReactElement => {
  const { title, dismissible, isOpen: initialIsOpen } = element

  const [isOpen, setIsOpen] = useState<boolean>(initialIsOpen || false)
  console.log(isOpen, initialIsOpen)
  useEffect(() => {
    // Only apply the expanded state if it was actually set in the proto.
    if (notNullOrUndefined(initialIsOpen)) {
      setIsOpen(initialIsOpen)
    }
  }, [initialIsOpen])

  return (
    <Modal
      isOpen={isOpen}
      closeable={dismissible}
      onClose={() => setIsOpen(false)}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{children}</ModalBody>
    </Modal>
  )
}

export default Dialog

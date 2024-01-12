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

import React, {
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"
import Modal, {
  ModalHeader,
  ModalBody,
} from "@streamlit/lib/src/components/shared/Modal"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"

export interface Props {
  children?: ReactNode
  title?: string
  dismissible?: boolean
  isOpen?: boolean
}

export function DialogNonForm(props: Props): ReactElement {
  const { children, title, dismissible, isOpen: initialIsOpen } = props
  const [isOpen, setIsOpen] = useState<boolean>(initialIsOpen || false)
  //   const [isReset, setIsReset] = useState<boolean>(false)
  const isReset = useRef<boolean>(false)

  console.log(props, isOpen)

  useEffect(() => {
    // Only apply the expanded state if it was actually set in the proto.
    if (notNullOrUndefined(initialIsOpen)) {
      setIsOpen(initialIsOpen)

      // We manage the open attribute via the detailsRef and not with React state
      //   if (detailsRef.current) {
      //     detailsRef.current.open = initialExpanded
      //   }
    }

    // Having `label` in the dependency array here is necessary because
    // sometimes two distinct expanders look so similar that even the react
    // diffing algorithm decides that they're the same element with updated
    // props (this happens when something in the app removes one expander and
    // replaces it with another in the same position).
    //
    // By adding `label` as a dependency, we ensure that we reset the
    // expander's `expanded` state in this edge case.
  }, [initialIsOpen])

  //   useEffect(() => {
  //     setIsOpen(true)
  //     // setIsReset(false)
  //   }, [isReset])

  return (
    <Modal
      isOpen={isOpen}
      closeable={dismissible}
      onClose={() => {
        setIsOpen(false)
        // isReset.current = true
        // TODO: do we have to inform the python-side about the closure?
      }}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{children}</ModalBody>
    </Modal>
  )
}

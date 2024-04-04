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

import React, { ReactElement, useEffect, useMemo, useState } from "react"
import { useTheme } from "@emotion/react"
import { SIZE } from "baseui/modal"

import { EmotionTheme } from "@streamlit/lib/src/theme"
import Modal, {
  ModalHeader,
  ModalBody,
} from "@streamlit/lib/src/components/shared/Modal"
import { Block as BlockProto } from "@streamlit/lib/src/proto"
import IsDialogContext from "@streamlit/lib/src/components/core/IsDialogContext"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"

import { StyledDialogContent } from "./styled-components"

export interface Props {
  element: BlockProto.Dialog
}

function parseWidthConfig(
  width: BlockProto.Dialog.DialogWidth,
  theme: EmotionTheme
): string {
  if (width === BlockProto.Dialog.DialogWidth.LARGE) {
    // this is the same width including padding as the AppView container is using for all inner elements
    // the padding is added to the ModalBody and subtracted from the total width here
    // As of writing this: total width=752px (47rem), padding left and right each=24px (1.5rem) => content width = 704px
    return `calc(${theme.sizes.contentMaxWidth} + 2*${theme.spacing.sm})`
  }

  return SIZE.default
}

const Dialog: React.FC<React.PropsWithChildren<Props>> = ({
  element,
  children,
}): ReactElement => {
  const { title, dismissible, width, isOpen: initialIsOpen } = element
  const [isOpen, setIsOpen] = useState<boolean>(false)

  useEffect(() => {
    // Only apply the open state if it was actually set in the proto.
    if (notNullOrUndefined(initialIsOpen)) {
      setIsOpen(initialIsOpen)
    }
  }, [initialIsOpen])

  const theme = useTheme()
  const size: string = useMemo(
    () =>
      parseWidthConfig(width ?? BlockProto.Dialog.DialogWidth.SMALL, theme),
    [width, theme]
  )

  return (
    <Modal
      isOpen={isOpen}
      closeable={dismissible}
      onClose={() => setIsOpen(false)}
      size={size}
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

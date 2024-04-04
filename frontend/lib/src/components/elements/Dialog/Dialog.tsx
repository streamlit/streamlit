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
    // This is the same width including padding as the AppView container is using for all inner elements.
    // As of writing this, the AppView container content has a width of 704px, which is 736px (46rem = contentMaxWidth) - 2*16px padding.
    // The dialog has a total padding left and right of 48px. This means, for the content to have the same 704px width inside of the dialog, the total dialog widht has to be 704px + 48px = 752px (= 47rem).
    // We don't use 47rem directly but rather use the existing paddings to make the intention of how this relates to the non-dialog app content more comprehendable.
    // Note that a Modal has a max-width:100% set, so it looks good on mobile independent of the calculated size here.
    const paddingDifferenceDialogAndAppView = theme.spacing.lg // the dialog has 0.5rem more padding left and right => 1rem
    return `calc(${theme.sizes.contentMaxWidth} + ${paddingDifferenceDialogAndAppView})`
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

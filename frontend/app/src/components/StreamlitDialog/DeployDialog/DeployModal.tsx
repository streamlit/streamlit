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

import { ModalBody as UIModalBody } from "baseui/modal"
import { CloseSource } from "baseui/modal/types"

import { Modal, ModalHeader, useEmotionTheme } from "@streamlit/lib"

interface IDeployModalProps {
  children: React.ReactNode
  onClose: (a: { closeSource?: CloseSource }) => unknown
}

export interface ModalBodyProps {
  children: ReactNode
}

function ModalBody({ children }: Readonly<ModalBodyProps>): ReactElement {
  const { colors, fontSizes, spacing } = useEmotionTheme()

  return (
    <UIModalBody
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.md,
        paddingRight: spacing.none,
        paddingBottom: spacing.none,
        paddingLeft: spacing.none,
        color: colors.bodyText,
        fontSize: fontSizes.md,
        overflowY: "auto",
      }}
    >
      {children}
    </UIModalBody>
  )
}

function DeployModal(
  props: React.PropsWithChildren<IDeployModalProps>
): ReactElement {
  const { children, onClose } = props
  return (
    <Modal isOpen={true} closeable={true} onClose={onClose} size="auto">
      <ModalHeader>Deploy this app using...</ModalHeader>
      <ModalBody>{children}</ModalBody>
    </Modal>
  )
}

export default DeployModal

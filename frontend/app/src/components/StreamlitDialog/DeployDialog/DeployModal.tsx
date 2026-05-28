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

import { ReactElement, ReactNode } from "react"

import styled from "@emotion/styled"

import { Modal, ModalHeader } from "@streamlit/lib"

interface IDeployModalProps {
  children: React.ReactNode
  onClose: () => void
}

interface ModalBodyProps {
  children: ReactNode
}

const StyledDeployModalBody = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.md,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.md,
  overflowY: "auto",
}))

function ModalBody({ children }: Readonly<ModalBodyProps>): ReactElement {
  return <StyledDeployModalBody>{children}</StyledDeployModalBody>
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

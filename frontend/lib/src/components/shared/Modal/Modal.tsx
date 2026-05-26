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

import { FunctionComponent, ReactElement, ReactNode } from "react"

import BaseButton, {
  BaseButtonProps,
} from "~lib/components/shared/BaseButton/BaseButton"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import {
  StyledDialogClose,
  StyledDialogInner,
  StyledDialogOverlay,
  StyledDialogPanel,
  StyledModalBody,
  StyledModalButton,
  StyledModalFooter,
  StyledModalHeader,
} from "./styled-components"

interface ModalHeaderProps {
  children: ReactNode
}

function ModalHeader({ children }: Readonly<ModalHeaderProps>): ReactElement {
  return <StyledModalHeader slot="title">{children}</StyledModalHeader>
}

interface ModalBodyProps {
  children: ReactNode
}

function ModalBody({ children }: Readonly<ModalBodyProps>): ReactElement {
  return <StyledModalBody>{children}</StyledModalBody>
}

interface ModalFooterProps {
  children: ReactNode
}

function ModalFooter({ children }: Readonly<ModalFooterProps>): ReactElement {
  return <StyledModalFooter>{children}</StyledModalFooter>
}

const ModalButton: FunctionComponent<
  React.PropsWithChildren<BaseButtonProps>
> = buttonProps => (
  <StyledModalButton>
    <BaseButton {...buttonProps} />
  </StyledModalButton>
)

interface StreamlitModalProps {
  isOpen?: boolean
  onClose?: () => void
  /** Controls backdrop click, Escape key, and close button visibility. Defaults to true. */
  closeable?: boolean
  size?: "auto" | "default" | "medium" | "large"
  /** Explicit CSS width override, takes precedence over size. Used for non-standard widths like "80vw". */
  width?: string
  children?: ReactNode
}

/**
 * Maps the StreamlitModal size to a CSS width string.
 *
 * @param size the modal size variant
 * @param width the content max width used for the 'medium' size calculation
 * @param padding extra horizontal padding added for the 'medium' size
 * @param largeWidth the explicit CSS width for 'large' size
 * @returns a CSS width string, or undefined for auto (content-sized)
 */
export function calculateModalSize(
  size: StreamlitModalProps["size"],
  width?: string,
  padding?: string,
  largeWidth?: string
): string | undefined {
  if (size === "large" && largeWidth) {
    return largeWidth
  }
  if (size === "medium" && width && padding) {
    // Same width as the AppView container (contentMaxWidth) plus the extra dialog padding.
    // The dialog has 0.5rem more left/right padding than AppView, adding 1rem total.
    // Note: max-width:100% keeps this responsive on mobile regardless of the calculated value.
    return `calc(${width} + ${padding})`
  }
  if (size === "auto") {
    return undefined
  }
  // Default: 31.25rem (= 500px at 16px base)
  // rem is used so the dialog scales with the user's browser font-size preference.
  return "31.25rem"
}

function Modal({
  isOpen,
  onClose,
  closeable = true,
  size,
  width,
  children,
}: Readonly<StreamlitModalProps>): ReactElement {
  const { sizes, spacing } = useEmotionTheme()
  const dialogWidth = calculateModalSize(
    size,
    sizes.contentMaxWidth,
    spacing.lg,
    sizes.dialogLargeWidth
  )

  const handleOpenChange = (open: boolean): void => {
    if (!open) onClose?.()
  }

  return (
    <StyledDialogOverlay
      isOpen={isOpen ?? false}
      isDismissable={closeable}
      isKeyboardDismissDisabled={!closeable}
      onOpenChange={handleOpenChange}
      className="stDialog"
      data-testid="stDialog"
    >
      <StyledDialogPanel $dialogWidth={width ?? dialogWidth}>
        <StyledDialogInner>
          {({ close }) => (
            <>
              {closeable && (
                <StyledDialogClose
                  aria-label="Close"
                  type="button"
                  onClick={close}
                >
                  <svg
                    aria-hidden="true"
                    height="10"
                    viewBox="0 0 10 10"
                    width="10"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 1L5 5M1 9L5 5M5 5L1 1M5 5L9 9"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                </StyledDialogClose>
              )}
              {children}
            </>
          )}
        </StyledDialogInner>
      </StyledDialogPanel>
    </StyledDialogOverlay>
  )
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }

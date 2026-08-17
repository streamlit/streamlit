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

import { memo, useCallback, useEffect, useRef, useState } from "react"

import { FloatingFocusManager, FloatingPortal } from "@floating-ui/react"
import { ChromePicker, ColorResult } from "react-color"
import SaturationComponent from "react-color/es/components/common/Saturation"

import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { convertRemToPx } from "~lib/theme/utils"
import { LabelVisibilityOptions } from "~lib/util/utils"

import {
  StyledChromePicker,
  StyledColorBlock,
  StyledColorPicker,
  StyledColorPickerPopover,
  StyledColorPreview,
  StyledColorValue,
} from "./styled-components"

/* When closing the color picker popover, react-color triggers a security error
 * if the app is in an iframe with a different origin. That security error shows up as
 * an exception within the app and stops the app from working. This isn't a problem on
 * Community Cloud anymore (because it uses same origin) but it can be in an
 * embedded app or in Notebooks. We're applying this fix here to prevent that:
 * https://github.com/uiwjs/react-color/issues/81#issuecomment-2208219820
 */
/* istanbul ignore next -- browser-only: traverses window.parent chain for cross-origin iframes, untestable in jsdom */
SaturationComponent.prototype.getContainerRenderWindow = function () {
  const container = this.container
  let renderWindow: Window & typeof globalThis = window
  let lastRenderWindow: Window & typeof globalThis = window

  try {
    while (
      !renderWindow.document.contains(container) &&
      renderWindow.parent !== renderWindow
    ) {
      lastRenderWindow = renderWindow
      renderWindow = renderWindow.parent as Window & typeof globalThis
    }
  } catch {
    renderWindow = lastRenderWindow
  }
  return renderWindow
}

export interface BaseColorPickerProps {
  disabled: boolean
  width?: number
  value: string
  showValue?: boolean
  label: string
  labelVisibility?: LabelVisibilityOptions
  onChange: (value: string) => void
  help?: string
}

const BaseColorPicker = (props: BaseColorPickerProps): React.ReactElement => {
  const {
    disabled,
    value: propValue,
    showValue,
    label,
    labelVisibility,
    onChange,
    help,
  } = props
  const [value, setValue] = useState(propValue)
  const [isOpen, setIsOpen] = useState(false)
  // Timestamp guard: prevents the same click that opens the popover from
  // immediately triggering the outside-click handler.
  const openedAtRef = useRef(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  // Set to true when a Tab keydown is detected so the accompanying focusin
  // event knows to check whether focus left the popover.
  const tabbingRef = useRef(false)
  // Keep a ref to the latest draft value so onColorClose stays stable and
  // does not cause the dismissal useEffect to re-register document listeners
  // on every color drag update.
  const valueRef = useRef(value)
  valueRef.current = value

  const theme = useEmotionTheme()
  useExecuteWhenChanged(() => setValue(propValue), [propValue])

  const {
    refs: { setFloating, setReference },
    floatingStyles,
    context: floatingContext,
  } = useFloatingOverlay({
    open: isOpen,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
  })

  // Note: This is a "local" onChange handler used to update the color preview
  // (allowing the user to click and drag). this.props.onChange is only called
  // when the ColorPicker popover is closed.
  const onColorChange = useCallback((color: ColorResult): void => {
    setValue(color.hex)
  }, [])

  const onColorClose = useCallback((): void => {
    onChange(valueRef.current)
  }, [onChange])

  const handleToggle = useCallback((): void => {
    if (disabled) return
    if (isOpen) {
      setIsOpen(false)
      onColorClose()
    } else {
      openedAtRef.current = Date.now()
      setIsOpen(true)
    }
  }, [disabled, isOpen, onColorClose])

  // Custom dismissal via document-level DOM listeners.
  //
  // The popover is portalled to document.body, so we implement outside-click,
  // Escape, and Tab-out dismissal ourselves.
  //
  // We use `click` (not `pointerdown`) so that a focused input inside the
  // popover fires its blur/change handlers before we close, ensuring the
  // color value is committed before the popover disappears.
  useEffect(() => {
    if (!isOpen) return

    const handleClick = (e: MouseEvent): void => {
      // In test environments (JSDOM), act() flushes useEffect synchronously,
      // so this listener can be live during the same click that opened the
      // popover. The timestamp guard prevents that click from closing it.
      if (Date.now() - openedAtRef.current < 50) return
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false)
        onColorClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setIsOpen(false)
        onColorClose()
        triggerRef.current?.focus()
      } else if (e.key === "Tab") {
        // Mark that a Tab is in flight. The focusin listener fires next,
        // after focus has moved, so it can check whether the destination is
        // inside or outside the popover and only close in the latter case.
        tabbingRef.current = true
      }
    }

    // focusin fires on the element that just received focus, i.e. after the
    // Tab key has already moved focus. Checking e.target here correctly
    // distinguishes Tab-between-inputs-within-the-popover (no-op) from
    // Tab-out-of-the-popover (close + commit).
    const handleFocusIn = (e: FocusEvent): void => {
      if (!tabbingRef.current) return
      tabbingRef.current = false
      if (!popoverRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
        onColorClose()
      }
    }

    document.addEventListener("click", handleClick)
    document.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("focusin", handleFocusIn)
    return () => {
      document.removeEventListener("click", handleClick)
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("focusin", handleFocusIn)
    }
  }, [isOpen, onColorClose])

  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null): void => {
      setFloating(node)
      ;(popoverRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node
    },
    [setFloating]
  )

  const setReferenceRef = useCallback(
    (node: HTMLButtonElement | null): void => {
      setReference(node)
      ;(
        triggerRef as React.MutableRefObject<HTMLButtonElement | null>
      ).current = node
    },
    [setReference]
  )

  const customChromePickerStyles = {
    default: {
      picker: {
        borderRadius: theme.radii.default,
        // Remove the box shadow from the color picker component since we're already
        // applying a shadow to the popover that contains the color picker.
        boxShadow: "none",
        backgroundColor: theme.colors.bgColor,
      },
      saturation: {
        borderRadius: `${theme.radii.default} ${theme.radii.default} 0 0`,
        // Prevent text selection while the mouse is clicked to select a color. This
        // can be annoying if you select a color and then move the mouse outside the
        // color picker.
        // We need the `as const` here to prevent a typing error (even though it
        // also works correctly without it).
        userSelect: "none" as const,
      },
      body: {
        padding: theme.spacing.xl,
      },
    },
  }

  return (
    <StyledColorPicker
      className="stColorPicker"
      data-testid="stColorPicker"
      disabled={disabled}
    >
      <WidgetLabel
        label={label}
        disabled={disabled}
        labelVisibility={labelVisibility}
      >
        {help && (
          <WidgetLabelHelpIconInline
            content={help}
            placement={Placement.TOP_RIGHT}
            label={label}
          />
        )}
      </WidgetLabel>
      <StyledColorPreview
        ref={setReferenceRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-label={`${label} color picker`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <StyledColorBlock
          data-testid="stColorPickerBlock"
          backgroundColor={value}
          disabled={disabled}
        />
        {showValue && (
          <StyledColorValue>{value.toUpperCase()}</StyledColorValue>
        )}
      </StyledColorPreview>
      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager
            context={floatingContext}
            modal={false}
            closeOnFocusOut={false}
          >
            <StyledColorPickerPopover
              ref={setFloatingRef}
              style={floatingStyles}
              role="dialog"
              aria-label={`${label} color picker`}
            >
              <StyledChromePicker data-testid="stColorPickerPopover">
                <ChromePicker
                  color={value}
                  onChange={onColorChange}
                  disableAlpha={true}
                  styles={customChromePickerStyles}
                />
              </StyledChromePicker>
            </StyledColorPickerPopover>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </StyledColorPicker>
  )
}

export default memo(BaseColorPicker)

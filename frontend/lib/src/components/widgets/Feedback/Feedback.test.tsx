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

import { screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Feedback as FeedbackProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Feedback, { Props } from "./Feedback"

const getProps = (
  elementProps: Partial<FeedbackProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: FeedbackProto.create({
    id: "feedback-1",
    type: FeedbackProto.FeedbackType.THUMBS,
    disabled: false,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  widthConfig: {
    useContent: true,
  },
  ...widgetProps,
})

const getFeedbackButtons = (): HTMLElement[] => {
  const feedbackWidget = screen.getByTestId("stFeedback")
  return within(feedbackWidget).getAllByRole("radio")
}

describe("Feedback widget", () => {
  describe("Rendering", () => {
    it("renders without crashing", () => {
      const props = getProps()
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      expect(feedbackWidget).toBeInTheDocument()
      expect(feedbackWidget).toHaveClass("stFeedback")
    })

    it("renders thumbs feedback type with 2 buttons", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      expect(buttons).toHaveLength(2)
    })

    it("renders faces feedback type with 5 buttons", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.FACES,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      expect(buttons).toHaveLength(5)
    })

    it("renders stars feedback type with 5 buttons", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.STARS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      expect(buttons).toHaveLength(5)
    })

    it("renders icons for each button", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      buttons.forEach(button => {
        const icon = within(button).getByTestId("stIconMaterial")
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe("Selection behavior", () => {
    it("sets widget value on mount with default value", () => {
      const props = getProps({ default: 1 })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)
      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "1",
        { fromUi: false },
        undefined
      )
    })

    it("sets widget value on mount with empty string when no default", () => {
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)
      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "",
        { fromUi: false },
        undefined
      )
    })

    it("selects an option when clicked", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Click thumbs up (first button, value 1)
      await user.click(buttons[0])

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "1",
        { fromUi: true },
        undefined
      )
    })

    it("deselects an option when clicked again (toggle)", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
        default: 1,
      })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Click thumbs up again to deselect
      await user.click(buttons[0])

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "",
        { fromUi: true },
        undefined
      )
    })

    it("switches selection when clicking different option", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
        default: 1,
      })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Click thumbs down (second button, value 0)
      await user.click(buttons[1])

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "0",
        { fromUi: true },
        undefined
      )
    })

    it("passes fragmentId to widgetMgr", async () => {
      const user = userEvent.setup()
      const props = getProps({}, { fragmentId: "myFragmentId" })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "",
        { fromUi: false },
        "myFragmentId"
      )

      const buttons = getFeedbackButtons()
      await user.click(buttons[0])
      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "1",
        { fromUi: true },
        "myFragmentId"
      )
    })
  })

  describe("Stars visualization", () => {
    it("shows all stars up to selected as filled", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.STARS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Click the 3rd star (index 2, value 2)
      await user.click(buttons[2])

      // Refetch buttons after state update
      const updatedButtons = getFeedbackButtons()
      // Stars 0, 1, 2 should be active (data-testid="stFeedbackButtonActive")
      expect(updatedButtons[0]).toHaveAttribute(
        "data-testid",
        "stFeedbackButtonActive"
      )
      expect(updatedButtons[1]).toHaveAttribute(
        "data-testid",
        "stFeedbackButtonActive"
      )
      expect(updatedButtons[2]).toHaveAttribute(
        "data-testid",
        "stFeedbackButtonActive"
      )
      // Stars 3, 4 should not be active
      expect(updatedButtons[3]).toHaveAttribute(
        "data-testid",
        "stFeedbackButton"
      )
      expect(updatedButtons[4]).toHaveAttribute(
        "data-testid",
        "stFeedbackButton"
      )
    })

    it("shows correct number of filled stars based on selection", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.STARS,
        default: 4, // Select all 5 stars
      })
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      const activeButtons = within(feedbackWidget).getAllByTestId(
        "stFeedbackButtonActive"
      )
      // All 5 buttons should be active
      expect(activeButtons).toHaveLength(5)
    })
  })

  describe("Faces and thumbs visualization", () => {
    it("shows only the selected face as active", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.FACES,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Click the neutral face (index 2, value 2)
      await user.click(buttons[2])

      const feedbackWidget = screen.getByTestId("stFeedback")
      const activeButtons = within(feedbackWidget).getAllByTestId(
        "stFeedbackButtonActive"
      )
      // Only 1 button should be active
      expect(activeButtons).toHaveLength(1)
    })

    it("shows only the selected thumb as active", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Click thumbs up
      await user.click(buttons[0])

      const feedbackWidget = screen.getByTestId("stFeedback")
      const activeButtons = within(feedbackWidget).getAllByTestId(
        "stFeedbackButtonActive"
      )
      // Only 1 button should be active
      expect(activeButtons).toHaveLength(1)
    })
  })

  describe("Disabled state", () => {
    it("renders buttons as disabled when widget is disabled", () => {
      const props = getProps({}, { disabled: true })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it("prevents interaction when disabled", async () => {
      const user = userEvent.setup()
      const props = getProps({}, { disabled: true })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      await user.click(buttons[0])

      // Should only have been called once on mount, not on click
      expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    })

    it("renders buttons as disabled when element disabled prop is true", () => {
      // Note: The component uses both props.disabled and element.disabled
      // When element.disabled is true, it's OR'd with props.disabled
      const props = getProps({ disabled: true }, { disabled: true })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it("shows default selection when disabled", () => {
      // Regression test: disabled feedback with default should show selection
      const props = getProps(
        { default: 2, type: FeedbackProto.FeedbackType.STARS },
        { disabled: true }
      )
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      // Should have called setStringValue with the default value
      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "2",
        { fromUi: false },
        undefined
      )

      // The first 3 buttons (0, 1, 2) should be shown as selected (filled stars)
      const buttons = getFeedbackButtons()
      expect(buttons[0]).toHaveAttribute(
        "data-testid",
        "stFeedbackButtonActive"
      )
      expect(buttons[1]).toHaveAttribute(
        "data-testid",
        "stFeedbackButtonActive"
      )
      expect(buttons[2]).toHaveAttribute(
        "data-testid",
        "stFeedbackButtonActive"
      )
      // Buttons 3 and 4 should NOT be selected
      expect(buttons[3]).toHaveAttribute("data-testid", "stFeedbackButton")
      expect(buttons[4]).toHaveAttribute("data-testid", "stFeedbackButton")
    })
  })

  describe("Keyboard navigation", () => {
    it("allows arrow key navigation between buttons", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Focus the first button
      buttons[0].focus()
      expect(buttons[0]).toHaveFocus()

      // Press right arrow to move to next button
      await user.keyboard("{ArrowRight}")
      expect(buttons[1]).toHaveFocus()

      // Press left arrow to move back
      await user.keyboard("{ArrowLeft}")
      expect(buttons[0]).toHaveFocus()
    })

    it("wraps around when navigating past the last button", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Focus the last button
      buttons[1].focus()
      expect(buttons[1]).toHaveFocus()

      // Press right arrow to wrap to first button
      await user.keyboard("{ArrowRight}")
      expect(buttons[0]).toHaveFocus()
    })

    it("wraps around when navigating before the first button", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Focus the first button
      buttons[0].focus()
      expect(buttons[0]).toHaveFocus()

      // Press left arrow to wrap to last button
      await user.keyboard("{ArrowLeft}")
      expect(buttons[1]).toHaveFocus()
    })

    it("selects option with Enter key", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      buttons[0].focus()
      await user.keyboard("{Enter}")

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "1",
        { fromUi: true },
        undefined
      )
    })

    it("selects option with Space key", async () => {
      const user = userEvent.setup()
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      vi.spyOn(props.widgetMgr, "setStringValue")

      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      buttons[0].focus()
      await user.keyboard(" ")

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element,
        "1",
        { fromUi: true },
        undefined
      )
    })
  })

  describe("Accessibility", () => {
    it("has radiogroup role on container", () => {
      const props = getProps()
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      const radioGroup = within(feedbackWidget).getByRole("radiogroup")
      expect(radioGroup).toBeInTheDocument()
    })

    it("has radio role on buttons", () => {
      const props = getProps()
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      buttons.forEach(button => {
        expect(button).toHaveAttribute("role", "radio")
      })
    })

    it("has aria-checked attribute on buttons", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
        default: 1,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Thumbs up (value 1) should be checked
      expect(buttons[0]).toHaveAttribute("aria-checked", "true")
      // Thumbs down (value 0) should not be checked
      expect(buttons[1]).toHaveAttribute("aria-checked", "false")
    })

    it("has aria-label on buttons for thumbs", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      expect(buttons[0]).toHaveAttribute("aria-label", "Thumbs up")
      expect(buttons[1]).toHaveAttribute("aria-label", "Thumbs down")
    })

    it("has aria-label on buttons for faces", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.FACES,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      expect(buttons[0]).toHaveAttribute("aria-label", "Very dissatisfied")
      expect(buttons[1]).toHaveAttribute("aria-label", "Dissatisfied")
      expect(buttons[2]).toHaveAttribute("aria-label", "Neutral")
      expect(buttons[3]).toHaveAttribute("aria-label", "Satisfied")
      expect(buttons[4]).toHaveAttribute("aria-label", "Very satisfied")
    })

    it("has aria-label on buttons for stars", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.STARS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      expect(buttons[0]).toHaveAttribute("aria-label", "1 out of 5 stars")
      expect(buttons[1]).toHaveAttribute("aria-label", "2 out of 5 stars")
      expect(buttons[2]).toHaveAttribute("aria-label", "3 out of 5 stars")
      expect(buttons[3]).toHaveAttribute("aria-label", "4 out of 5 stars")
      expect(buttons[4]).toHaveAttribute("aria-label", "5 out of 5 stars")
    })

    it("has aria-label on radiogroup", () => {
      const props = getProps()
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      const radioGroup = within(feedbackWidget).getByRole("radiogroup")
      expect(radioGroup).toHaveAttribute("aria-label", "Feedback rating")
    })

    it("manages tabIndex correctly for roving focus", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
        default: 1,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // Selected button should have tabIndex 0
      expect(buttons[0]).toHaveAttribute("tabIndex", "0")
      // Other buttons should have tabIndex -1
      expect(buttons[1]).toHaveAttribute("tabIndex", "-1")
    })

    it("first button has tabIndex 0 when nothing is selected", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
      })
      render(<Feedback {...props} />)

      const buttons = getFeedbackButtons()
      // First button should have tabIndex 0 when nothing selected
      expect(buttons[0]).toHaveAttribute("tabIndex", "0")
      expect(buttons[1]).toHaveAttribute("tabIndex", "-1")
    })
  })

  describe("Width configuration", () => {
    it("renders with content width when configured", () => {
      const props = getProps(
        {},
        {
          widthConfig: { useContent: true },
        }
      )
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      expect(feedbackWidget).toHaveStyle("width: auto")
    })

    it("renders with stretch width when configured", () => {
      const props = getProps(
        {},
        {
          widthConfig: { useStretch: true },
        }
      )
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      expect(feedbackWidget).toHaveStyle("width: 100%")
    })
  })

  describe("Widget state updates", () => {
    it("updates display when value is set from proto", () => {
      const props = getProps({
        type: FeedbackProto.FeedbackType.THUMBS,
        value: 0,
        setValue: true,
      })
      render(<Feedback {...props} />)

      const feedbackWidget = screen.getByTestId("stFeedback")
      const activeButtons = within(feedbackWidget).getAllByTestId(
        "stFeedbackButtonActive"
      )
      // Thumbs down (value 0) should be selected
      expect(activeButtons).toHaveLength(1)
    })
  })
})

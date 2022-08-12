import React from "react"
import { Kind } from "src/components/shared/AlertContainer"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { Form, Props } from "./Form"

describe("Form", () => {
  function getProps(props: Partial<Props> = {}): Props {
    return {
      formId: "mockFormId",
      width: 100,
      hasSubmitButton: false,
      scriptRunState: ScriptRunState.RUNNING,
      clearOnSubmit: false,
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: jest.fn(),
        formsDataChanged: jest.fn(),
      }),
      ...props,
    }
  }

  it("shows error if !hasSubmitButton && scriptRunState==NOT_RUNNING", () => {
    const props = getProps({
      hasSubmitButton: false,
      scriptRunState: ScriptRunState.RUNNING,
    })
    const wrapper = shallow(<Form {...props} />)

    // We have no Submit Button, but the app is still running
    expect(wrapper.find("Alert").exists()).toBeFalsy()

    // When the app stops running, we show an error if the submit button
    // is still missing.
    wrapper.setProps({ scriptRunState: ScriptRunState.NOT_RUNNING })

    expect(wrapper.find("Alert").exists()).toBeTruthy()
    expect(wrapper.find("Alert").prop("kind")).toBe(Kind.ERROR)
    expect(wrapper.find("Alert").prop("body")).toContain(
      "Missing Submit Button"
    )

    // If the app restarts, we continue to show the error...
    wrapper.setProps({ scriptRunState: ScriptRunState.RUNNING })
    expect(wrapper.find("Alert").exists()).toBeTruthy()

    // Until we get a submit button, and the error is removed immediately,
    // regardless of ScriptRunState.
    wrapper.setProps({ hasSubmitButton: true })
    expect(wrapper.find("Alert").exists()).toBeFalsy()
  })
})

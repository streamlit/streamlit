import React, { Fragment } from "react"
import { mount } from "src/lib/test_util"
import { StreamlitDialog, DialogType } from "./StreamlitDialog"

function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

describe("StreamlitDialog", () => {
  it("renders clear cache dialog and focuses clear cache button", async () => {
    const wrapper = mount(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          defaultAction: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    // Flush promises to give componentDidMount() a chance to run.
    await flushPromises()

    setTimeout(() => {
      expect(
        wrapper
          .find("button")
          .at(1)
          .is(":focus")
      ).toBe(true)
    }, 0)
  })
})

import React from "react"
import { BaseProvider, LightTheme } from "baseui"

import { mount } from "src/lib/test_util"
import Modal from "./Modal"

describe("Modal component", () => {
  it("renders without crashing", () => {
    mount(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen />
      </BaseProvider>
    )
  })
})

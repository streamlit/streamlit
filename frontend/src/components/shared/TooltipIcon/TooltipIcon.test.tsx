import React from "react"
import { mount } from "enzyme"
import ThemeProvider from "src/components/core/ThemeProvider"
import { lightTheme, lightBaseUITheme } from "src/theme"
import TooltipIcon from "./TooltipIcon"

describe("TooltipIcon element", () => {
  it("renders a TooltipIcon", () => {
    const wrapper = mount(
      <ThemeProvider theme={lightTheme.emotion} baseuiTheme={lightBaseUITheme}>
        <TooltipIcon content="" />
      </ThemeProvider>
    )
    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })
})

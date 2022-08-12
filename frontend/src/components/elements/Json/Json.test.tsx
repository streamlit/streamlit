import React from "react"
import { mount } from "src/lib/test_util"
import { Json as JsonProto } from "src/autogen/proto"
import ThemeProvider from "src/components/core/ThemeProvider"
import { darkTheme, darkBaseUITheme } from "src/theme"
import Json, { JsonProps } from "./Json"

const getProps = (elementProps: Partial<JsonProto> = {}): JsonProps => ({
  element: JsonProto.create({
    body:
      '{ "proper": [1,2,3],' +
      '  "nested": { "thing1": "cat", "thing2": "hat" },' +
      '  "json": "structure" }',
    ...elementProps,
  }),
  width: 100,
})

describe("JSON element", () => {
  it("renders json as expected", () => {
    const props = getProps()
    const wrapper = mount(<Json {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("should show an error with invalid JSON", () => {
    const props = getProps({ body: "invalid JSON" })
    const wrapper = mount(<Json {...props} />)
    expect(wrapper.find("Alert")).toBeDefined()
  })

  it("renders json with NaN and infinity values", () => {
    const props = getProps({
      body: `{
      "numbers":[ -1e27, NaN, Infinity, -Infinity, 2.2822022,-2.2702775],
    }`,
    })
    const wrapper = mount(<Json {...props} />)
    expect(wrapper).toBeDefined()
  })

  it("picks a reasonable theme when the background is light", () => {
    const props = getProps()
    const wrapper = mount(<Json {...props} />)

    expect(wrapper.find('[theme="rjv-default"]').exists()).toBeTruthy()
    expect(wrapper.find('[theme="monokai"]').exists()).toBeFalsy()
  })

  it("picks a reasonable theme when the background is dark", () => {
    const props = getProps()
    const wrapper = mount(
      <ThemeProvider theme={darkTheme.emotion} baseuiTheme={darkBaseUITheme}>
        <Json {...props} />
      </ThemeProvider>
    )

    expect(wrapper.find('[theme="rjv-default"]').exists()).toBeFalsy()
    expect(wrapper.find('[theme="monokai"]').exists()).toBeTruthy()
  })
})

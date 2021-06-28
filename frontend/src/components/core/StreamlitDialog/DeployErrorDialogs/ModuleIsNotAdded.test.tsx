import ModuleIsNotAdded from "./ModuleIsNotAdded"

describe("DeployErrorDialog - ModuleIsNotAdded", () => {
  it("should render without crashing", () => {
    const dialog = ModuleIsNotAdded("module")

    expect(dialog).toMatchSnapshot()
  })
})

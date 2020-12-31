import ModuleIsNotAdded from "./ModuleIsNotAdded"

describe("DeployErrorDialog - ModuleIsNotAdded", () => {
  it("Should render without crashing", () => {
    const dialog = ModuleIsNotAdded("module")

    expect(dialog).toMatchSnapshot()
  })
})

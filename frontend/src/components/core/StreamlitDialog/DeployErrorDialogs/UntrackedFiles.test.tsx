import UntrackedFiles from "./UntrackedFiles"

describe("DeployErrorDialog - UntrackedFiles", () => {
  it("Should render without crashing", () => {
    const dialog = UntrackedFiles()

    expect(dialog).toMatchSnapshot()
  })
})

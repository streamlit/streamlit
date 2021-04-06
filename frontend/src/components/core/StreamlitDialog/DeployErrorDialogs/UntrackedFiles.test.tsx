import UntrackedFiles from "./UntrackedFiles"

describe("DeployErrorDialog - UntrackedFiles", () => {
  it("should render without crashing", () => {
    const dialog = UntrackedFiles()

    expect(dialog).toMatchSnapshot()
  })
})

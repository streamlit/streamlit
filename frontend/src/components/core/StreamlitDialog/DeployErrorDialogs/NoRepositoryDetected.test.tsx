import NoRepositoryDetected from "./NoRepositoryDetected"

describe("DeployErrorDialog - NoRepositoryDetected", () => {
  it("Should render without crashing", () => {
    const dialog = NoRepositoryDetected()

    expect(dialog).toMatchSnapshot()
  })
})

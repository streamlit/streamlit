import NoRepositoryDetected from "./NoRepositoryDetected"

describe("DeployErrorDialog - NoRepositoryDetected", () => {
  it("should render without crashing", () => {
    const dialog = NoRepositoryDetected()

    expect(dialog).toMatchSnapshot()
  })
})

import RepoIsAhead from "./RepoIsAhead"

describe("DeployErrorDialog - RepoIsAhead", () => {
  it("Should render without crashing", () => {
    const dialog = RepoIsAhead()

    expect(dialog).toMatchSnapshot()
  })
})

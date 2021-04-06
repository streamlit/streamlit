import RepoIsAhead from "./RepoIsAhead"

describe("DeployErrorDialog - RepoIsAhead", () => {
  it("should render without crashing", () => {
    const dialog = RepoIsAhead()

    expect(dialog).toMatchSnapshot()
  })
})

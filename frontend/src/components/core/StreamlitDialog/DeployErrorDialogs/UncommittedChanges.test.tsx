import UncommittedChanges from "./UncommittedChanges"

describe("DeployErrorDialog - RepoIsAhead", () => {
  it("should render without crashing", () => {
    const dialog = UncommittedChanges("user/reponame")

    expect(dialog).toMatchSnapshot()
  })
})

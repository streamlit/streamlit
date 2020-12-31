import DetachedHead from "./DetachedHead"

describe("DeployErrorDialog - DetachedHead", () => {
  it("Should render without crashing", () => {
    const dialog = DetachedHead()

    expect(dialog).toMatchSnapshot()
  })
})

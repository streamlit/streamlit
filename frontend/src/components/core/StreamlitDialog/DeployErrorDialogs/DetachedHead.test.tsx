import DetachedHead from "./DetachedHead"

describe("DeployErrorDialog - DetachedHead", () => {
  it("should render without crashing", () => {
    const dialog = DetachedHead()

    expect(dialog).toMatchSnapshot()
  })
})

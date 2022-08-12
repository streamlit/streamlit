import { useIsOverflowing } from "./Hooks"

const stateSetters: Array<any> = []

jest.mock("react", () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual("react"),
  useEffect: jest.fn().mockImplementation(cb => cb()),
  useState: jest.fn().mockImplementation(() => {
    const setValue = jest.fn()
    stateSetters.push(setValue)

    return [false, setValue]
  }),
}))

// NOTE: We can't test the return value of useIsOverflowing directly because
// it won't have changed in a single run of the function. This is why we just
// check that the state setter was called.
describe("useIsOverflowing", () => {
  it("sets state to true if the element is overflowing", () => {
    const ref = { current: { scrollHeight: 1, clientHeight: 0 } }
    // @ts-ignore
    useIsOverflowing(ref)

    const setIsOverflowing = stateSetters.pop()
    expect(setIsOverflowing).toHaveBeenCalledWith(true)
  })

  it("sets state to false if the element is not overflowing", () => {
    const ref = { current: { scrollHeight: 1, clientHeight: 1 } }
    // @ts-ignore
    useIsOverflowing(ref)

    const setIsOverflowing = stateSetters.pop()
    expect(setIsOverflowing).toHaveBeenCalledWith(false)
  })
})

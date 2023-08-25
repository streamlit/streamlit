/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { customRenderLibContext, render } from "@streamlit/lib/src/test_util"
import { mockSessionInfo } from "@streamlit/lib/src/mocks/mocks"

import withMapboxToken, {
  MapboxTokenFetchingError,
  TOKENS_URL,
  WrappedMapboxProps,
} from "./withMapboxToken"
import axios from "axios"
import { screen, waitFor } from "@testing-library/react"

interface TestProps {
  label: string
  width: number
  mapboxToken: string
}

describe("withMapboxToken", () => {
  const token = "mockToken"

  function getProps(
    overrideProps?: Partial<WrappedMapboxProps<TestProps>>
  ): WrappedMapboxProps<TestProps> {
    return {
      label: "mockLabel",
      width: 123,
      sessionInfo: mockSessionInfo({ userMapboxToken: token }),
      ...overrideProps,
    }
  }

  jest.mock("axios")

  const MockComponent = (props: {
    mapboxToken: string | undefined
  }): ReactElement => (
    <div data-testid="mock-component">{props.mapboxToken}</div>
  )

  describe("withMapboxToken rendering", () => {
    const DeltaType = "testDeltaType"
    const WrappedComponent = withMapboxToken(DeltaType)(MockComponent)

    beforeEach(() => {
      jest.resetAllMocks()
    })

    it("renders without crashing", async () => {
      const props = getProps()
      customRenderLibContext(<WrappedComponent {...props} />, {})
      const alertElement = await screen.findByTestId("AlertElement")
      expect(alertElement).not.toBeNull()
    })

    it("defines `displayName`", () => {
      expect(WrappedComponent.displayName).toEqual(
        "withMapboxToken(MockComponent)"
      )
    })

    it("should inject mapbox token to the wrapped component when available", async () => {
      const mockedToken = "mockToken"
      axios.get = jest
        .fn()
        .mockImplementation(() => ({ data: { userMapboxToken: mockedToken } }))

      render(
        <WrappedComponent
          sessionInfo={mockSessionInfo({ userMapboxToken: mockedToken })}
          width={500}
        />
      )

      await waitFor(() => {
        const element = screen.getByTestId("mock-component")
        expect(element.textContent).toBe(mockedToken)
      })
    })

    it("should render loading alert while fetching the token", async () => {
      render(<WrappedComponent sessionInfo={mockSessionInfo()} width={500} />)

      const loadingTextElement = await screen.findByText("Loading...")
      expect(loadingTextElement).toBeDefined()
    })

    it("should fetch the token if userMapboxToken is present in the LibContext", async () => {
      const fetchedToken = "fetchedToken"
      const HOST_CONFIG_TOKEN = "HOST_CONFIG_TOKEN"
      axios.get = jest
        .fn()
        .mockResolvedValue({ data: { mapbox: fetchedToken } })

      customRenderLibContext(
        <WrappedComponent
          sessionInfo={mockSessionInfo({
            userMapboxToken: "",
          })}
          width={500}
        />,
        { hostConfig: { mapboxToken: HOST_CONFIG_TOKEN } }
      )

      await waitFor(() => {
        const element = screen.getByTestId("mock-component")
        expect(element.textContent).toBe(HOST_CONFIG_TOKEN)
      })
    })

    describe("withMapboxToken methods", () => {
      describe("getMapboxToken", () => {
        const userToken = "userToken"
        it("should return userMapboxToken if present in sessionInfo", async () => {
          let wrappedComponentInstance: any

          render(
            <WrappedComponent
              ref={ref => {
                wrappedComponentInstance = ref
              }}
              sessionInfo={mockSessionInfo({
                userMapboxToken: userToken,
              })}
              width={500}
            />
          )
          expect(
            await wrappedComponentInstance.getMapboxToken(
              mockSessionInfo({
                userMapboxToken: userToken,
              })
            )
          ).toBe(userToken)
        })

        it("should fetch the token if userMapboxToken is not present in sessionInfo", async () => {
          const fetchedToken = "fetchedToken"
          axios.get = jest
            .fn()
            .mockResolvedValue({ data: { mapbox: fetchedToken } })

          render(
            <WrappedComponent
              sessionInfo={mockSessionInfo({
                userMapboxToken: "",
              })}
              width={500}
            />
          )

          await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(TOKENS_URL)
          })
        })

        it("should throw an error if fetched token is not present", async () => {
          let wrappedComponentInstance: any
          axios.get = jest.fn().mockResolvedValue({ data: {} })

          render(
            <WrappedComponent
              ref={ref => {
                wrappedComponentInstance = ref
              }}
              sessionInfo={mockSessionInfo({
                userMapboxToken: userToken,
              })}
              width={500}
            />
          )

          await expect(
            wrappedComponentInstance.getMapboxToken(
              mockSessionInfo({
                userMapboxToken: "",
              })
            )
          ).rejects.toThrowError(
            new MapboxTokenFetchingError(
              `Missing token mapbox (${TOKENS_URL})`
            )
          )
        })
      })
    })
  })
})

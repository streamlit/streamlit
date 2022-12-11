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

describe("st.map", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    Cypress.Cookies.defaults({
      preserve: ["_xsrf"]
    });
  });

  it("loads the main streamlit_app script on with static image", () => {
    cy.get("img").should("exist");
  });


  it("serves existing static file", () => {
    cy.request('http://localhost:8501/app/static/dogdog.jpeg').then((response) => {
      expect(response.status).to.eq(200)
      expect(response).to.have.property('headers')
    })
  });

  it("serves non-existing static file", () => {
    cy.request(
      {
        url: 'http://localhost:8501/app/static/notexisting.jpeg',
        failOnStatusCode: false
      }).its('status').should('equal', 404)
  });
});

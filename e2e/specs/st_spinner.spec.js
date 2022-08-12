describe("st.spinner", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a message", () => {
    cy.get(".stButton > button").click(); // click button to trigger spinner execution
    cy.get(".element-container .stSpinner").should("contain", "Loading...");
  });
});

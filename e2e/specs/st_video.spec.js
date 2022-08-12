describe("st.video", () => {
  before(() => {
    // Increasing timeout since we're requesting an external video file
    Cypress.config("defaultCommandTimeout", 10000);
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a video player", () => {
    cy.get(".element-container .stVideo").should("have.attr", "src");
  });
});

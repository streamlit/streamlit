describe("browser.config", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("main menu is hidden", () => {
    // click button to set hideMainMenu config option to true
    cy.get(".stButton > button")
      .contains("hide main menu")
      .click();
    cy.get(".MainMenu").should("not.exist");
  });

  it("main menu is shown", () => {
    // click button to set hideMainMenu config option to false
    cy.get(".stButton > button")
      .contains("show main menu")
      .click();
    cy.get(".MainMenu").should("exist");
  });
});

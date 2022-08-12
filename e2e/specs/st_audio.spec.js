describe("st.audio", () => {
  before(() => {
    // Increasing timeout since we're requesting an external audio file
    Cypress.config("defaultCommandTimeout", 10000);
    cy.loadApp("http://localhost:3000/");
  });

  it("displays an audio player", () => {
    cy.get(".element-container .stAudio");
  });

  it("has controls", () => {
    cy.get(".element-container .stAudio").should("have.attr", "controls");
  });

  it("has src", () => {
    cy.get(".element-container .stAudio").should("have.attr", "src");
  });

  it("has audio", () => {
    cy.get(".element-container .stAudio")
      .should("have.prop", "tagName")
      .and("eq", "AUDIO");
  });
});

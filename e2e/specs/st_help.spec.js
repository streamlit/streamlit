describe("st.help", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("matches the snapshot", () => {
    cy.get(
      ".element-container [data-testid='stDocstring']"
    ).matchThemedSnapshots("help");
  });
});

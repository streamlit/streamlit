describe("st.error and friends", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("matches the snapshot", () => {
    cy.get(".main [data-testid='stHorizontalBlock']").matchThemedSnapshots(
      "empty_labels"
    );
  });
});

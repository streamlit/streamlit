describe("st.columns layout", () => {
  it("shows columns horizontally when viewport > 640", () => {
    cy.viewport(641, 800);
    cy.loadApp("http://localhost:3000/");

    cy.get("[data-testid='stHorizontalBlock']")
      .first()
      .matchImageSnapshot("columns-layout-horizontal");
  });

  it("stacks columns vertically when viewport <= 640", () => {
    cy.viewport(640, 800);
    cy.loadApp("http://localhost:3000/");

    cy.getIndexed("[data-testid='stHorizontalBlock']", 0).matchImageSnapshot(
      "columns-layout-vertical"
    );
  });

  it("still takes up space with no elements present", () => {
    cy.getIndexed("[data-testid='stHorizontalBlock']", 1).matchImageSnapshot(
      "columns-with-one-element"
    );
  });
});

const expanderHeaderIdentifier = ".streamlit-expanderHeader";

describe("st.expander", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays expander + regular containers properly", () => {
    cy.getIndexed(".main [data-testid='stExpander']", 0).within(() => {
      cy.get(expanderHeaderIdentifier).should("exist");
    });
    cy.getIndexed(".main [data-testid='stExpander']", 1).within(() => {
      cy.get(expanderHeaderIdentifier).should("exist");
    });

    cy.getIndexed(
      "[data-testid='stSidebar'] [data-testid='stExpander']",
      0
    ).within(() => {
      cy.get(expanderHeaderIdentifier).should("exist");
    });
  });

  it("displays correctly", () => {
    // Focus the button, then ensure it's not cut off
    // See https://github.com/streamlit/streamlit/issues/2437
    cy.get(".stButton button").focus();
    cy.get(".main").matchThemedSnapshots("expanders-in-main");
    cy.get("[data-testid='stSidebar']").matchThemedSnapshots(
      "expanders-in-sidebar"
    );
  });

  it("collapses + expands", () => {
    // Starts expanded
    cy.getIndexed(".main [data-testid='stExpander']", 0).within(() => {
      const expanderHeader = cy.get(expanderHeaderIdentifier);
      expanderHeader.should("exist");

      let toggle = cy.get("svg");
      toggle.should("exist");
      expanderHeader.click();

      toggle = cy.get("svg");
      toggle.should("exist");
    });

    // Starts collapsed
    cy.getIndexed(".main [data-testid='stExpander']", 1).within(() => {
      let expanderHeader = cy.get(expanderHeaderIdentifier);
      expanderHeader.should("exist");

      let toggle = cy.get("svg");
      toggle.should("exist");
      expanderHeader.click();

      toggle = cy.get("svg");
      toggle.should("exist");
    });
  });
});

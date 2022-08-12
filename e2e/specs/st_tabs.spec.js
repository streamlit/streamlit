describe("st.tabs", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays correctly", () => {
    cy.get(".stTabs").should("have.length", 3);

    cy.get(".stTabs").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("tabs" + idx);
    });
  });

  it("displays correctly in sidebar", () => {
    cy.get("[data-testid='stSidebar'] .stTabs [data-baseweb='tab']").should(
      "have.length",
      2
    );

    cy.get("[data-testid='stSidebar'] .stTabs").first()
      .within(() => {
        cy.get(".stMarkdown").first().should("have.text", "I am in the sidebar");
      });

    // text from every tab should be here because renderAll property is set to true
    cy.get("[data-testid='stSidebar'] .stTabs")
      .first()
      .within(() => {
        cy.get(".stMarkdown").should("have.text", "I am in the sidebarI'm also in the sidebar");
      });
  });

  it("changes rendered content on tab selection", () => {
    cy.getIndexed(".main .stTabs", 0).within(() => {
      let tab_2_button = cy.getIndexed("[data-baseweb='tab']", 1);
      tab_2_button.should("exist");
      tab_2_button.click();

      cy.get("[data-baseweb='tab-panel'] .stNumberInput").should(
        "have.length",
        1
      );
    });
  });

  it("contains all tabs when overflowing", () => {
    cy.get("[data-testid='stExpander'] .stTabs [data-baseweb='tab']").should(
      "have.length",
      25
    );
  });
});

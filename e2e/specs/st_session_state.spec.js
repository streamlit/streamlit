describe("st.session_state", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("has correct starting values", () => {
    cy.get(".stMarkdown").contains("item_counter: 0");
    cy.get(".stMarkdown").contains("attr_counter: 0");
    // item_counter + attr_counter + initialized flag
    cy.get(".stMarkdown").contains("len(st.session_state): 3");
    cy.get("[data-testid='stJson']").should("be.visible");
  });

  it("can get/set/delete session_state items", () => {
    cy.get(".stMarkdown").contains("item_counter: 0");
    cy.get(".stMarkdown").contains("attr_counter: 0");

    cy.get(".stButton button")
      .contains("inc_item_counter")
      .click();
    cy.get(".stMarkdown").contains("item_counter: 1");
    cy.get(".stMarkdown").contains("attr_counter: 0");

    cy.get(".stButton button")
      .contains("inc_item_counter")
      .click();
    cy.get(".stMarkdown").contains("item_counter: 2");
    cy.get(".stMarkdown").contains("attr_counter: 0");

    cy.get(".stButton button")
      .contains("del_item_counter")
      .click();
    cy.get(".stMarkdown")
      .contains("item_counter:")
      .should("not.exist");
    cy.get(".stMarkdown").contains("attr_counter: 0");
    cy.get(".stMarkdown").contains("len(st.session_state): 2");
  });

  it("can get/set/delete session_state attrs", () => {
    cy.get(".stMarkdown").contains("item_counter: 0");
    cy.get(".stMarkdown").contains("attr_counter: 0");

    cy.get(".stButton button")
      .contains("inc_attr_counter")
      .click();
    cy.get(".stMarkdown").contains("item_counter: 0");
    cy.get(".stMarkdown").contains("attr_counter: 1");

    cy.get(".stButton button")
      .contains("inc_attr_counter")
      .click();
    cy.get(".stMarkdown").contains("item_counter: 0");
    cy.get(".stMarkdown").contains("attr_counter: 2");

    cy.get(".stButton button")
      .contains("del_attr_counter")
      .click();
    cy.get(".stMarkdown").contains("item_counter: 0");
    cy.get(".stMarkdown")
      .contains("attr_counter:")
      .should("not.exist");
    cy.get(".stMarkdown").contains("len(st.session_state): 2");
  });
});

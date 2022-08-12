/**
 * Tests global hotkeys in App.tsx. (It would be great to test these in an
 * `App.test.tsx` Enzyme test without needing Cypress, but simulating keypresses
 * in Enzyme has turned into an exercise in madness.)
 */
describe("app hotkeys", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
    // Wait for an element to exist
    cy.get(".stTextInput").should("exist");
  });

  it("shows the Clear Cache dialog when 'C' is pressed", () => {
    cy.get("body").type("c");
    cy.get("[data-testid='stClearCacheDialog']").should("exist");
  });

  const modifierKeys = ["ctrl", "cmd"];
  modifierKeys.forEach(modifier => {
    it(`does NOT show Clear Cache when ${modifier}-C is pressed`, () => {
      cy.get("body").type(`{${modifier}}c`);
      cy.get("[data-testid='stClearCacheDialog']").should("not.exist");
    });
  });

  it("does NOT show Clear Cache dialog when 'C' is pressed inside text_input", () => {
    cy.get(".stTextInput").type("c");
    cy.get("[data-testid='stClearCacheDialog']").should("not.exist");
    cy.get(".stTextInput input")
      .invoke("val")
      .should("eq", "c");
  });

  it("reruns when 'R' is pressed", () => {
    // Wait until we're not running
    cy.get("[data-testid='stStatusWidget']").should("not.exist");
    cy.get("body").type("r");
    cy.get("[data-testid='stStatusWidget']").should("contain", "Running...");
  });

  it("does NOT rerun when 'R' is pressed inside text_input", () => {
    // Wait until we're not running
    cy.get("[data-testid='stStatusWidget']").should("not.exist");
    cy.get(".stTextInput").type("r");
    cy.get(".stTextInput input")
      .invoke("val")
      .should("eq", "r");
  });
});

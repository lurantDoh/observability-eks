const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateTotals, buildInvoice } = require("../lib/cart");

describe("calculateTotals", () => {
  it("sums selected items and applies tax", () => {
    const totals = calculateTotals([
      { id: "sku-tee", qty: 2 },
      { id: "sku-mug", qty: 1 },
    ]);
    assert.equal(totals.subtotal, 64.5);
    assert.equal(totals.tax, 5.16);
    assert.equal(totals.total, 69.66);
  });

  it("rejects empty carts", () => {
    assert.throws(() => calculateTotals([]), /at least one item/);
  });
});

describe("buildInvoice", () => {
  it("creates an invoice payload with logo path", () => {
    const totals = calculateTotals([{ id: "sku-stickers", qty: 3 }]);
    const invoice = buildInvoice({
      companyName: "Demo Co",
      customer: { name: "Ada", email: "ada@example.com" },
      totals,
      logoPath: "/assets/logo.jpg",
    });
    assert.match(invoice.invoiceNumber, /^INV-/);
    assert.equal(invoice.logoPath, "/assets/logo.jpg");
    assert.equal(invoice.total, 25.92);
  });
});

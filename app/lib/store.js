/** In-memory invoice + PDF store (single-replica friendly). */
const invoices = new Map();

function saveInvoice(invoice, pdfBuffer) {
  invoices.set(invoice.invoiceNumber, {
    invoice,
    pdfBuffer,
    createdAt: Date.now(),
  });
  return invoice.invoiceNumber;
}

function getInvoice(invoiceNumber) {
  return invoices.get(invoiceNumber) || null;
}

module.exports = { saveInvoice, getInvoice };

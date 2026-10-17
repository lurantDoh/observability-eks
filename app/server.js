const express = require("express");
const path = require("path");
const client = require("prom-client");
const { PRODUCTS, calculateTotals, buildInvoice } = require("./lib/cart");
const { buildInvoicePdf, defaultLogoPath } = require("./lib/invoicePdf");
const { saveInvoice, getInvoice } = require("./lib/store");

const app = express();
const PORT = process.env.PORT || 3000;
const COMPANY_NAME = process.env.COMPANY_NAME || "ExcelCloud Market";

const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpRequests = new client.Counter({
  name: "ecommerce_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});
const invoicesCreated = new client.Counter({
  name: "ecommerce_invoices_created_total",
  help: "Total invoices created",
  registers: [register],
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    httpRequests.inc({
      method: req.method,
      route,
      status: String(res.statusCode),
    });
  });
  next();
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/readyz", (_req, res) => {
  res.status(200).json({ status: "ready" });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/api/products", (_req, res) => {
  res.json({ company: COMPANY_NAME, products: PRODUCTS });
});

app.post("/api/checkout", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const customer = {
    name: String(req.body?.customerName || "Guest").trim() || "Guest",
    email: String(req.body?.customerEmail || "").trim(),
  };

  try {
    const totals = calculateTotals(items);
    const invoice = buildInvoice({
      companyName: COMPANY_NAME,
      customer,
      totals,
      logoPath: "/assets/logo.jpg",
    });

    const pdfBuffer = await buildInvoicePdf(invoice, defaultLogoPath());
    saveInvoice(invoice, pdfBuffer);
    invoicesCreated.inc();

    return res.status(201).json({
      ...invoice,
      pdfUrl: `/api/invoices/${encodeURIComponent(invoice.invoiceNumber)}/pdf`,
    });
  } catch (err) {
    console.error("Checkout failed:", err);
    return res.status(400).json({ error: err.message || "Invalid cart" });
  }
});

app.get("/api/invoices/:invoiceNumber/pdf", (req, res) => {
  const record = getInvoice(req.params.invoiceNumber);
  if (!record) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  const filename = `${record.invoice.invoiceNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", record.pdfBuffer.length);
  return res.status(200).send(record.pdfBuffer);
});

app.listen(PORT, () => {
  console.log(`Ecommerce app listening on :${PORT}`);
});

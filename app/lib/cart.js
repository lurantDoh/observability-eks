const PRODUCTS = [
  {
    id: "sku-tee",
    name: "Cloud Ops Tee",
    price: 24.0,
    category: "Apparel",
    image: "/assets/products/tee.svg",
    description: "Soft cotton tee for on-call nights.",
  },
  {
    id: "sku-mug",
    name: "SRE Coffee Mug",
    price: 16.5,
    category: "Merch",
    image: "/assets/products/mug.svg",
    description: "12oz ceramic mug for incident fuel.",
  },
  {
    id: "sku-stickers",
    name: "Kubernetes Sticker Pack",
    price: 8.0,
    category: "Merch",
    image: "/assets/products/stickers.svg",
    description: "Laptop-ready cloud-native stickers.",
  },
  {
    id: "sku-hoodie",
    name: "Observability Hoodie",
    price: 58.0,
    category: "Apparel",
    image: "/assets/products/hoodie.svg",
    description: "Warm fleece for late deploy windows.",
  },
  {
    id: "sku-course",
    name: "Helm & GitOps Workshop",
    price: 149.0,
    category: "Training",
    image: "/assets/products/course.svg",
    description: "Hands-on Argo CD and Helm labs.",
  },
  {
    id: "sku-monitor",
    name: "Prometheus Desk Mat",
    price: 32.0,
    category: "Merch",
    image: "/assets/products/deskmat.svg",
    description: "Wide desk mat with metric motifs.",
  },
];

const TAX_RATE = 0.08;

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function calculateTotals(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Cart must include at least one item");
  }

  const lineItems = [];
  for (const entry of rawItems) {
    const product = getProduct(entry.id);
    const qty = Number(entry.qty);
    if (!product) {
      throw new Error(`Unknown product: ${entry.id}`);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error(`Invalid quantity for ${product.name}`);
    }
    const lineTotal = Number((product.price * qty).toFixed(2));
    lineItems.push({
      id: product.id,
      name: product.name,
      unitPrice: product.price,
      qty,
      lineTotal,
      image: product.image,
    });
  }

  const subtotal = Number(lineItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return { lineItems, subtotal, tax, taxRate: TAX_RATE, total };
}

function buildInvoice({ companyName, customer, totals, logoPath }) {
  const now = new Date();
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;

  return {
    invoiceNumber,
    issuedAt: now.toISOString(),
    companyName,
    logoPath,
    customer,
    currency: "USD",
    ...totals,
  };
}

module.exports = { PRODUCTS, TAX_RATE, calculateTotals, buildInvoice, getProduct };

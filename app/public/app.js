const state = {
  products: [],
  cart: new Map(),
  currentInvoice: null,
  emailEnabled: false,
};

const els = {
  companyName: document.getElementById("company-name"),
  productGrid: document.getElementById("product-grid"),
  cartLines: document.getElementById("cart-lines"),
  subtotal: document.getElementById("subtotal"),
  tax: document.getElementById("tax"),
  total: document.getElementById("total"),
  checkoutBtn: document.getElementById("checkout-btn"),
  checkoutForm: document.getElementById("checkout-form"),
  status: document.getElementById("status"),
  dialog: document.getElementById("invoice-dialog"),
  invoice: document.getElementById("invoice"),
  downloadBtn: document.getElementById("download-invoice"),
  emailBtn: document.getElementById("email-invoice"),
  closeBtn: document.getElementById("close-invoice"),
  customerEmail: document.getElementById("customer-email"),
};

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function cartItems() {
  return [...state.cart.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty }));
}

function setQty(id, qty) {
  if (qty <= 0) state.cart.delete(id);
  else state.cart.set(id, qty);
  renderCart();
}

function renderProducts() {
  els.productGrid.innerHTML = state.products
    .map((p) => {
      const qty = state.cart.get(p.id) || 0;
      return `
        <article class="product" data-id="${p.id}">
          <div>
            <h3>${p.name}</h3>
            <p class="meta">${p.category} · <span class="price">${money(p.price)}</span></p>
          </div>
          <div class="qty-controls">
            <button type="button" data-action="dec" aria-label="Decrease ${p.name}">−</button>
            <span>${qty}</span>
            <button type="button" data-action="inc" aria-label="Increase ${p.name}">+</button>
          </div>
        </article>`;
    })
    .join("");
}

function renderCart() {
  const items = cartItems().map(({ id, qty }) => {
    const product = state.products.find((p) => p.id === id);
    return { ...product, qty, lineTotal: product.price * qty };
  });

  if (!items.length) {
    els.cartLines.innerHTML = `<p class="empty">No items selected yet.</p>`;
    els.subtotal.textContent = money(0);
    els.tax.textContent = money(0);
    els.total.textContent = money(0);
    els.checkoutBtn.disabled = true;
    renderProducts();
    return;
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  els.cartLines.innerHTML = items
    .map(
      (i) => `
      <div class="cart-line">
        <div>
          <strong>${i.name}</strong>
          <div class="meta">${i.qty} × ${money(i.price)}</div>
        </div>
        <strong>${money(i.lineTotal)}</strong>
      </div>`
    )
    .join("");

  els.subtotal.textContent = money(subtotal);
  els.tax.textContent = money(tax);
  els.total.textContent = money(total);
  els.checkoutBtn.disabled = false;
  renderProducts();
}

function emailStatusText(email) {
  if (!email) return "";
  if (email.sent) return `Email sent to ${email.to}.`;
  if (email.skipped) return `Email not sent: ${email.reason}`;
  if (email.error) return `Email failed: ${email.error}`;
  return "";
}

function renderInvoice(invoice) {
  state.currentInvoice = invoice;
  const rows = invoice.lineItems
    .map(
      (i) => `
      <tr>
        <td>${i.name}</td>
        <td class="right">${i.qty}</td>
        <td class="right">${money(i.unitPrice)}</td>
        <td class="right">${money(i.lineTotal)}</td>
      </tr>`
    )
    .join("");

  els.invoice.innerHTML = `
    <div class="invoice-header">
      <div>
        <img class="invoice-logo" src="${invoice.logoPath}" alt="Company logo" />
        <h2>${invoice.companyName}</h2>
        <p class="meta">Invoice ${invoice.invoiceNumber}</p>
        <p class="meta">Issued ${new Date(invoice.issuedAt).toLocaleString()}</p>
      </div>
      <div>
        <strong>Bill to</strong>
        <p>${invoice.customer.name}</p>
        <p class="meta">${invoice.customer.email || "—"}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="right">Qty</th>
          <th class="right">Unit</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <dl class="totals">
      <div><dt>Subtotal</dt><dd>${money(invoice.subtotal)}</dd></div>
      <div><dt>Tax (${Math.round(invoice.taxRate * 100)}%)</dt><dd>${money(invoice.tax)}</dd></div>
      <div class="grand"><dt>Total due</dt><dd>${money(invoice.total)}</dd></div>
    </dl>
    <p class="meta" id="invoice-email-status">${emailStatusText(invoice.email)}</p>`;
  els.dialog.showModal();
}

async function downloadPdf() {
  if (!state.currentInvoice?.pdfUrl) return;
  els.status.textContent = "Preparing PDF download…";
  try {
    const response = await fetch(state.currentInvoice.pdfUrl);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "PDF download failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.currentInvoice.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    els.status.textContent = `Downloaded ${state.currentInvoice.invoiceNumber}.pdf`;
  } catch (err) {
    els.status.textContent = err.message;
  }
}

async function resendEmail() {
  if (!state.currentInvoice?.invoiceNumber) return;
  const email = els.customerEmail.value.trim() || state.currentInvoice.customer.email;
  els.status.textContent = `Emailing invoice to ${email}…`;
  els.emailBtn.disabled = true;
  try {
    const response = await fetch(
      `/api/invoices/${encodeURIComponent(state.currentInvoice.invoiceNumber)}/email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.email?.error || "Email failed");
    state.currentInvoice.email = data.email;
    const statusEl = document.getElementById("invoice-email-status");
    if (statusEl) statusEl.textContent = emailStatusText(data.email);
    els.status.textContent = emailStatusText(data.email) || "Email sent.";
  } catch (err) {
    els.status.textContent = err.message;
  } finally {
    els.emailBtn.disabled = false;
  }
}

els.productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".product");
  const id = card.dataset.id;
  const current = state.cart.get(id) || 0;
  setQty(id, button.dataset.action === "inc" ? current + 1 : current - 1);
});

els.checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.status.textContent = "Creating invoice and emailing PDF…";
  els.checkoutBtn.disabled = true;

  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cartItems(),
        customerName: document.getElementById("customer-name").value,
        customerEmail: els.customerEmail.value,
        sendEmail: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Checkout failed");
    const emailNote = emailStatusText(data.email);
    els.status.textContent = `Invoice ${data.invoiceNumber} ready. ${emailNote}`.trim();
    renderInvoice(data);
  } catch (err) {
    els.status.textContent = err.message;
  } finally {
    els.checkoutBtn.disabled = cartItems().length === 0;
  }
});

els.downloadBtn.addEventListener("click", downloadPdf);
els.emailBtn.addEventListener("click", resendEmail);
els.closeBtn.addEventListener("click", () => els.dialog.close());

async function init() {
  const response = await fetch("/api/products");
  const data = await response.json();
  state.products = data.products;
  state.emailEnabled = Boolean(data.emailEnabled);
  els.companyName.textContent = data.company;
  els.customerEmail.required = true;
  renderCart();
}

init();

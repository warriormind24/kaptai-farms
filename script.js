const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('#site-nav');

menuToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.textContent = isOpen ? 'Close' : 'Menu';
});

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (menuToggle) menuToggle.textContent = 'Menu';
  });
});

document.querySelectorAll('img').forEach((img) => {
  img.addEventListener('error', () => {
    img.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.className = 'media-fallback';
    fallback.textContent = 'Image unavailable';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', img.alt || 'Image');
    img.parentNode.insertBefore(fallback, img);
  });
});

document.querySelectorAll('video').forEach((video) => {
  video.addEventListener('error', () => {
    const fallback = document.createElement('div');
    fallback.className = 'media-fallback';
    fallback.textContent = 'Video unavailable';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', 'Video');
    video.parentNode.insertBefore(fallback, video);
    video.style.display = 'none';
  });
});

const formatMoney = (value) => new Intl.NumberFormat('en-ZM', {
  style: 'currency',
  currency: 'ZMW',
  minimumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const documentTypeInputs = document.querySelectorAll('input[name="documentType"]');
const documentNumber = document.getElementById('document-number');
const documentTotal = document.getElementById('document-total');
const documentForm = document.getElementById('document-form');
const lineItemsContainer = document.getElementById('line-items');
const addItemButton = document.getElementById('add-item');
let invoiceCounter = 1;

function updateDocumentNumber() {
  if (!documentNumber) return;

  const selectedType = document.querySelector('input[name="documentType"]:checked')?.value || 'Invoice';
  const prefix = selectedType === 'Quotation' ? 'QUO' : 'INV';
  documentNumber.textContent = `${prefix}-${String(invoiceCounter).padStart(4, '0')}`;
}

function updateDocumentTotal() {
  if (!lineItemsContainer || !documentTotal) return;

  const total = Array.from(lineItemsContainer.querySelectorAll('.line-item')).reduce((sum, row) => {
    const quantity = Number(row.querySelector('.quantity-input')?.value || 0);
    const unitPrice = Number(row.querySelector('.price-input')?.value || 0);
    return sum + (quantity * unitPrice);
  }, 0);

  documentTotal.textContent = formatMoney(total);
}

function attachLineItemEvents(row) {
  const quantityInput = row.querySelector('.quantity-input');
  const priceInput = row.querySelector('.price-input');
  const productSelect = row.querySelector('.product-select');
  const removeButton = row.querySelector('.remove-item');

  quantityInput?.addEventListener('input', updateDocumentTotal);
  priceInput?.addEventListener('input', updateDocumentTotal);
  productSelect?.addEventListener('change', updateDocumentTotal);

  removeButton?.addEventListener('click', () => {
    if (lineItemsContainer && lineItemsContainer.querySelectorAll('.line-item').length > 1) {
      row.remove();
      updateDocumentTotal();
    }
  });
}

function addDocumentLineItem() {
  if (!lineItemsContainer) return;

  const row = document.createElement('div');
  row.className = 'line-item';
  row.innerHTML = `
    <label>Product
      <select class="product-select">
        <option>Vegetables</option>
        <option>Chickens</option>
        <option>Tomatoes</option>
      </select>
    </label>
    <label>Qty
      <input class="quantity-input" type="number" min="1" value="1" />
    </label>
    <label>Unit price
      <input class="price-input" type="number" min="0" step="0.01" placeholder="0.00" />
    </label>
    <button class="remove-item" type="button" aria-label="Remove product line">×</button>
  `;

  attachLineItemEvents(row);
  lineItemsContainer.appendChild(row);
  updateDocumentTotal();
}

if (documentTypeInputs.length) {
  documentTypeInputs.forEach((input) => input.addEventListener('change', updateDocumentNumber));
}

if (lineItemsContainer) {
  lineItemsContainer.querySelectorAll('.line-item').forEach(attachLineItemEvents);
  updateDocumentTotal();
}

if (addItemButton) {
  addItemButton.addEventListener('click', addDocumentLineItem);
}

updateDocumentNumber();

documentForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const selectedType = document.querySelector('input[name="documentType"]:checked')?.value || 'Invoice';
  const customerName = document.getElementById('customer-name')?.value.trim() || 'Walk-in customer';
  const customerContact = document.getElementById('customer-contact')?.value.trim() || 'No contact details';

  const rows = Array.from(lineItemsContainer?.querySelectorAll('.line-item') || []).map((row) => {
    const product = row.querySelector('.product-select')?.value || 'Product';
    const quantity = Number(row.querySelector('.quantity-input')?.value || 0);
    const unitPrice = Number(row.querySelector('.price-input')?.value || 0);
    return {
      product,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  }).filter((row) => row.quantity > 0 || row.unitPrice > 0);

  if (!rows.length) {
    documentTotal.textContent = formatMoney(0);
    return;
  }

  const total = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const issuedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const documentBody = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.product)}</td>
      <td>${row.quantity}</td>
      <td>${formatMoney(row.unitPrice)}</td>
      <td>${formatMoney(row.lineTotal)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${selectedType} | Kaptai Farms</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #1e2a1d;
        background: #f6f5f1;
        margin: 0;
        padding: 32px;
      }
      .document {
        max-width: 820px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #dfe7de;
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
        border-bottom: 2px solid #e5e8d7;
        padding-bottom: 18px;
        margin-bottom: 24px;
      }
      h1 {
        margin: 6px 0 0;
        font-size: 32px;
      }
      .meta {
        text-align: right;
        font-size: 14px;
        line-height: 1.8;
      }
      .customer {
        margin-bottom: 24px;
        padding: 18px;
        background: #f8faf6;
        border-radius: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th, td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid #edf1eb;
      }
      th {
        background: #eef6ed;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .totals {
        margin-left: auto;
        width: 280px;
        border-top: 2px solid #d3d9c7;
        padding-top: 16px;
      }
      .totals-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .totals-row strong {
        font-size: 18px;
      }
      .footer {
        margin-top: 36px;
        font-size: 12px;
        color: #5d685a;
        border-top: 1px solid #edf1eb;
        padding-top: 16px;
      }
    </style>
  </head>
  <body>
    <div class="document">
      <div class="header">
        <div>
          <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #64815f; font-weight: 700;">Kaptai Farms</div>
          <h1>${selectedType}</h1>
        </div>
        <div class="meta">
          <div><strong>${selectedType === 'Quotation' ? 'QUOTATION' : 'INVOICE'} NO:</strong> ${escapeHtml(documentNumber?.textContent || 'INV-0001')}</div>
          <div><strong>Date:</strong> ${issuedDate}</div>
        </div>
      </div>

      <div class="customer">
        <div><strong>Customer:</strong> ${escapeHtml(customerName)}</div>
        <div><strong>Contact:</strong> ${escapeHtml(customerContact)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          ${documentBody}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Total</span>
          <strong>${formatMoney(total)}</strong>
        </div>
      </div>

      <div class="footer">
        Thank you for your business. For current stock and delivery updates, contact Kaptai Farms on WhatsApp: +260 971 662 073.
      </div>
    </div>
  </body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const downloadPrefix = selectedType === 'Quotation' ? 'quo' : 'inv';
  const filename = `${downloadPrefix}-${String(invoiceCounter).padStart(4, '0')}.html`;
  const documentFile = new File([blob], filename, { type: 'text/html' });

  if (navigator.canShare?.({ files: [documentFile] }) && navigator.share) {
    navigator.share({ files: [documentFile], title: `${selectedType} | Kaptai Farms` });
  } else {
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  invoiceCounter += 1;
  updateDocumentNumber();
});
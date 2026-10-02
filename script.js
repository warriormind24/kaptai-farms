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

  if (!window.jspdf?.jsPDF) {
    window.alert('PDF creation is unavailable. Please check your internet connection and try again.');
    return;
  }

  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - (margin * 2);
  const invoiceId = documentNumber?.textContent || 'INV-0001';
  const cleanMoney = (amount) => formatMoney(amount).replace(/\s+/g, ' ');

  pdf.setTextColor(68, 104, 60);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('KAPTAI FARMS', margin, 18);
  pdf.setTextColor(30, 42, 29);
  pdf.setFontSize(24);
  pdf.text(selectedType.toUpperCase(), margin, 30);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`${selectedType === 'Quotation' ? 'QUOTATION' : 'INVOICE'} NO: ${invoiceId}`, margin, 38);
  pdf.text(`Date: ${issuedDate}`, pageWidth - margin, 38, { align: 'right' });
  pdf.setDrawColor(210, 220, 203);
  pdf.line(margin, 44, pageWidth - margin, 44);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Customer', margin, 54);
  pdf.setFont('helvetica', 'normal');
  pdf.text(pdf.splitTextToSize(customerName, contentWidth), margin, 60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Contact', margin, 70);
  pdf.setFont('helvetica', 'normal');
  pdf.text(pdf.splitTextToSize(customerContact, contentWidth), margin, 76);

  const columns = { product: margin, quantity: 112, unitPrice: 137, lineTotal: pageWidth - margin };
  let cursorY = 90;
  const drawTableHeader = () => {
    pdf.setFillColor(238, 246, 237);
    pdf.rect(margin, cursorY - 6, contentWidth, 10, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('PRODUCT', columns.product + 2, cursorY);
    pdf.text('QTY', columns.quantity, cursorY, { align: 'right' });
    pdf.text('UNIT PRICE', columns.unitPrice, cursorY, { align: 'right' });
    pdf.text('LINE TOTAL', columns.lineTotal - 2, cursorY, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    cursorY += 10;
  };

  drawTableHeader();
  rows.forEach((row) => {
    const productLines = pdf.splitTextToSize(row.product, 82);
    const rowHeight = Math.max(8, productLines.length * 5 + 3);
    if (cursorY + rowHeight > pageHeight - margin - 28) {
      pdf.addPage();
      cursorY = margin + 8;
      drawTableHeader();
    }
    pdf.text(productLines, columns.product + 2, cursorY);
    pdf.text(String(row.quantity), columns.quantity, cursorY, { align: 'right' });
    pdf.text(cleanMoney(row.unitPrice), columns.unitPrice, cursorY, { align: 'right' });
    pdf.text(cleanMoney(row.lineTotal), columns.lineTotal - 2, cursorY, { align: 'right' });
    cursorY += rowHeight;
    pdf.setDrawColor(230, 235, 227);
    pdf.line(margin, cursorY - 2, pageWidth - margin, cursorY - 2);
  });

  if (cursorY + 30 > pageHeight - margin) {
    pdf.addPage();
    cursorY = margin + 8;
  }
  cursorY += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(`Total: ${cleanMoney(total)}`, pageWidth - margin, cursorY, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(93, 104, 90);
  const footer = 'Thank you for your business. For current stock and delivery updates, contact Kaptai Farms on WhatsApp: +260 971 662 073.';
  const footerLines = pdf.splitTextToSize(footer, contentWidth);
  if (cursorY + 12 + (footerLines.length * 4) > pageHeight - margin) {
    pdf.addPage();
    cursorY = margin + 8;
  }
  pdf.text(footerLines, margin, cursorY + 12);

  const downloadPrefix = selectedType === 'Quotation' ? 'quo' : 'inv';
  const filename = `${downloadPrefix}-${String(invoiceCounter).padStart(4, '0')}.pdf`;
  pdf.save(filename);

  invoiceCounter += 1;
  updateDocumentNumber();
});
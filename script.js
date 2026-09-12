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

const documentForm = document.querySelector('#document-form');
const lineItems = document.querySelector('#line-items');
const addItemButton = document.querySelector('#add-item');
const totalOutput = document.querySelector('#document-total');
const documentNumber = document.querySelector('#document-number');

const formatMoney = (amount) => `ZMW ${amount.toFixed(2)}`;

const getLineItems = () => [...document.querySelectorAll('.line-item')].map((row) => ({
  product: row.querySelector('.product-select').value,
  quantity: Number(row.querySelector('.quantity-input').value) || 0,
  price: Number(row.querySelector('.price-input').value) || 0
}));

const updateTotal = () => {
  const total = getLineItems().reduce((sum, item) => sum + item.quantity * item.price, 0);
  totalOutput.textContent = formatMoney(total);
};

const updateDocumentNumber = () => {
  const prefix = document.querySelector('input[name="documentType"]:checked')?.value === 'Quotation' ? 'QT' : 'INV';
  documentNumber.textContent = `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
};

const bindLineItem = (row) => {
  row.querySelectorAll('input, select').forEach((input) => input.addEventListener('input', updateTotal));
  row.querySelector('.remove-item').addEventListener('click', () => {
    if (document.querySelectorAll('.line-item').length > 1) {
      row.remove();
      updateTotal();
    }
  });
};

document.querySelectorAll('.line-item').forEach(bindLineItem);
document.querySelectorAll('input[name="documentType"]').forEach((input) => input.addEventListener('change', updateDocumentNumber));
addItemButton?.addEventListener('click', () => {
  const row = document.querySelector('.line-item').cloneNode(true);
  row.querySelector('.quantity-input').value = 1;
  row.querySelector('.price-input').value = '';
  lineItems.appendChild(row);
  bindLineItem(row);
});

documentForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const type = document.querySelector('input[name="documentType"]:checked').value;
  const number = documentNumber.textContent;
  const customer = document.querySelector('#customer-name').value.trim() || 'Walk-in customer';
  const contact = document.querySelector('#customer-contact').value.trim() || 'Not provided';
  const date = new Date().toLocaleDateString('en-GB');
  const items = getLineItems().filter((item) => item.quantity > 0);
  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const rows = items.map((item) => `<tr><td>${item.product}</td><td>${item.quantity}</td><td>${formatMoney(item.price)}</td><td>${formatMoney(item.quantity * item.price)}</td></tr>`).join('');
  const documentHtml = `<!doctype html><html><head><meta charset="UTF-8"><title>${type} ${number} - Kaptai Farms</title><style>body{font:14px Arial,sans-serif;color:#17340e;max-width:800px;margin:48px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:3px solid #315722;padding-bottom:24px}h1{font-size:32px;margin:0}h2{font-size:22px;margin-top:42px}p{color:#65705b}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid #dce2d2}th{background:#e4ecd0}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{display:flex;justify-content:flex-end;gap:35px;font-size:20px;font-weight:bold;margin-top:22px}.meta{line-height:1.7}</style></head><body><header><div><h1>Kaptai Farms</h1><p>Poultry · Vegetables · Tomatoes<br>Ndola, Zambia</p></div><div class="meta"><strong>${type.toUpperCase()}</strong><br>${number}<br>${date}</div></header><h2>Prepared for ${customer}</h2><p>Contact: ${contact}</p><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>Total</span><span>${formatMoney(total)}</span></div><p style="margin-top:52px">Thank you for choosing Kaptai Farms. For availability and orders: +260 971 662 073 · kapembwakasitu5@gmail.com</p></body></html>`;
  const blob = new Blob([documentHtml], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${type.toLowerCase()}-${number}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
});

updateDocumentNumber();
updateTotal();

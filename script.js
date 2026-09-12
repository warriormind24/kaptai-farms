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

const escapePdfText = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const getLogoRgb = async () => {
  const image = new Image();
  image.src = 'logo.jpg';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let source = 0, target = 0; target < rgb.length; source += 4, target += 3) {
    rgb[target] = pixels[source];
    rgb[target + 1] = pixels[source + 1];
    rgb[target + 2] = pixels[source + 2];
  }
  return { width: canvas.width, height: canvas.height, rgb };
};

const joinBytes = (chunks) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
  return result;
};

const makePdfBlob = ({ type, number, customer, contact, date, items, total, logo }) => {
  const commands = [];
  const addText = (text, x, y, size = 10, font = 'F1', color = '0 0 0') => {
    commands.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`);
  };
  const addLine = (x1, y1, x2, y2, color = '0.2 0.2 0.2') => commands.push(`${color} RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
  const addRect = (x, y, w, h, fill) => commands.push(`${fill} rg ${x} ${y} ${w} ${h} re f`);

  const invoiceType = type === 'Quotation' ? 'QUOTATION' : 'RECEIPT / INVOICE';
  const displayNumber = String(number || 'No. 102').replace(/^INV-|^QT-/, '');

  addRect(0, 0, 595, 842, '0.97 0.97 0.96');
  addRect(32, 34, 531, 775, '1 1 1');
  addRect(40, 730, 515, 58, '0.09 0.20 0.06');
  addLine(40, 730, 555, 730, '0.09 0.20 0.06');
  commands.push('q 0.58 0 0 0.58 56 742 cm /Im1 Do Q');

  addText('KAPTAI GENERAL DEALERS', 82, 768, 18, 'F2', '1 1 1');
  addText('A subsidiary of Kaptai Farms', 82, 750, 8, 'F1', '1 1 1');
  addText('PLOT No: 14', 82, 738, 8, 'F1', '1 1 1');
  addText('KAMBO FARM BLOCK', 78, 726, 8, 'F1', '1 1 1');
  addText('Ndola, Zambia', 78, 714, 8, 'F1', '1 1 1');
  addText('TEL: 0971 662 073', 290, 748, 8, 'F1', '1 1 1');
  addText('Email: kaptaifarms@gmail.com', 290, 736, 8, 'F1', '1 1 1');
  addText(invoiceType, 420, 767, 12, 'F2', '1 1 1');
  addText(`No.${displayNumber}`, 430, 748, 13, 'F2', '1 1 1');

  addText('Bill to:', 60, 690, 9, 'F2', '0.15 0.15 0.15');
  addText(customer, 110, 690, 9, 'F1', '0.15 0.15 0.15');
  addText('Kaptai Farms is a subsidiary of Kaptai General Dealers', 110, 676, 7, 'F1', '0.15 0.15 0.15');
  addText('Customer TIN:', 350, 690, 9, 'F2', '0.15 0.15 0.15');
  addText(contact, 440, 690, 8, 'F1', '0.15 0.15 0.15');
  addText(`Date: ${date}`, 430, 676, 9, 'F1', '0.15 0.15 0.15');

  addRect(52, 632, 490, 32, '0.92 0.93 0.89');
  addText('QTY', 70, 647, 9, 'F2');
  addText('DESCRIPTION', 160, 647, 9, 'F2');
  addText('UNIT PRICE', 355, 647, 9, 'F2');
  addText('AMOUNT', 485, 647, 9, 'F2');

  let y = 620;
  const itemRows = items.length ? items : [{ product: 'Vegetables', quantity: 1, price: 0 }];
  itemRows.forEach((item) => {
    addText(String(item.quantity || 0), 75, y, 9, 'F1');
    addText(item.product, 160, y, 9, 'F1');
    addText(formatMoney(item.price || 0), 360, y, 9, 'F1');
    addText(formatMoney((item.quantity || 0) * (item.price || 0)), 475, y, 9, 'F1');
    addLine(52, y - 8, 542, y - 8, '0.75 0.75 0.75');
    y -= 24;
  });

  for (let i = 0; i < 10 - itemRows.length; i += 1) {
    addLine(52, y - 8, 542, y - 8, '0.82 0.82 0.82');
    y -= 22;
  }

  addText('Subtotal', 360, 300, 9, 'F2');
  addText(formatMoney(total), 480, 300, 9, 'F2');
  addText('VAT %', 360, 285, 9, 'F2');
  addText('0.00', 480, 285, 9, 'F1');
  addText('TOTAL', 360, 270, 10, 'F2');
  addText(formatMoney(total), 480, 270, 10, 'F2');

  addText('Prepared by:', 60, 210, 9, 'F2');
  addText('Delivered by:', 60, 188, 9, 'F2');
  addText('Signature:', 220, 210, 9, 'F2');
  addText('Signature:', 220, 188, 9, 'F2');
  addText('Bank Name:', 60, 150, 9, 'F2');
  addText('Branch Name:', 260, 150, 9, 'F2');
  addText('Bank Acc:', 394, 150, 9, 'F2');

  addText('Cash', 430, 202, 8, 'F1');
  addText('Credit', 430, 188, 8, 'F1');
  addLine(52, 164, 542, 164, '0.2 0.2 0.2');
  addText('Thank you for choosing Kaptai Farms.', 65, 90, 9, 'F1', '0.4 0.4 0.4');

  const stream = `BT ${commands.join(' ')} ET`;
  const imageStream = logo.rgb;
  const objectBodies = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${imageStream.length} >>\nstream\n`
  ];

  const encoder = new TextEncoder();
  const chunks = [encoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  objectBodies.forEach((body, index) => {
    offsets[index + 1] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(encoder.encode(`${index + 1} 0 obj\n${body}\nendobj\n`));
  });

  const imageStart = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  chunks.push(imageStream);
  chunks.push(encoder.encode('\nendstream\nendobj\n'));

  const startXref = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  chunks.push(encoder.encode(`xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\n${String(imageStart).padStart(10, '0')} 00000 n \ntrailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`));

  return new Blob([joinBytes(chunks)], { type: 'application/pdf' });
};

documentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = document.querySelector('input[name="documentType"]:checked').value;
  const number = documentNumber.textContent;
  const customer = document.querySelector('#customer-name').value.trim() || 'Walk-in customer';
  const contact = document.querySelector('#customer-contact').value.trim() || 'Not provided';
  const date = new Date().toLocaleDateString('en-GB');
  const items = getLineItems().filter((item) => item.quantity > 0);
  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const logo = await getLogoRgb();
  const blob = makePdfBlob({ type, number, customer, contact, date, items, total, logo });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${type.toLowerCase()}-${number}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
});

updateDocumentNumber();
updateTotal();

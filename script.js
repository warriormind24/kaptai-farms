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
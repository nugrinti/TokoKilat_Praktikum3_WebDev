import { $, el, tampilkanToast } from './util.js';
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');
let intervalHitung;
let intervalTeks;

function jalankanHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const wadah = $('#hitung-mundur');
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  intervalHitung = setInterval(() => {
    const sisa = Math.max(akhir - Date.now(), 0);
    jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    senti.textContent = duaDigit(Math.floor((sisa % 1000) / 10));
    const lebarPenuh = wadah.offsetWidth;
    garis.style.width = Math.round(lebarPenuh * (sisa / (akhir - awal + 1))) + 'px';
  }, 10);
}

function jalankanTeksBerjalan() {
  const teks = $('#berjalan-teks');
  let x = teks.parentElement.offsetWidth;
  intervalTeks = setInterval(() => {
    x -= 1;
    if (x < -teks.offsetWidth) x = teks.parentElement.offsetWidth;
    teks.style.left = x + 'px';
  }, 10);
}

async function pasangBannerPromo() {
  const respons = await fetch('/api/promo');
  const promo = await respons.json();

  const banner = el('section', 'promo-banner');
  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    if (window.Lacak) window.Lacak.kirim('promo_click', { judul: promo.judul });
  });
  banner.append(teks, tombol);

  $('#utama').prepend(banner);
}
export function pasangPromo() {
  pasangBannerPromo();

  const wadahPromo = $('#hitung-mundur'); 
  if (!wadahPromo) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        jalankanHitungMundur();
        jalankanTeksBerjalan();
      } else {
        clearInterval(intervalHitung);
        clearInterval(intervalTeks);
      }
    });
  });
  observer.observe(wadahPromo.parentElement);
}
import { $, ambilJson, el, tampilkanToast } from './util.js';
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const sisaAwal = Math.max(akhir - awal, 0);
  
  const garis = $('#hm-garis');
  if (garis) {
    garis.style.transformOrigin = 'left center'; 
    garis.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: sisaAwal, easing: 'linear', fill: 'forwards' }
    );
  }

  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik');
  const senti = $('#hm-senti'); 

  if (senti) senti.textContent = "00"; 

  let intervalHitung = setInterval(() => {
    const sisa = Math.max(akhir - Date.now(), 0);
    if (jam) jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    if (menit) menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    if (detik) detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    if (senti) senti.textContent = duaDigit(Math.floor((sisa % 1000) / 10));
    if (sisa <= 0) clearInterval(intervalHitung);
  }, 10);
}

function pasangTeksBerjalan() {
  const teks = $('#berjalan-teks');
  if (!teks) return;
  const wadah = teks.parentElement;
  const lebarWadah = wadah.offsetWidth;
  const lebarTeks = teks.offsetWidth;

  teks.animate([
    { transform: `translateX(${lebarWadah}px)` },
    { transform: `translateX(-${lebarTeks}px)` }
  ], {
    duration: (lebarWadah + lebarTeks) * 15,
    iterations: Infinity
  });
}

async function pasangBannerPromo() {
  try {
    const promo = await ambilJson('/api/promo');

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
    const slot = $('#slot-promo');
    if (slot) {
      slot.innerHTML = '';
      slot.append(banner);
    } else {
      $('#utama').prepend(banner);
    }
  } catch (err) {
    console.error('Gagal memuat promo:', err);
  }
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
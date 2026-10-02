// Pencarian, saringan kategori, dan pengurutan.

import { $, el, hargaSetelahDiskon } from './util.js';
import { keadaan, renderProduk } from './katalog.js';

const saringan = { kata: '', kategori: 'Semua', urut: 'relevan' };

// Dipakai untuk normalisasi kunci pencarian (bukan normalisasi produk —
// produk sudah dinormalisasi saat load via p._cariNormal di katalog.js).
function normalkanKunci(teks) {
  return teks
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// TK-1041 (akar masalah sisa setelah debounce):
//
// Mengapa masih 401 ms setelah debounce ditambahkan?
//
// Debounce mengurangi SEBERAPA SERING filter dipanggil, tetapi tidak mempercepat
// EKSEKUSI filter itu sendiri. Ketika pengguna mengetik "s" dan berhenti:
//
//   [kode lama] cocok(produk, "s") → normalkan(nama+merek+kategori+kota) per produk
//   = normalkan dipanggil 3000× per filter → ~20 ms pada 4× CPU throttle
//
//   [kode baru] cocok(produk, "s") → produk._cariNormal sudah ada, tinggal .includes()
//   = filter 3000 produk → ~1 ms
//
// _cariNormal di-precompute di muatProduk() → nol overhead saat mengetik.
function cocok(produk, kunci) {
  return kunci.split(' ').every((k) => produk._cariNormal.includes(k));
}

const PEMBANDING = {
  murah:  (a, b) => hargaSetelahDiskon(a) - hargaSetelahDiskon(b),
  mahal:  (a, b) => hargaSetelahDiskon(b) - hargaSetelahDiskon(a),
  laris:  (a, b) => b.terjual - a.terjual,
  rating: (a, b) => b.rating - a.rating || b.terjual - a.terjual,
};

// Timer terpisah untuk Lacak.kirim('search') — debounce lebih panjang dari
// debounce render (200 ms vs 0 ms / defer). Ini memisahkan dua concern:
//   • Render hasil: segera setelah pengguna berhenti mengetik (200 ms)
//   • Kirim analitik: setelah pengguna benar-benar selesai (next task via defer)
// Tujuan: long task Lacak (f() = 2M iterasi ~42 ms pada 4× CPU) tidak berjalan
// di antara ketukan huruf berikutnya.
let timerLacakSearch;

export function terapkanSaringan() {
  const kunci = normalkanKunci(saringan.kata);
  let hasil = keadaan.semuaProduk.filter((p) => {
    if (saringan.kategori !== 'Semua' && p.kategori !== saringan.kategori) return false;
    if (kunci && !cocok(p, kunci)) return false;
    return true;
  });
  if (PEMBANDING[saringan.urut]) hasil = hasil.slice().sort(PEMBANDING[saringan.urut]);

  // renderProduk sekarang progressive: hanya 60 kartu pertama dibuat sinkron
  renderProduk(hasil);

  // Defer Lacak.kirim ke task berikutnya: Lacak tidak memblokir frame saat ini.
  // Walaupun f() hanya ~42 ms pada 4× CPU (tidak masuk "long task" > 100 ms),
  // menunda ke setTimeout(0) memastikan browser sempat merender hasil terlebih dahulu.
  if (window.Lacak && kunci) {
    clearTimeout(timerLacakSearch);
    const kata   = saringan.kata;   // capture sebelum closure
    const jumlah = hasil.length;
    timerLacakSearch = setTimeout(() => {
      window.Lacak.kirim('search', { kata, jumlah });
    }, 0);
  }
}

// TK-1041: Debounce 200 ms.
// Mekanisme: tunda eksekusi terapkanSaringan hingga 200 ms setelah ketukan TERAKHIR.
// Saat pengguna mengetik "s-e-p-a-t-u" lebih cepat dari 200 ms per huruf, hanya
// SATU filter dijalankan (setelah "u"), bukan enam.
let timerDebounce;
function debounce(fn, tunda) {
  return (...args) => {
    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(() => fn(...args), tunda);
  };
}

export function pasangPencarian() {
  const kolom = $('#kolom-cari');

  const cariDebounce = debounce(() => {
    saringan.kata = kolom.value;
    terapkanSaringan();
  }, 200);

  kolom.addEventListener('input', cariDebounce);

  $('#pilih-urut').addEventListener('change', (e) => {
    saringan.urut = e.target.value;
    terapkanSaringan();
  });

  const wadah   = $('#keping-kategori');
  const kategori = ['Semua', ...new Set(keadaan.semuaProduk.map((p) => p.kategori))];
  for (const nama of kategori) {
    const keping = el('button', 'keping', nama);
    keping.type  = 'button';
    keping.setAttribute('aria-pressed', String(nama === 'Semua'));
    keping.addEventListener('click', () => {
      saringan.kategori = nama;
      wadah.querySelectorAll('.keping').forEach((k) => k.setAttribute('aria-pressed', String(k === keping)));
      terapkanSaringan();
    });
    wadah.append(keping);
  }
}

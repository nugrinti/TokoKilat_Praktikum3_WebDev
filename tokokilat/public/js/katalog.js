// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, ambilJson, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { periksaGulir, observasiKartu } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  keadaan.semuaProduk = await ambilJson('/api/produk');

  // Pre-compute teks pencarian yang sudah dinormalkan.
  //
  // Masalah akar: terapkanSaringan() asli memanggil normalkan() pada setiap produk
  // setiap kali filter dipanggil. Dengan 3000 produk dan debounce yang memicu per huruf,
  // ini bisa berarti 3000 × normalkan() per ketukan → long task.
  //
  // Perbaikan: normalisasi dilakukan SEKALI saat produk dimuat, hasilnya disimpan di
  // p._cariNormal. Filter selanjutnya hanya membaca string yang sudah jadi → O(n) string.includes
  // tanpa normalisasi → ~10× lebih cepat di browser dengan CPU throttle.
  const re1 = /[\u0300-\u036f]/g;
  const re2 = /[^a-z0-9]+/g;
  for (const p of keadaan.semuaProduk) {
    p._cariNormal = (p.nama + ' ' + p.merek + ' ' + p.kategori + ' ' + p.kota)
      .toLowerCase().normalize('NFD').replace(re1, '').replace(re2, ' ').trim();
  }

  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;

  // TK-1081: loading="lazy" + decoding="async"
  const gambar = document.createElement('img');
  gambar.src      = produk.gambar;
  gambar.alt      = produk.nama;
  gambar.loading  = 'lazy';
  gambar.decoding = 'async';
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

  badan.append(el('div', 'keterangan', '★ ' + produk.rating.toLocaleString('id-ID') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);

  // TK-1063: Daftarkan ke IntersectionObserver untuk animasi + impresi
  observasiKartu(kartu);

  return kartu;
}

const JUMLAH_CONTOH = 24;

// FIX layout thrashing: tiga fase terpisah (batch write → batch read → batch write)
// sehingga browser hanya perlu forced layout SATU kali, bukan N kali.
// Tinggi hasil disimpan di tinggiJudulAktif agar batch render berikutnya bisa
// menerapkan nilai yang sama tanpa mengukur ulang.
let tinggiJudulAktif = 0;

function samakanTinggiJudul() {
  const semuaJudul = [...document.querySelectorAll('.kartu-judul')];
  if (semuaJudul.length === 0) return;
  const contoh = semuaJudul.slice(0, JUMLAH_CONTOH);

  // Fase 1: batch write
  for (const j of contoh) j.style.height = 'auto';

  // Fase 2: batch read — satu forced layout
  let tertinggi = 0;
  for (const j of contoh) {
    const t = j.offsetHeight;
    if (t > tertinggi) tertinggi = t;
  }

  // Cache untuk dipakai oleh renderSisanya
  tinggiJudulAktif = tertinggi;

  // Fase 3: batch write — terapkan ke semua
  for (const j of semuaJudul) j.style.height = tertinggi + 'px';
}

// ---------- Progressive rendering -----------------------------------------------
//
// AKAR MASALAH 401 ms:
// Mengetik "s" → ~2000 produk cocok → renderProduk() membuat ~2000 elemen DOM
// sekaligus dalam satu task → long task ~320 ms (pada 4× CPU throttle).
//
// PERBAIKAN — dua bagian:
//
// 1. BATCH_AWAL (60 kartu): hanya kartu yang muat di ~3 viewport pertama dibuat
//    secara sinkron. Ini membuat task pertama < 30 ms.
//
// 2. renderSisanya(): sisa kartu dirender secara bertahap di background
//    menggunakan setTimeout(0). Setiap iterasi yield ke task queue → browser bisa
//    merender frame antara batch → scroll tetap halus dan judul yang baru muncul
//    tampak mulus saat pengguna menggulir ke bawah.
//
// 3. generasiRender: jika pengguna mengetik huruf berikutnya sebelum semua batch
//    selesai, generasi lama dibatalkan → tidak ada race condition atau kartu lama
//    yang muncul di tengah hasil baru.
//
// Trade-off: kartu di bawah layar pertama muncul sedikit lebih lambat (~50–200 ms
// setelah filter). Ini TIDAK terlihat pengguna karena mereka harus menggulir dulu
// untuk mencapainya, dan IntersectionObserver menangani animasi muncul per kartu.
// ---------------------------------------------------------------------------------

const BATCH_AWAL   = 60;  // kartu yang dibuat sinkron (masuk dalam task pertama)
const BATCH_LANJUT = 60;  // kartu per batch background

let generasiRender = 0;

function renderSisanya(daftar, mulaiDari, generasi, kisi) {
  setTimeout(() => {
    if (generasi !== generasiRender) return; // render ini sudah dibatalkan oleh search baru

    const batasAkhir = Math.min(mulaiDari + BATCH_LANJUT, daftar.length);
    const fragmen = document.createDocumentFragment();
    for (let i = mulaiDari; i < batasAkhir; i++) fragmen.append(buatKartu(daftar[i]));
    kisi.append(fragmen);

    // Terapkan tinggi judul yang sudah diukur ke kartu baru tanpa forced layout.
    // (tinggiJudulAktif di-set oleh samakanTinggiJudul() di batch pertama)
    if (tinggiJudulAktif > 0) {
      const semuaJudul = kisi.querySelectorAll('.kartu-judul');
      for (let i = mulaiDari; i < Math.min(batasAkhir, semuaJudul.length); i++) {
        if (!semuaJudul[i].style.height) semuaJudul[i].style.height = tinggiJudulAktif + 'px';
      }
    }

    if (batasAkhir < daftar.length) {
      renderSisanya(daftar, batasAkhir, generasi, kisi); // jadwalkan batch berikutnya
    }
  }, 0);
}

export function renderProduk(daftar) {
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  kisi.innerHTML = '';

  // Naikkan generasi → batalkan semua renderSisanya yang masih pending
  generasiRender++;
  const generasiIni = generasiRender;
  tinggiJudulAktif  = 0;

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(
      el('strong', '', 'Produk tidak ditemukan.'),
      el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".')
    );
    kisi.append(kosong);
    $('#ringkasan').textContent = '0 produk ditampilkan';
    periksaGulir();
    return;
  }

  // Tampilkan jumlah total segera (sebelum render selesai)
  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';

  // Render batch pertama secara sinkron (task ini harus < 50 ms)
  const batasPertama = Math.min(BATCH_AWAL, daftar.length);
  const fragmen = document.createDocumentFragment();
  for (let i = 0; i < batasPertama; i++) fragmen.append(buatKartu(daftar[i]));
  kisi.append(fragmen);

  samakanTinggiJudul(); // ukur + cache tinggiJudulAktif, satu forced layout
  periksaGulir();

  // Jadwalkan batch berikutnya di background jika masih ada sisa
  if (daftar.length > BATCH_AWAL) {
    renderSisanya(daftar, BATCH_AWAL, generasiIni, kisi);
  }
}

export function perbaruiHargaVoucherDiKartu() {
  renderProduk(keadaan.ditampilkan);
}

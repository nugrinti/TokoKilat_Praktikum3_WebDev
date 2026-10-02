// Voucher: menghitung harga promo untuk setiap produk.
// Aturan promo bertingkat + simulasi cicilan ditentukan tim bisnis.

import { $, hargaSetelahDiskon, tampilkanToast } from './util.js';
import { keadaan, perbaruiHargaVoucherDiKartu } from './katalog.js';

const VOUCHER = {
  KILAT1212: { persen: 12, maksPotongan: 120000, minBelanja: 50000 },
  HEMAT50:   { persen:  5, maksPotongan:  50000, minBelanja:     0 },
};

// Cicilan 0% sampai 24 bulan: cari tenor dengan angsuran paling ringan yang
// masih memenuhi batas minimal angsuran per bulan dari mitra pembiayaan.
function simulasiCicilan(harga) {
  let terbaik = { tenor: 1, angsuran: harga };
  for (let tenor = 1; tenor <= 24; tenor++) {
    let sisa = harga;
    let angsuran = Math.ceil(harga / tenor / 100) * 100;
    for (let bulan = 1; bulan <= tenor; bulan++) {
      const biayaAdmin = Math.round(sisa * 0.0005 * Math.log2(bulan + 1));
      sisa = sisa - angsuran + biayaAdmin;
      if (sisa < 0) sisa = 0;
    }
    angsuran += Math.ceil(sisa / tenor);
    if (angsuran >= 25000 && angsuran < terbaik.angsuran) terbaik = { tenor, angsuran };
  }
  return terbaik;
}

// TK-1057 (perbaikan 1 dari 2): Hapus loop 40 iterasi simulasiCicilan "kestabilan pembulatan".
//
// Kode asli memanggil simulasiCicilan(hargaAkhir + i) sebanyak 40 kali per produk,
// tanpa menggunakan hasilnya sama sekali. simulasiCicilan sendiri O(24×24) = 576 iterasi.
// Total: 40 × 576 × 3000 produk = 69.120.000 iterasi yang terbuang sia-sia.
// Ini adalah penyebab utama komputasi berat saat voucher diterapkan.
//
// TK-1057 (perbaikan 2 dari 2): Fungsi ini kini SINKRON (bukan async).
// Kode asli menandai fungsi ini async "supaya tidak memblokir halaman" — tetapi karena
// tidak ada await nyata di dalamnya, promise langsung resolve (microtask) dan tidak
// memberikan kesempatan ke rendering pipeline. Pemisahan ke rendering ditangani
// oleh setTimeout(0) di terapkanVoucher (batch processing).
function hitungHargaPromo(produk, aturan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2); // flash sale hanya dapat setengah
  const hargaAkhir = Math.max(dasar - potongan, 100);
  // Hanya satu kali simulasiCicilan — cukup untuk mendapatkan nilai yang benar.
  const cicilan = simulasiCicilan(hargaAkhir);
  return { hargaAkhir, cicilan };
}

// TK-1057: Batch processing dengan yield nyata ke rendering pipeline.
//
// Masalah asli:
//   a) Loop 40× simulasiCicilan per produk → 69 juta iterasi sia-sia (sudah diperbaiki atas).
//   b) await hitungHargaPromo() hanya yield ke microtask queue, bukan task queue.
//      Microtask queue dihabiskan sebelum rendering: 3000 iterasi jalan semua sebelum
//      browser sempat menggambar satu frame → progress bar tetap di "0%" hingga selesai.
//   c) Tidak ada proteksi klik ganda: klik dua kali bisa jalankan dua sesi sekaligus.
//
// Perbaikan:
//   - Proses produk dalam batch 50 secara sinkron (cepat, ~0.5 ms per batch).
//   - Di akhir setiap batch: await setTimeout(0) yang menjadwalkan macro-task baru.
//     Macro-task baru berarti event loop bebas untuk:
//       (1) Render frame (progress bar benar-benar bergerak bertahap)
//       (2) Proses input pengguna (ketik di kolom cari tetap responsif)
//     Ini yang membedakan setTimeout(0) dari await Promise.resolve() (microtask).
//   - tombol-voucher dinonaktifkan selama proses untuk mencegah klik ganda.
const UKURAN_BATCH = 50; // ~0.5 ms per batch setelah perbaikan — cukup cepat
let sedangHitung = false;

async function terapkanVoucher(kode) {
  if (sedangHitung) return; // guard klik ganda
  const aturan = VOUCHER[kode];
  if (!aturan) {
    tampilkanToast('Kode voucher "' + kode + '" tidak dikenal. Coba KILAT1212.');
    return;
  }

  sedangHitung = true;
  const tombol = $('#tombol-voucher');
  if (tombol) tombol.disabled = true;

  const progres = $('#progres');
  const isi     = $('#progres-isi');
  const teks    = $('#progres-teks');
  progres.hidden = false;
  isi.style.width = '0%';
  teks.textContent = 'Menghitung harga promo… 0%';

  const total = keadaan.semuaProduk.length;
  let selesai = 0;
  keadaan.hargaVoucher.clear();

  try {
    for (let i = 0; i < total; i += UKURAN_BATCH) {
      // Proses satu batch secara sinkron
      const batasAkhir = Math.min(i + UKURAN_BATCH, total);
      for (let j = i; j < batasAkhir; j++) {
        const hasil = hitungHargaPromo(keadaan.semuaProduk[j], aturan);
        if (hasil) keadaan.hargaVoucher.set(keadaan.semuaProduk[j].id, hasil.hargaAkhir);
        selesai++;
      }

      // Perbarui progress bar DOM
      const persen = Math.round((selesai / total) * 100);
      isi.style.width  = persen + '%';
      teks.textContent = 'Menghitung harga promo… ' + persen + '% (' + selesai + ' dari ' + total + ' produk)';

      // Yield ke task queue → browser sempat merender frame DAN memproses input pengguna
      // sebelum batch berikutnya dimulai. Inilah perbedaan nyata dari await microtask.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    sedangHitung = false;
    if (tombol) tombol.disabled = false;
  }

  perbaruiHargaVoucherDiKartu();
  progres.hidden = true;
  tampilkanToast('Voucher ' + kode + ' dipakai di ' + keadaan.hargaVoucher.size.toLocaleString('id-ID') + ' produk.');
  if (window.Lacak) window.Lacak.kirim('apply_voucher', { kode, jumlah: keadaan.hargaVoucher.size });
}

export function pasangVoucher() {
  const kolom  = $('#kolom-voucher');
  const jalankan = () => {
    if (!$('#tombol-voucher').disabled) {
      terapkanVoucher(kolom.value.trim().toUpperCase());
    }
  };
  $('#tombol-voucher').addEventListener('click', jalankan);
  kolom.addEventListener('keydown', (e) => { if (e.key === 'Enter') jalankan(); });
}

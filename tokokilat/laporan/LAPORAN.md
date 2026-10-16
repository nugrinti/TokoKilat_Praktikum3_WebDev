# Laporan audit performa dan interaksi TokoKilat

Tim: WebKelompok701
Anggota:
1. Hana Zahirah Syifa - 241524045
2. Muhammad Fakhri Widodo - 241524053
3. Nurahma Rahayu - 241524058
4. Raden Muhammad Farhan Fauzan - 241524059 
Tanggal:25/09/2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).
link github : https://github.com/nugrinti/TokoKilat_Praktikum3_WebDev 

## 1. Ringkasan eksekutif (maks. 150 kata)
Apa masalah terbesar, apa yang dilakukan, berapa hasilnya. Tulis untuk manajer produk, bukan untuk engineer.

## 2. Lingkungan pengukuran
Spesifikasi laptop, versi Chrome, jumlah produk (`npm start` atau varian lain), tingkat throttling,
dan penyimpangan apa pun dari protokol di TUGAS.md bagian 7.

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS | >0,1|0,439 | <= 0,1 | Tidak ✗|
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama |3000 |240 | sebanding dengan yang terlihat |Sebagian (terdampak scroll) |
| S1 | INP |8808 ms |216 ms | <= 200 ms | Tidak ✗ (Mendekati)|
| S1 | Long task terlama |4683 ms |544 ms | <= 100 ms |Tidak ✗ |
| S2 | INP | 640 ms | 144 ms | ≤ 200 ms | Ya ✓ |
| S2 | Long task terlama | 805 ms | 120 ms | ≤ 100 ms | Tidak ✗ * |
| S3 | Jumlah pesanan dari 3 klik | 3 | 1 | 1 | Ya ✓ |
| S3 | INP | 136 ms | 64 ms | ≤ 200 ms | Ya ✓ |
| S4 | INP / progres tergambar bertahap? | 7243 ms / Tidak bertahap (langsung selesai) | 214 ms / Ya, tergambar perlahan | <= 200 ms | Ya (mendekati target maksimal) |
| S5 | Frame > 50 ms per 10 dtk |>20 |>2 | <= 2 |Tidak |
| S6 | Frame > 50 ms per 10 dtk |>20 |>2 | <= 2 |Tidak |

## 4. Temuan

Ulangi blok berikut untuk tiap temuan. Urutkan berdasarkan dampak, bukan urutan tiket.

### T-01: SDK analitik memblokir umpan balik tombol "+ Keranjang"

- **Tiket terkait:** TK-1044
- **Gejala bagi pengguna:** Menekan "+ Keranjang" tidak memberikan reaksi visual
  selama ratusan milidetik. Pengguna mengira tombol rusak dan menekan berulang.
  Hasilnya: keranjang terisi lebih banyak dari yang diinginkan tanpa disengaja.
- **Bukti:** [lampirkan screenshot flame chart 1044-sebelum-ss.png]
  - Track Interactions: INP event durasi 640 ms.
  - Main thread: long task 805 ms segera setelah klik, seluruhnya diisi oleh
    fungsi `f` dari `lacak.min.js` (terlihat di call stack:
    Event: click → Function call → tambahKeKeranjang → k → f).
  - `tombol.textContent` baru diperbarui di akhir long task, bukan di awal.
- **Akar masalah dan mekanismenya:**
  Di `keranjang.js`, fungsi `tambahKeKeranjang()` memanggil `window.Lacak.kirim()`
  secara sinkron sebelum memperbarui tampilan tombol. SDK Lacak menjalankan fungsi
  `f()` berisi loop `for (let i = 0; i < 2.000.000; i++)` — tepat 2 juta iterasi
  `Math.imul` dalam satu task tak terputus.

  Dalam model event loop browser: selama satu task berjalan, rendering opportunity
  tidak muncul. Klik-klik berikutnya masuk ke event queue dan diproses setelah
  task selesai — tiap klik memanggil `tambahKeKeranjang()` kembali dan menambah
  satu item.

- **Kualitas yang terdampak (ISO/IEC 25010):**
  - *Time behaviour* (performance efficiency): response time tombol 640 ms, jauh
    di atas ambang persepsi manusia 100 ms — pengguna merasakan halaman "hang".
  - *User error protection* (interaction capability): tidak ada mekanisme mencegah
    pemrosesan klik berulang yang tidak disengaja → kesalahan transaksi.
  - *Self-descriptiveness* (interaction capability): tombol tidak memberi tanda
    bahwa aksi pertama sudah diterima → pengguna tidak punya informasi untuk
    menghentikan klik berulang.

- **Perbaikan:**
  Dua perubahan di `tambahKeKeranjang()`:
  1. Perbarui UI sebelum SDK — pindahkan `tombol.textContent = 'Ditambahkan ✓'`
     dan `tampilkanToast()` ke sebelum `Lacak.kirim()`.
  2. Defer SDK ke task berikutnya — bungkus `Lacak.kirim()` dalam
     `setTimeout(..., 0)`. Browser mendapat rendering opportunity di antara
     dua task sehingga frame "Ditambahkan ✓" dirender sebelum SDK berjalan.

- **Trade-off:**
  Jika pengguna menutup tab dalam jeda sangat singkat setelah klik (< 10 ms),
  event `add_to_cart` tidak akan terkirim ke analytics. Ini dapat diterima karena
  jendela waktunya sangat sempit. Payload riwayat juga dibatasi 50 entri terakhir
  untuk mengurangi beban fungsi `t(s)` SDK.

- **Hasil:**

  | Metrik | Sebelum | Sesudah | Target |
  |---|---|---|---|
  | INP S2 | 640 ms | 144 ms | ≤ 200 ms ✓ |
  | Long task terlama | 805 ms | 120 ms | ≤ 100 ms ✗ * |
  | Barang bertambah dari 3 klik | 3 | 1 | 1 ✓ |

  *Sisa long task 120 ms dari task Lacak.kirim yang di-defer tidak dapat
  dieliminasi tanpa mengubah SDK.

---

### T-02: Tidak ada guard pada "Beli sekarang" — tiga klik menghasilkan tiga pesanan

- **Tiket terkait:** TK-1052
- **Gejala bagi pengguna:** Menekan "Beli sekarang" tidak memberikan umpan balik
  visual selama ~350 ms (latensi server). Pengguna menekan lagi. Hasilnya: tiga
  tagihan untuk satu niat beli.
- **Bukti:** [lampirkan screenshot 1052-sebelum-ss.png]
  - Track Network: 3 POST request ke `/api/pesanan` dari 3 klik cepat.
  - Lencana "Pesanan" di header menunjukkan angka 3 setelah skenario S3.
  - Main thread: `tombol.textContent = 'Dipesan ✓'` baru dieksekusi ~350 ms
    setelah klik pertama, setelah `await fetch()` resolve.
- **Akar masalah dan mekanismenya:**
  `beliSekarang()` adalah fungsi `async`. Tidak ada guard untuk mencegah klik
  ganda. Saat klik pertama, `await fetch('/api/pesanan')` membuat fungsi
  ter-suspend selama ~350 ms. Selama itu tombol tidak berubah karena
  `tombol.textContent = 'Dipesan ✓'` ada setelah `await` dan belum dieksekusi.
  Klik ke-2 dan ke-3 selama 350 ms masing-masing memulai fetch baru → 3 pesanan.

- **Kualitas yang terdampak (ISO/IEC 25010):**
  - *User error protection* (interaction capability): tidak ada pelindung terhadap
    aksi berulang yang tidak disengaja → kesalahan transaksi keuangan nyata.
  - *Self-descriptiveness* (interaction capability): tidak ada tanda bahwa pesanan
    sedang diproses → pengguna tidak punya informasi untuk berhenti menekan.
  - *Operability* (interaction capability): pengguna tidak bisa membatalkan
    pesanan yang terlanjur dibuat dari kesalahan UI.

- **Perbaikan:**
  Tiga perubahan di `beliSekarang()`:
  1. Guard flag di baris pertama: `if (tombol.dataset.sedangProses === '1') return`
     — klik ke-2 dan ke-3 langsung diabaikan.
  2. Feedback segera sebelum `await`: `tombol.disabled = true` dan
     `tombol.textContent = 'Memproses…'` — pengguna langsung tahu aksi diterima.
  3. Blok `finally` memastikan tombol selalu aktif kembali baik fetch berhasil
     maupun gagal.

- **Trade-off:**
  Solusi server-side (idempotent key per sesi) lebih kuat untuk lingkungan
  production, tetapi memerlukan perubahan `server.js` yang tidak boleh disentuh
  per aturan main.

- **Hasil:**

  | Metrik | Sebelum | Sesudah | Target |
  |---|---|---|---|
  | Pesanan dari 3 klik cepat | 3 | 1 | 1 ✓ |
  | INP S3 | 136 ms | 64 ms | ≤ 200 ms ✓ |
  | Long task terlama S3 | 102 ms | 83 ms | ≤ 100 ms ✓ |

---

### T-03: Pencarian per keystroke mengalami penundaan parah akibat layout thrashing dan eksekusi DOM sinkron
- **Tiket terkait:** TK-1041
- **Gejala bagi pengguna:** Antarmuka terhenti (hang) saat mengetik di kolom pencarian; teks baru muncul setelah jeda beberapa detik.
- **Bukti:** INP keydown #kolom-cari mencapai 8808 ms (8805 ms fase presentasi) dan long task terlama 4683 ms. Pada karakter pertama ("s"), 62% durasi (2462,6 ms) habis untuk 27 kali forced layout.

- **Akar masalah dan mekanismenya:** EventListener input memanggil terapkanSaringan() secara sinkron tanpa debounce. Perulangan samakanTinggiJudul() memicu layout thrashing (style.height='auto' diikuti pembacaan offsetHeight). Fungsi normalkan() memproses ~3000 produk secara berulang, dan renderProduk() membuat ribuan elemen DOM sekaligus dalam satu task sinkron.
- **Kualitas yang terdampak (ISO/IEC 25010):** 
  Time behaviour: Respon input 8808 ms jauh melampaui ambang batas 200 ms.

  Operability: Pengguna kehilangan kendali interaksi akibat penundaan visual.
- **Perbaikan:** Menerapkan debounce 200 ms, melakukan precompute _cariNormal saat muat data, menerapkan progressive rendering (batch 60 kartu via setTimeout(0)), memecah samakanTinggiJudul() menjadi 3 fase terpisah, dan menunda pengiriman analytics.
- **Trade-off:** Kartu off-screen baru muncul 50–200 ms setelah filter jika pengguna melakukan scroll cepat.
- **Hasil:** 
  Metrik | Sebelum | Sesudah | Target
  INP S1 | 8808 ms | 216 ms | ≤ 200 ms ✗
  Long task terlama | 4683 ms | 544 ms | ≤ 100 ms ✗

### T-04: Penataan pemuatan gambar memicu antrean jaringan HTTP/1.1 dan pemborosan kuota
**Tiket terkait**: TK-1081

**Gejala bagi pengguna**: Seluruh gambar produk berupa kotak abu-abu pada 10 detik pertama pemuatan halaman.

**Bukti**: 3000 permintaan gambar dikirim bersamaan di awal; hanya 18 permintaan yang selesai pada detik ke-10.

**Akar masalah dan mekanismenya**:Properti src diset langsung pada ~3000 elemen <img> tanpa loading="lazy". Batasan ~6 koneksi paralel HTTP/1.1 memicu antrean panjang, sehingga gambar di viewport tertahan di belakang ribuan gambar off-screen.

**Kualitas yang terdampak (ISO/IEC 25010)**:
  Resource utilization: Pemborosan kuota untuk gambar yang belum tentu dilihat.
  Time behaviour: Pemuatan konten visual utama (viewport) memakan waktu hingga beberapa menit.
  
**Perbaikan**: Menambahkan atribut loading="lazy" dan decoding="async" pada elemen <img>.

**Trade-off**: Gambar memerlukan jeda 60–300 ms saat pertama kali di-scroll masuk ke viewport.

**Hasil**: 
Metrik | Sebelum | Sesudah | Target | 
Waktu pemuatan gambar viewport | 1,5–2,5 menit | 8,3 detik (sesi) | < 1 detik ✓ | 
Permintaan gambar awal | 3000 | 240 | Sebanding viewport (~22) | 

## 5. Dugaan yang ternyata keliru
1. Dugaan "Server backend lambat/lemot dalam merespons gambar"
2. Dugaan "loading="lazy" dan decoding="async" akan memperbaiki nilai CLS"
3. Dugaan "Pembagian batch 60 kartu pada progressive rendering akan menghilangkan long task > 100 ms"

## 6. Yang belum beres dan rekomendasi
1. Animasi CSS S6 Belum Terselesaikan: Animasi UI seperti teks jam atau lencana flash sale masih berjalan di Main Thread. Rekomendasinya, tim frontend harus meninjau ulang style.css dan memindahkan semua efek animasi (seperti width, left, top, box-shadow) ke properti Compositor-friendly (transform, opacity).
2. Rendering Berat Saat Scroll (S5): Meskipun beban JavaScript telah berkurang pada S5, tahap Rendering tetap memakan waktu 4.199 ms. Jika jumlah kartu produk akan terus bertambah seiring waktu, rekomendasinya adalah menerapkan virtual list atau windowing agar browser hanya merender elemen DOM yang tampak di layar.
3. Optimasi Lanjutan pada Fitur Pencarian (S1 / TK-1041): Metrik INP S1 masih berada di angka 216 ms (target ≤ 200 ms) dan long task terlama masih 544 ms. Rekomendasinya adalah mengevaluasi ulang ukuran batch rendering (BATCH_AWAL) dari 60 menjadi 20–30 kartu per interval, serta memeriksa fungsi dominan secara bottom-up pada long task 544 ms tersebut.
4. Penanganan Pergeseran Tata Letak Gambar / CLS (TK-1078): Pemuatan gambar telah membaik, tetapi nilai CLS S0 masih tinggi (0,439). Rekomendasinya adalah menambahkan atribut eksplisit width dan height atau properti CSS aspect-ratio pada tag <img> agar browser dapat mencadangkan ruang kosong sebelum gambar selesai diunduh.

## 7. Pernyataan penggunaan AI dan pembagian kerja
Alat AI yang dipakai adalah Claude, Gemini digunakan sebagai asisten penulisan untuk membuat boilerplate kode (seperti struktur IntersectionObserver dan pemisahan logika batching BACA-TULIS DOM) serta membantu menyusun draf kalimat atau tata bahasa dalam laporan ini.
Pembagian kontribusi tiap anggota pada praktikum kali ini adalah 
Nurahma Rahayu: Bertanggung jawab menyelesaikan tiket TK-1041, TK-1081, dan sebagian TK-1078. Memodifikasi file katalog.js dan pencarian.js, serta melakukan pengujian pada skenario ukur S0 (permintaan gambar) dan S1.   
M. Fakhri: Bertanggung jawab menyelesaikan tiket TK-1057. Memodifikasi file harga-promo.js, kategori.js, dan util.js, serta melakukan pengujian pada skenario ukur S4.   
Raden Muhammad Farhan: Bertanggung jawab menyelesaikan tiket TK-1044 dan TK-1052. Memodifikasi file keranjang.js dan main.js, serta melakukan pengujian pada skenario ukur S2 dan S3.   
Hana Zahirah: Bertanggung jawab menyelesaikan tiket TK-1063, TK-1070, dan sebagian TK-1078. Memodifikasi file gulir.js, promo.js, toko.css, dan index.html, serta melakukan pengujian pada skenario ukur S5, S6.
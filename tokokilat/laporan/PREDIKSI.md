# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01:Scroll memicu kerja main thread berat tiap event

**Tiket terkait:** TK-1063
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
Banyak frame terlambat (>50 ms) dengan durasi task scroll/touchmove yang panjang. Terlihat "Forced reflow" dan fungsi pelacakan yang mendominasi kerja main thread.
- **Dugaan mekanisme:** `
Pemanggilan getBoundingClientRect() dan penulisan style secara berulang di dalam loop event scroll menyebabkan layout thrashing. Listener non-passive membuat compositor tertahan oleh main thread.
- **Rencana perubahan:** 
1. Ganti getBoundingClientRect dengan IntersectionObserver.
2. Gunakan { passive: true } pada listener scroll/resize; tangani pull-to-refresh via CSS.
3. Pindahkan update visual ke requestAnimationFrame.
4. Ganti animasi width menjadi transform: scaleX().
5. Kumpulkan dan kirim impresi setelah scroll berhenti (debounce).
- **Prediksi terukur:**  
Frame terlambat dan durasi task turun drastis karena layout thrashing hilang.
Efek samping: Impresi telat ~300 ms, pull-to-refresh mati di seluruh halaman, dan efek visual sedikit berubah.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** 1. Throttle: Forced reflow tetap terjadi (hanya frekuensinya berkurang).
2. Batch ke requestAnimationFrame: Tetap membaca layout banyak kartu tiap frame.
3. Virtualisasi daftar: Berada di luar cakupan file yang saya kerjakan
### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-02:Animasi dan timer berjalan terus saat halaman diam

**Tiket terkait:** TK-1070
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
Layout dan Paint terjadi berulang kali walau layar diam. "Timer Fired" membanjiri main thread dan penggunaan CPU tetap tinggi.
- **Dugaan mekanisme:** `
setInterval 10 ms memicu layout thrashing terus-menerus untuk hitung mundur dan teks berjalan. Animasi keyframe lencana memanipulasi top dan box-shadow di main thread tiap frame.
- **Rencana perubahan:** 
1. Ganti hitung mundur garis ke Web Animations (transform: scaleX).
2. Update angka hitung mundur dengan requestAnimationFrame (tulis saat berubah saja).
3. Ubah teks berjalan menjadi CSS transform: translateX.
4. Ganti animasi lencana hanya menggunakan transform dan opacity.
5. Tambahkan aturan prefers-reduced-motion.
- **Prediksi terukur:**  
Layouts/sec dan aktivitas main thread turun drastis, Paint pada lencana berhenti.
Efek samping: Memori GPU berpotensi naik karena layer bertambah, kecepatan/bentuk visual sedikit berbeda, dan teks berjalan tidak otomatis menyesuaikan saat layar diputar.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** 1. Hapus digit perseratus detik: Ditolak karena menghilangkan kebutuhan bisnis.
2. Naikkan interval jadi 100 ms: Siklus baca-tulis layout (thrashing) tetap ada.
3. Hentikan animasi via IntersectionObserver: Disimpan sebagai cadangan jika layer GPU terlalu berat.
### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-03: Halaman bergeser saat banner promo dan konten lain muncul terlambat

**Tiket terkait:** TK-1078
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
Skor CLS sangat tinggi. Terjadi beberapa Layout Shifts besar saat reload, terutama karena banner promo yang muncul belakangan.
- **Dugaan mekanisme:** `
Banner promo di-prepend setelah halaman dimuat tanpa placeholder, sehingga mendorong seluruh konten ke bawah. Footer ikut bergeser karena grid awal kosong. Lebar angka jam berubah-ubah, dan animasi margin-top pada kartu memicu pergeseran.
- **Rencana perubahan:** 
1. Siapkan slot placeholder dengan min-height di HTML statis untuk banner promo.
2. Beri min-height: 100vh pada grid kosong agar footer tidak langsung terlihat di atas.
3. Gunakan font-variant-numeric: tabular-nums untuk angka hitung mundur.
4. Ubah efek muncul kartu menjadi transform dan opacity (bersamaan dengan P-01).
- **Prediksi terukur:**  
CLS turun tajam karena elemen tidak lagi saling mendorong.
Efek samping: Ada ruang kosong permanen jika promo gagal dimuat, slot bisa kurang presisi di layar tertentu, dan tampilan grid kosong setinggi layar mungkin terlihat janggal di awal.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** 1. Sisip banner di server: Tidak diizinkan mengubah file server.js.
2. Tunggu banner sebelum render kartu: Menambah waktu tunggu pengguna (halaman lebih lama putih).
3. Pakai position: fixed / overlay: Mengubah total desain awal tanpa alasan kuat.
### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-04: Tombol "+ Keranjang" tidak merespons — klik berulang menambah item

**Tiket terkait:** TK-1044
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Pada skenario S2 (tekan "+ Keranjang" satu kali), track Interactions menunjukkan INP event
  dengan durasi ~392 ms. Di main thread terlihat satu long task
  panjang segera setelah klik. Pada bottom-up, fungsi yang mengambil porsi terbesar adalah `f`
  dari `lacak.min.js` — bukan kode aplikasi sendiri. Tombol baru berubah teksnya menjadi
  "Ditambahkan ✓" di ujung long task tersebut, bukan di awalnya.

- **Dugaan mekanisme:**
  `tambahKeKeranjang()` memanggil `window.Lacak.kirim('add_to_cart', ...)` secara **sinkron**
  sebelum baris `tombol.textContent = 'Ditambahkan ✓'`. SDK Lacak menjalankan fungsi `f()`
  yang berisi loop 2.000.000 iterasi `Math.imul` (hash FNV) dalam satu task — memblokir
  main thread seluruhnya.

  Urutan eksekusi yang salah di kode lama:
  1. `Lacak.kirim()` dipanggil → task SDK dimulai (2 juta iterasi, ~200–400 ms)
  2. Selama task berjalan: browser tidak bisa merender, tidak bisa memproses event baru
  3. Task selesai → baru `tombol.textContent = 'Ditambahkan ✓'` dieksekusi
  4. Frame dirender → pengguna baru melihat konfirmasi

  Klik-klik yang masuk selama jendela ~200–400 ms (sebelum tombol berubah) sudah antre di
  event queue. Setelah task selesai, tiap klik diproses satu per satu → tiap klik menambah
  satu item ke keranjang.

  Ini adalah masalah **interaction responsiveness** pada fase JS di rendering pipeline:
  satu task panjang memblokir seluruh event loop, termasuk rendering opportunity.

- **Rencana perubahan:**
  1. Pindahkan pembaruan UI (`tombol.textContent`, `classList.add('sudah')`, `tampilkanToast`)
     ke **sebelum** panggilan `Lacak.kirim()`.
  2. Tunda `Lacak.kirim()` ke task berikutnya menggunakan `setTimeout(() => { ... }, 0)`.
     Dengan begitu, frame yang menampilkan "Ditambahkan ✓" sempat dirender sebelum SDK berjalan.
  3. Batasi riwayat yang dikirim ke SDK ke 50 entri terakhir untuk mengurangi beban komputasi
     fungsi `t(s)` (yang proporsional terhadap panjang JSON payload).

- **Prediksi terukur:**
  Setelah perubahan, INP pada S2 turun dari ~392 menjadi < 100 ms, karena task sinkron
  yang dirasakan pengguna sekarang hanya berisi pembaruan DOM (cepat), bukan 2 juta iterasi SDK.
  Long task SDK masih ada, tetapi berjalan di task terpisah setelah frame dirender — tidak
  mempengaruhi INP interaksi tersebut.
  Efek samping yang mungkin: jika pengguna mematikan tab tepat setelah klik (sebelum
  setTimeout(0) sempat jalan), event `add_to_cart` tidak akan terkirim ke SDK.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Web Worker untuk SDK*: tidak bisa karena `lacak.min.js` mengakses `window.document`
    yang tidak tersedia di Worker thread.
  - *Throttle klik dengan flag global*: bisa mencegah klik ganda, tetapi tidak memberikan
    umpan balik visual segera — pengguna tetap tidak tahu apakah tombol sudah bereaksi.
  - *Hapus Lacak.kirim*: melanggar aturan main (setiap event wajib terkirim).
  ### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

## P-05: "Beli sekarang" tiga kali menghasilkan tiga pesanan

**Tiket terkait:** TK-1052
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Pada skenario S3 (tekan "Beli sekarang" tiga kali secepat mungkin), panel Network
  menunjukkan tiga POST request ke `/api/pesanan` yang terpisah. Di terminal server,
  tercetak tiga baris konfirmasi pesanan berbeda. Di main thread, `tombol.textContent`
  baru berubah menjadi "Dipesan ✓" sekitar ~350 ms setelah klik pertama — 
  tepat setelah `await fetch()` selesai.

- **Dugaan mekanisme:**
  `beliSekarang()` adalah fungsi `async`. Tidak ada mekanisme guard apapun di awal fungsi.

  Urutan kejadian yang salah:
  1. Klik ke-1 → `beliSekarang()` mulai → `fetch('/api/pesanan')` diawali (async, ~350 ms)
  2. Selama 350 ms menunggu respons server: tombol masih bertuliskan "Beli sekarang"
  3. Klik ke-2 (selama 350 ms) → `beliSekarang()` dipanggil lagi (tidak ada yang
     memblokirnya) → `fetch` kedua dimulai
  4. Klik ke-3 → `fetch` ketiga dimulai
  5. Tiga respons datang → tiga `pesanan.id` berbeda → tiga pesanan tersimpan di server

  Ini adalah masalah **user error protection**: tidak ada pelindung terhadap aksi berulang
  yang tidak disengaja. Pengguna mengira tombol tidak bereaksi (tidak ada feedback visual
  selama 350 ms) lalu menekan lagi.

- **Rencana perubahan:**
  1. Tambah guard di baris pertama fungsi: cek `tombol.dataset.sedangProses === '1'`, kalau
     ya langsung `return`.
  2. Set `tombol.disabled = true` dan `tombol.textContent = 'Memproses…'` **sebelum**
     `await fetch()` — beri umpan balik visual segera.
  3. Set `tombol.dataset.sedangProses = '1'` di awal, hapus di blok `finally`.
  4. Blok `finally` memastikan tombol selalu aktif kembali, baik fetch berhasil maupun gagal.

- **Prediksi terukur:**
  Setelah perubahan, S3 menghasilkan tepat **1 pesanan** dari 3 klik cepat. Tombol
  menampilkan "Memproses…" dan `disabled` langsung setelah klik pertama, sebelum server
  merespons. INP S3 turun ke < 50 ms (hanya DOM update, tidak ada blocking SDK di jalur kritis
  karena Lacak.kirim juga ditunda ke setTimeout).
  Efek samping: bila jaringan lambat dan `fetch` gagal, pengguna tidak bisa mencoba lagi
  sampai `finally` selesai dieksekusi (tetapi pesan error tetap ditampilkan).

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Debounce klik*: menunda eksekusi tetapi tidak memberikan feedback "sedang memproses",
    pengguna masih tidak tahu apakah pesanan sedang dibuat.
  - *Cek di server (idempotent key)*: solusi yang lebih kuat untuk production, tetapi
    memerlukan perubahan di `server.js` yang tidak boleh diubah per aturan main.
### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....
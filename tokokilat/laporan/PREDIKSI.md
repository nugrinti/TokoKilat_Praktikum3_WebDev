# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01:Scroll memicu kerja main thread berat tiap event

**Tiket terkait:** TK-1063
**Tanggal dan hash commit entri ini:** 01/10/2026 - 42362f5678c7db96740203f4e8cc3e74382f84e6

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

- **Hash commit perbaikan:** 01/10/2026 - 0a56639cd9160507dbed4d5df8f05d5fce0a6f5e
- **Hasil ukur (median 3 kali):**  Waktu Scripting turun dari 2.322 ms menjadi 706 ms. Frame > 50 ms turun dari > 20 menjadi 3-5 kali per 10 detik (target <= 2 belum sepenuhnya tercapai).
- **Prediksi vs kenyataan:** Sebagian. Prediksi bahwa penghapusan layout thrashing akan memuluskan scroll sepenuhnya meleset. Beban JS (Scripting) memang hilang, tetapi bottleneck berpindah ke tahap Rendering (memakan waktu 5.086 ms). Menggambar ulang ratusan elemen DOM secara bersamaan saat digulir tetap membebani Main Thread.
- **Efek samping yang muncul:** Data pelacakan impresi terkirim secara batch dengan jeda 1 detik (debounce), dan interaksi pull-to-refresh bawaan dinonaktifkan.

## P-02:Animasi dan timer berjalan terus saat halaman diam

**Tiket terkait:** TK-1070
**Tanggal dan hash commit entri ini:** 01/10/2026 - 42362f5678c7db96740203f4e8cc3e74382f84e6

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

- **Hash commit perbaikan:** 01/10/2026 - 0a56639cd9160507dbed4d5df8f05d5fce0a6f5e
- **Hasil ukur (median 3 kali):** Waktu Scripting turun menjadi 201 ms. Aktivitas Main Thread saat halaman diam mendekati 0 ms (siklus Painting dan Rendering berulang hilang).
- **Prediksi vs kenyataan:** Sebagian. Menyerahkan animasi murni ke Compositor Thread (menggunakan transform dan opacity) dan menurunkan frekuensi pembaruan DOM untuk teks jam terbukti mengistirahatkan CPU sepenuhnya saat layar statis.
- **Efek samping yang muncul:** Angka perseratus detik (senti) dihilangkan sepenuhnya demi menghemat siklus CPU. Konsumsi memori GPU (VRAM) sedikit meningkat karena komponen lencana dipromosikan menjadi layer kompositor mandiri.

## P-03: Halaman bergeser saat banner promo dan konten lain muncul terlambat

**Tiket terkait:** TK-1078
**Tanggal dan hash commit entri ini:** 01/10/2026 - 42362f5678c7db96740203f4e8cc3e74382f84e6

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

- **Hash commit perbaikan:** 01/10/2026 - 0a56639cd9160507dbed4d5df8f05d5fce0a6f5e
- **Hasil ukur (median 3 kali):** Skor CLS (Cumulative Layout Shift) turun tajam dari 0,85 menjadi 0,04.
- **Prediksi vs kenyataan:** Tepat. Penambahan placeholder statis #slot-promo dengan min-height: 120px berhasil mencegah elemen di bawahnya terdorong saat respons /api/promo selesai. Penggunaan tabular-nums menstabilkan lebar teks hitung mundur.
- **Efek samping yang muncul:** Terdapat ruang kosong permanen (120px) yang terlihat jelas selama beberapa milidetik pertama, atau akan terus kosong jika koneksi pengguna gagal memuat banner.

## P-04: Tombol "+ Keranjang" tidak merespons — klik berulang menambah item

**Tiket terkait:** TK-1044
**Tanggal dan hash commit entri ini:** 10/2/2026 - 92ab030e3afd1947ba6af3f9809f4f6e081e74d4

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

### Sesudah perbaikan

- **Hash commit perbaikan:** 92ab030e3afd1947ba6af3f9809f4f6e081e74d4
- **Hasil ukur (median 3 kali):**
  - INP S2: 144 ms (turun dari 640 ms)
  - Long task terlama: 120 ms (turun dari 805 ms)
  - Total blokir: 1032 ms (turun dari 7682 ms)
- **Prediksi vs kenyataan:** Sebagian tepat.
  INP tepat sesuai prediksi — 144 ms jauh di bawah target 200 ms. Tombol
  merespons segera setelah klik karena pembaruan UI kini terjadi sebelum
  SDK berjalan. Namun long task 120 ms masih di atas target 100 ms.
  Penyebab: task Lacak.kirim yang di-defer tetap memakan ~120 ms karena
  f() menjalankan 2 juta iterasi Math.imul yang bersifat tetap — tidak
  bergantung pada ukuran payload dan tidak bisa dipercepat tanpa mengubah
  lacak.min.js yang dilarang disentuh per aturan main.
- **Efek samping yang muncul:** Tidak ada efek samping fungsional.
  Keranjang hanya bertambah 1 item dari 1 klik. Konfirmasi
  "Ditambahkan ✓" muncul segera tanpa menunggu SDK selesai.
## P-05: "Beli sekarang" tiga kali menghasilkan tiga pesanan

**Tiket terkait:** TK-1052
**Tanggal dan hash commit entri ini:** 10/2/2026 - 92ab030e3afd1947ba6af3f9809f4f6e081e74d4

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
- **Hash commit perbaikan:** 92ab030e3afd1947ba6af3f9809f4f6e081e74d4
- **Hasil ukur (median 3 kali):**
  - Jumlah pesanan dari 3 klik cepat: 1 (turun dari 3)
  - INP S3: 64 ms (turun dari 136 ms)
  - Long task terlama: 83 ms (turun dari 102 ms)
  - Total blokir: 148 ms (turun dari 222 ms)
- **Prediksi vs kenyataan:** Tepat.
  S3 menghasilkan tepat 1 pesanan dari 3 klik cepat — bug pesanan ganda
  sepenuhnya teratasi. Tombol menampilkan "Memproses…" dan disabled
  segera setelah klik pertama sehingga klik ke-2 dan ke-3 diabaikan oleh
  guard flag. Semua target terpenuhi: INP 64 ms (target ≤ 200 ms),
  long task 83 ms (target ≤ 100 ms).
- **Efek samping yang muncul:** Tidak ada. Bila fetch gagal karena
  gangguan jaringan, blok finally memastikan tombol aktif kembali dan
  pesan error ditampilkan ke pengguna.

## P-06: Pencarian lambat per keystroke

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 01-10-2026-5fb2a0c599827b597902cb46a6deb6e7bbcada9a

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Event handler input pada pencarian.js (baris 45, callback kolom.addEventListener) tercatat sebagai satu blok eksekusi sinkron per keystroke, yang menurun seiring hasil pencarian yang semakin spesifik:

  Huruf "s": 3997,8 ms
  Huruf ke-2: 2160,4 ms
  Huruf ke-3: 484,0 ms
  Huruf ke-4: 403,3 ms
  Huruf ke-5: 398,8 ms
  Huruf ke-6: 393,9 ms

  Breakdown keystroke pertama (3997,8 ms): 2462,6 ms (62%) habis di Layout, 27 kali forced layout, rata-rata ~91 ms per pemanggilan, konsisten dengan samakanTinggiJudul() yang menulis style.height='auto' lalu langsung membaca offsetHeight dalam loop (layout thrashing). Sisanya ~1535 ms merupakan JavaScript murni: normalkan() dipanggil ulang per produk setiap kali filter berjalan, serta renderProduk() membuat ribuan elemen DOM sekaligus (keystroke pertama "s" mencocokkan ~2897 produk, hampir seluruh katalog, dan 2897 request gambar dikirim secara bersamaan dalam rentang 659 ms begitu render selesai, karena <img src> diatur langsung tanpa lazy-load, hal ini juga menjadi bukti kuat untuk TK-1081, bukan hanya S0).

  Dari alat ukur: INP 8808 ms pada interaksi keydown di #kolom-cari, 8805 ms di antaranya berada pada fase presentasi (menunggu browser menggambar ulang layar), long task terpanjang tercatat 4683 ms.

- **Dugaan mekanisme:**
  (1) Setiap event input langsung memanggil terapkanSaringan() secara sinkron tanpa debounce, sehingga setiap huruf = satu filter + render penuh. (2) normalkan() membutuhkan waktu lama karena dipanggil ulang per produk (nama + merek + kategori + kota) setiap kali filter berjalan; dengan ~3000 produk ini berarti ribuan normalisasi string per keystroke, yang masuk sebagai bagian dari long task yang sama. (3) renderProduk() membutuhkan waktu lama karena membuat seluruh elemen DOM hasil filter dalam satu task sinkron; jika hasilnya ribuan produk, proses ini sendiri dapat menjadi long task yang besar. Ketiganya menumpuk dalam satu task yang sama, menutup rendering opportunity, dan membuat input terasa mengalami penundaan (delay) atau terhenti (hang).

- **Rencana perubahan:**
  1. Debounce 200 ms pada listener input, agar hanya satu filter yang berjalan setelah pengguna berhenti mengetik.

  2. Precompute _cariNormal (hasil normalisasi) satu kali saat muatProduk(), lalu menyimpannya di setiap objek produk. Filter saat mengetik hanya perlu menggunakan .includes() pada string yang sudah jadi, tanpa melakukan normalisasi ulang.

  3. Progressive render pada renderProduk(): merender 60 kartu pertama secara sinkron (task pertama berukuran kecil), sedangkan sisanya dicicil melalui setTimeout(0) per batch 60 kartu, menggunakan penanda generasi agar batch lama secara otomatis dibatalkan jika pengguna mengetik huruf baru sebelum batch selesai (menghindari race condition atau kartu yang salah tempat).

  4. samakanTinggiJudul() dipecah menjadi tiga fase terpisah (batch write → batch read → batch write) agar forced layout hanya terjadi satu kali per render, bukan berkali-kali per judul.

  5. Pengiriman Lacak.kirim('search') ditunda ke setTimeout(0) tersendiri, terpisah dari task render, agar tidak menambah durasi task yang dirasakan oleh pengguna.

- **Prediksi terukur:**
  INP S1 turun dari 8808 ms jadi di bawah 200ms, dan tidak ada long task >100ms selama mengetik. Efek samping yang mungkin muncul: kartu yang posisinya di bawah layar pertama baru tampil 50-200ms setelah filter (karena progressive render), berpotensi terasa jika user scroll cepat sebelum batch selesai.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  Web Worker untuk proses filter ditolak, karena overhead komunikasi worker (serialize/deserialize data produk) tidak sepadan untuk ukuran data sebesar ini, dan state tetap harus dikembalikan ke main thread untuk merender DOM.

### Sesudah perbaikan

- **Hash commit perbaikan:** c97819ff94d707e9b1e9c19e9b581693c5aec8f9
- **Hasil ukur (median 3 kali):** INP 216ms (dari 8808ms), long task terlama 544ms (dari 4683ms), jumlah long task 71 (dari 689), total waktu main thread terblokir 4770ms (dari 21665ms).
- **Prediksi vs kenyataan:** Sebagian meleset. INP turun secara drastis, tetapi 216 ms masih sedikit di atas target 200 ms mendekati target, namun belum memenuhi kualifikasi. Hal yang lebih jelas meleset: prediksi "tidak ada long task >100 ms" tidak terbukti, long task terlama masih 544 ms. Model mental yang perlu dikoreksi: batch 60 kartu per render ternyata masih cukup berat untuk memenuhi ambang batas 100 ms pada CPU 4x throttle (bukan nol seperti yang diprediksi), terdapat kemungkinan BATCH_AWAL=60 perlu diperkecil, atau forced layout pada samakanTinggiJudul() batch pertama (yang tetap sinkron) masih menjadi kontributor utama dari sisa durasi 544 ms tersebut. Perlu dilakukan pemeriksaan kembali terhadap fungsi yang dominan pada long task 544 ms ini (bottom-up) untuk memastikan.
- **Efek samping yang muncul:** Interaksi paling lambat pada alat ukur tercatat sebagai click di #kolom-cari (bukan keydown),terdapat kemungkinan klik pertama ke kolom pencarian ikut terdampak long task sisa dari render sebelumnya, bukan hanya masalah mengetik.

## P-07: Gambar lambat muncul + boros kuota

**Tiket terkait:** TK-1081
**Tanggal dan hash commit entri ini:** 01-10-2026-5fb2a0c599827b597902cb46a6deb6e7bbcada9a+

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Dari rekaman S0 : /api/produk selesai dengan cepat (~190–280 ms), bukan merupakan bottleneck. Setelah itu, membangun dan melakukan layout pada 3000 kartu sekaligus membutuhkan waktu yang signifikan di main thread (UpdateLayoutTree >1400 ms). Secara langsung teramati di layar: dalam 10 detik pertama, belum ada satu pun gambar produk yang muncul, seluruhnya berupa kotak abu-abu, termasuk yang berada di layar pertama. Gambar baru mulai terlihat setelah beberapa menit. Jumlah baris "18" di Network tab filter Img tepat pada detik ke-10 dari total 3000 request yang dicoba dikirim sekaligus.

- **Dugaan mekanisme:**
  gambar.src diatur secara langsung saat setiap kartu dibuat, untuk seluruh produk hasil render sekaligus, bukan hanya yang terlihat di viewport. Tidak ada loading="lazy" atau mekanisme penundaan lainnya. Server menambahkan latensi 60–300 ms per gambar secara asinkron (simulasi CDN, non-blocking, diperiksa di server.js, bukan dalam ruang lingkup yang diizinkan untuk diubah). Masalah sebenarnya bukan di situ, melainkan pada batasan koneksi paralel browser (~6 koneksi bersamaan per origin, HTTP/1.1): saat 3000 <img src> diatur sekaligus, 3000 request tersebut mengantre hanya melalui 6 "jalur". Total waktu hingga gambar terakhir selesai menjadi ≈ (3000 ÷ 6) × 60–300 ms ≈ 1,5–2,5 menit, jauh melebihi rentang waktu 10 detik pada protokol S0. Dalam 10 detik pertama, bahkan gambar yang terlihat di layar ikut mengantre di belakang ribuan gambar yang belum tentu pernah digulir oleh pengguna. Hal ini juga sekaligus menjawab dugaan Pak Hendra mengenai "server lambat": servernya cepat per request, sedangkan yang lambat adalah cara frontend memaksa ribuan request bersaing di koneksi yang terbatas.

- **Rencana perubahan:**
  Menambahkan loading="lazy" dan decoding="async" ke setiap <img>. Browser secara otomatis menunda pengambilan gambar sampai elemennya mendekati viewport, dan proses decode gambar tidak memblokir main thread.

- **Prediksi terukur:**
  Jumlah request gambar saat S0 turun dari 3000 menjadi sebanding dengan kartu yang terlihat di layar pertama. Target ~22, berdasarkan pengukuran versi dengan loading="lazy" aktif: 22 gambar selesai dalam 749 ms untuk viewport 412x915. Waktu penyelesaian gambar terakhir (yang terlihat) turun dari 1,5–2,5 menit menjadi di bawah 1 detik, karena tidak lagi berebut 6 slot koneksi dengan ribuan gambar di luar layar (off-screen). Kuota data per kunjungan turun secara drastis karena gambar yang tidak pernah digulir tidak lagi diambil sama sekali.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  Preload seluruh gambar tetapi menggunakan fetchpriority="low" ditolak, karena tetap mengirimkan seluruh request di awal meskipun prioritasnya rendah, tidak sesuai dengan target "request sebanding dengan kartu yang terlihat".

### Sesudah perbaikan

- **Hash commit perbaikan:** c97819ff94d707e9b1e9c19e9b581693c5aec8f9
- **Hasil ukur (median 3 kali):** CLS 0,439 (target ≤0,1). Total 240 request gambar sepanjang sesi rekaman (bukan hanya ~22 viewport awal — kemungkinan rekaman mencakup lebih dari 10 detik kondisi diam murni, misalnya ada aktivitas scroll). Gambar pertama diminta secara langsung di awal, dan seluruh 240 request tuntas dalam 8,3 detik (dibandingkan 1,5–2,5 menit sebelumnya).
- **Prediksi vs kenyataan:** Sebagian meleset. Jumlah dan kecepatan request gambar membaik secara drastis (sesuai arah prediksi, meskipun 240 bukan ~22 — perlu diperiksa apakah rekaman ini murni S0 diam 10 detik atau terdapat interaksi/scroll yang ikut terekam). Namun, CLS 0,439 jauh di atas target ≤0,1 — hal ini meleset secara total. Model mental yang salah: loading="lazy" + decoding="async" hanya memperbaiki JUMLAH dan WAKTU request gambar, tidak memesan ruang untuk tampilan gambar. CLS tetap tinggi karena <img> masih belum memiliki width/height/aspect-ratio (ini P-A2/TK-1078, perbaikan terpisah yang belum dikerjakan). Dua masalah yang tampaknya berkaitan (gambar lambat vs halaman melompat) ternyata membutuhkan dua perbaikan yang independen.
- **Efek samping yang muncul:** Belum ada efek samping baru dari lazy-load itu sendiri; CLS tinggi di atas merupakan masalah lama (TK-1078) yang belum ditangani, bukan regresi baru dari perbaikan ini.


## P-08: Kalkulasi voucher memblokir Main Thread (UI Freeze)

**Tiket terkait:** TK-1057
**Tanggal dan hash commit entri ini:** 2/10/2026-909955622b5e15a6083ef49cf4e66a44611620cf

### Sebelum perbaikan

- **Yang teramati di trace (baseline):**
  Pada Skenario 4, terlihat satu task raksasa (Long Task) berdurasi lebih dari 7 detik yang menahan main thread. Metrik INP meroket tajam hingga 7243 ms. Selama task ini berjalan (fase *Processing Time*), rendering pipeline sepenuhnya terblokir sehingga layar tidak ter-update dan tidak bisa merespons event input (seperti scroll atau ketikan di kolom pencarian).
- **Dugaan mekanisme:**
  Loop berat pada kalkulasi voucher KILAT1212 di `terapkanVoucher` dieksekusi sekaligus secara sinkron, tanpa memberikan jeda kepada event loop. Pernyataan Rudi bahwa fungsi "sudah `async`" terbukti salah kaprah secara konsep; fungsi berlabel `async` tetap akan memblokir main thread jika di dalamnya terdapat eksekusi loop komputasi sinkron secara berkelanjutan. Browser tidak mendapat *rendering opportunity* untuk memperbarui UI persentase "menghitung x%".
- **Rencana perubahan:**
  Memecah loop kalkulasi yang panjang menjadi *chunk* (kelompok tugas kecil) dengan memanfaatkan `setTimeout` atau `requestAnimationFrame`. Setelah sejumlah iterasi (misalnya per batch data), kontrol dikembalikan (yield) ke browser agar bisa memproses interaksi pengguna dan merender ulang teks progres.
- **Prediksi terukur:**
  INP untuk S4 akan turun drastis di bawah atau mendekati target 200 ms. Progres penghitungan di UI tidak lagi langsung loncat ke "selesai", melainkan bergerak bertahap, dan pengguna bisa scroll/mengetik selama proses berjalan.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - *Web Worker*: Sangat ideal untuk komputasi berat, namun memerlukan mekanisme *message passing* untuk UI update, yang mungkin dirasa berlebihan jika memecah *chunk* saja sudah mengembalikan responsivitas.

### Sesudah perbaikan

- **Hash commit perbaikan:** 909955622b5e15a6083ef49cf4e66a44611620cf
- **Hasil ukur (median 3 kali):** INP turun menjadi 214 ms. Terdapat beberapa *Long Task* berukuran kecil (di bawah 120 ms), tidak lagi satu blok besar.
- **Prediksi vs kenyataan:** Tepat. Dengan pemecahan tugas (chunking), browser mendapatkan celah di antara task untuk menjalankan event input dan mengecat ulang piksel layar (Paint).
- **Efek samping yang muncul:** Total waktu selesainya seluruh komputasi voucher (wall-clock time) mungkin sedikit bertambah panjang akibat jeda *overhead* dari penjadwalan `setTimeout` antar chunk.
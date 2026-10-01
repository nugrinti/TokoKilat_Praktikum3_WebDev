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

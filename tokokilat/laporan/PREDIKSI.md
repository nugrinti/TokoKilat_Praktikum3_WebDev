# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01:Scroll memicu kerja main thread berat tiap event

**Tiket terkait:** TK-1063
**Tanggal dan hash commit entri ini:** ....

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** S5 (scroll 10 dtk): 141 long task, terlama
  1.307 ms, total blokir 7.194 ms (~72% waktu). 171 frame > 50 ms (terburuk 1.383 ms).
- **Dugaan mekanisme:** `periksaGulir()` terpasang tanpa throttle di event `scroll`/`wheel`/
  `touchmove` berfrekuensi tinggi; tiap panggilan melakukan `querySelectorAll('.kartu')`
  + `getBoundingClientRect()` ke semua kartu sehingga forced layout berulang (layout thrashing),
  menghasilkan long task beruntun tiap event scroll.
- **Rencana perubahan:** Ganti `periksaGulir` dengan `requestAnimationFrame` (1x per frame),
  ganti deteksi visibilitas kartu dari `querySelectorAll` semua kartu ke `IntersectionObserver`
- **Prediksi terukur:**  Frame > 50 ms turun dari 171 jadi ≤2/10 detik, long task mendekati 0,
  karena kerja dibatasi 1x/frame dan dikurangi cakupannya.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Debounce dengan `setTimeout`
  (mis. 100 ms). Tidak dipilih karena scroll butuh update visual (bayangan header, progress
  bar baca) yang terasa halus, bukan tertunda; rAF lebih cocok untuk kerja terkait rendering

### Sesudah perbaikan

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....

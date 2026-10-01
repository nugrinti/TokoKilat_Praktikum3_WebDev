# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: Gemini  Branch atau commit tempat usulan diterapkan: audit-ai

---

## A-01:AI menggunakan throttle alih-alih menyelesaikan layout thrashing

- **Tiket yang diminta diperbaiki:** TK-1063
- **Prompt yang diberikan (ringkas):** Tolong optimasi fungsi scroll di katalog.js. Saat menggulir halaman, FPS drop parah dan patah-patah. Sepertinya event listener-nya terlalu berat.
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** AI menyarankan untuk membungkus handler scroll menggunakan fungsi throttle dari Lodash (atau custom function) agar fungsi tidak dipanggil setiap piksel // Usulan AI
window.addEventListener('scroll', throttle(() => {
  periksaGulir();
}, 100)); // Dibatasi maksimal berjalan tiap 100ms

- **Jenis masalah pada usulan:** pilih satu atau lebih
  - [x] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** 
Sebelum:
Sesudah:
- **Mengapa AI bisa keliru di sini:** AI memberikan solusi textbook untuk event scroll, yaitu throttling atau debouncing. AI tidak tahu bahwa masalah utamanya bukan pada frekuensi pemanggilan event, melainkan pada apa yang ada di dalam fungsi tersebut (loop getBoundingClientRect yang diselingi penulisan DOM).
- **Perbaikan yang benar menurut tim:** Menghapus event listener scroll sepenuhnya dan menggantinya dengan IntersectionObserver, serta menggunakan requestAnimationFrame untuk penulisan visual.

---

## A-02:AI menghentikan JS timer, tapi mengabaikan Paint/Layout dari CSS

- **Tiket yang diminta diperbaiki:** TK-1070
- **Prompt yang diberikan (ringkas):** Baterai perangkat cepat habis walau halaman diam. Ini kode JS untuk timer promo dan efek lencana di promo.js. Tolong perbaiki agar tidak berjalan terus saat di luar layar.
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** AI menyarankan penggunaan IntersectionObserver untuk menghentikan setInterval jika elemen timer keluar dari viewport.
// Usulan AI
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    interval = setInterval(updateHitungMundur, 10);
  } else {
    clearInterval(interval);
  }
});
observer.observe(document.querySelector('.wadah-promo'));

- **Jenis masalah pada usulan:** pilih satu atau lebih
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** 
Sebelum:
Sesudah:
- **Mengapa AI bisa keliru di sini:** AI terlalu fokus pada potongan kode JavaScript yang saya berikan di prompt. Ia tidak memiliki konteks panel Layers atau alat Paint flashing di DevTools yang menunjukkan bahwa CSS-lah penyumbang kerja main thread yang terus-menerus. AI tidak bisa "melihat" halaman berkedip merah.
- **Perbaikan yang benar menurut tim:** Memindahkan animasi lencana ke CSS transform dan opacity (berjalan di compositor), serta mengubah setInterval menjadi requestAnimationFrame yang efisien.

---

## Refleksi (maks. 200 kata)
Di dalam tugas optimasi performa web, AI sangat membantu untuk menulis atau menata ulang sintaks, hal ini menghemat waktu pengetikan secara signifikan. Namun, kami harus sangat waspada pada fase diagnosis dan penentuan arsitektur perbaikan. AI beroperasi dengan asumsi heuristik berdasarkan kode sumber statis, bukan berdasarkan data runtime. AI tidak memahami konsep hambatan (bottleneck) di main thread, layout thrashing, atau interaksi antara compositor dan JS kecuali diberi tahu secara eksplisit. Oleh karena itu, Performance Trace harus selalu menjadi kompas utama bagi pengembang, baru setelah itu AI digunakan sebagai asisten untuk mengeksekusi solusi yang sudah kita tentukan arahnya.

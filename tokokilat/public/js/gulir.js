import { $ } from './util.js';

const sudahTercatat = new Set();
let antrianImpresi = [];
let pewaktuImpresi;

function kirimImpresi() {
  clearTimeout(pewaktuImpresi);
  if (!antrianImpresi.length) return;
  const produk = [...antrianImpresi];
  antrianImpresi = [];
  if (window.Lacak) window.Lacak.kirim('impression', { produk });
}

function jadwalkanImpresi() {
  clearTimeout(pewaktuImpresi);
  pewaktuImpresi = setTimeout(() => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(kirimImpresi, { timeout: 2000 });
    } else {
      kirimImpresi();
    }
  }, 1000);
}

const pengamat = new IntersectionObserver((daftar) => {
  let adaBaru = false;
  for (const e of daftar) {
    const kartu = e.target;
    kartu.classList.toggle('di-layar', e.isIntersecting);
    if (!e.isIntersecting) continue;
    kartu.classList.add('terlihat');
    const id = kartu.dataset.id;
    if (!sudahTercatat.has(id)) {
      sudahTercatat.add(id);
      antrianImpresi.push(id);
      adaBaru = true;
    }
  }
  if (adaBaru) jadwalkanImpresi();
}, { rootMargin: '80px 0px' });

let yGulir = 0;
let tinggiMaks = 0;
let menunggu = false;
let melayang = false;
let tampilKeAtas = false;
let kepalaEl, barEl, keAtasEl;

function ukurTinggi() {
  tinggiMaks = document.documentElement.scrollHeight - window.innerHeight;
}

function gambarStatus() {
  menunggu = false;
  if (!barEl) return;
  const y = yGulir; 
  const naik = y > 8;
  if (naik !== melayang) { melayang = naik; kepalaEl.classList.toggle('melayang', naik); }
  const tampil = y >= 900;
  if (tampil !== tampilKeAtas) { tampilKeAtas = tampil; keAtasEl.hidden = !tampil; }
  
  const skala = tinggiMaks > 0 ? Math.min(y / tinggiMaks, 1) : 0;
  
  barEl.style.transform = `scaleX(${skala})`; 
}

function jadwalkanStatus() {
  if (menunggu) return;
  menunggu = true;
  requestAnimationFrame(gambarStatus);
}

export function observasiKartu(kartu) {
  pengamat.observe(kartu);
}

export function periksaGulir() {
  pengamat.disconnect();
  document.querySelectorAll('.kartu').forEach((kartu) => pengamat.observe(kartu));
  jadwalkanStatus();
}

export function pasangGulir() {
  kepalaEl = $('#kepala');
  barEl = $('#bar-gulir');
  keAtasEl = $('#ke-atas');

  window.addEventListener('scroll', () => { yGulir = window.scrollY; jadwalkanStatus(); }, { passive: true });
  window.addEventListener('resize', () => { ukurTinggi(); jadwalkanStatus(); }, { passive: true });
  new ResizeObserver(() => { ukurTinggi(); jadwalkanStatus(); }).observe(document.body);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') kirimImpresi();
  });
  window.addEventListener('pagehide', kirimImpresi);

  if (keAtasEl) keAtasEl.addEventListener('click', () => window.scrollTo({ top: 0 }));

  yGulir = window.scrollY;
  ukurTinggi();
  jadwalkanStatus();
}
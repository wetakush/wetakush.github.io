/* ============================================================
   БИО ЗА РОДИНУ v1.0 — движок кринжа
   музыка: собачий вальс на расстроенном пианино + спидкор-808
   (синтезируется на месте, как в 3100 году)
   ============================================================ */
'use strict';
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndi = (a,b) => Math.floor(rnd(a,b+1));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

/* ============================================================
   ПРЕЛОАДЕР: 0...99% и ЗАСТРЯВАЕТ (так надо)
   ============================================================ */
const plFill = $('#plFill'), plPct = $('#plPct'), plEnter = $('#plEnter');
let plDone = false;

(function preload(){
  let p = 0;
  const iv = setInterval(()=>{
    if(plDone){ clearInterval(iv); return; }
    p = Math.min(99, p + rnd(3,11));
    plFill.style.width = p + '%';
    plPct.textContent = Math.floor(p) + '%';
    if(p >= 99){
      clearInterval(iv);
      plPct.textContent = '99%';
      setTimeout(()=>{
        plPct.textContent = '99% (осталось чуть-чуть)';
      }, 900);
      setTimeout(()=>{
        plEnter.classList.remove('hidden');
        plPct.textContent = 'ладно. 100%. заходи.';
        plFill.style.width = '100%';
      }, 2100);
    }
  }, 120);
})();

plEnter.addEventListener('click', ()=>{
  plDone = true;
  const pl = $('#preload');
  pl.style.transition = 'transform .5s cubic-bezier(.34,1.56,.64,1), opacity .5s';
  pl.style.transform = 'translateY(-110%) rotate(-4deg)';
  pl.style.opacity = '0';
  setTimeout(()=>pl.remove(), 600);
  spawnParticles(window.innerWidth/2, window.innerHeight/2, ['🎉','💀','🔥','💰'], 14);
  toast('ДОБРО ПОЖАЛОВАТЬ!!! 👋 (веди себя хорошо)');
});

/* ============================================================
   МУЗЫКА: собачий вальс, расстроенное пианино, 165 bpm
   ============================================================ */
const N = {
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99,
  C3:130.81, G3:196.00, A3:220.00, F3:174.61, E3:164.81, D3:146.83,
  C2:65.41, F2:87.31, G2:98.00, A2:110.00, E2:82.41, D2:73.42, B2:123.47
};

class HonkyEngine {
  constructor(){
    this.ctx = null; this.playing = false;
    this.bpm = 165; this.step = 0; this.nextTime = 0;
    this.timer = null; this.detuneSeed = rnd(-30,30);
  }
  init(){
    if(this.ctx) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value=-16; this.comp.ratio.value=5; this.comp.attack.value=.003;
    this.analyser = c.createAnalyser(); this.analyser.fftSize=128;
    this.comp.connect(this.analyser); this.analyser.connect(this.master);
    this.master.connect(c.destination);
    this.bus = c.createGain(); this.bus.gain.value=.8; this.bus.connect(this.comp);
    /* гудок парохода посылается прямо в bus */
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
  }
  /* расстроенная нота пианино: 2-3 расстроенных осциллятора */
  note(t, f, v=1, dur=.3){
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(.34*v, t);
    g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    /* лёгкий "бум" молоточка */
    const knock = c.createOscillator(); knock.frequency.value = f*3.02;
    const kg = c.createGain(); kg.gain.setValueAtTime(.12*v,t);
    kg.gain.exponentialRampToValueAtTime(.0001, t+.03);
    knock.connect(kg); kg.connect(g); knock.start(t); knock.stop(t+.05);
    [-9.5, 4, 12.3].forEach((cents,i)=>{       /* РАССТРОЕННОСТЬ */
      const o = c.createOscillator();
      o.type = i===2 ? 'triangle' : 'square';
      o.frequency.value = f;
      o.detune.value = cents + this.detuneSeed*.2;
      const og = c.createGain(); og.gain.value = i===2 ? .25 : 1;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t+dur+.05);
    });
    g.connect(this.bus);
  }
  bass(t, f, dur=.32, v=1){
    const c=this.ctx, o=c.createOscillator(), g=c.createGain();
    o.frequency.setValueAtTime(f*2,t);
    o.frequency.exponentialRampToValueAtTime(f,t+.04);
    g.gain.setValueAtTime(.5*v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t+dur+.05);
  }
  kick(t,v=1){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(40,t+.09);
    g.gain.setValueAtTime(.8*v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.3);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t+.35);
  }
  hat(t,v=1){
    const c=this.ctx,s=c.createBufferSource(); s.buffer=this.noiseBuf;
    const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=9000;
    const g=c.createGain(); g.gain.setValueAtTime(.16*v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.04);
    s.connect(f);f.connect(g);g.connect(this.bus);
    s.start(t,rnd(0,.5)); s.stop(t+.06);
  }
  whistle(t){ /* пароход! */
    const c=this.ctx,o=c.createOscillator(),g=c.createGain(),lfo=c.createOscillator(),lg=c.createGain();
    o.type='square'; o.frequency.value=N.D4*1.5;
    lfo.frequency.value=6; lg.gain.value=9; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(.0001,t);
    g.gain.linearRampToValueAtTime(.11,t+.08);
    g.gain.setValueAtTime(.11,t+.5);
    g.gain.exponentialRampToValueAtTime(.0001,t+.9);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t+1); lfo.start(t); lfo.stop(t+1);
  }
  start(){
    this.init();
    if(this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + .08;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(.55, this.ctx.currentTime+.4);
    this.timer = setInterval(()=>this.tick(), 25);
  }
  stop(){
    this.playing=false; clearInterval(this.timer);
    if(this.ctx) this.master.gain.linearRampToValueAtTime(0,this.ctx.currentTime+.25);
  }
  tick(){
    while(this.nextTime < this.ctx.currentTime + .12){
      this.schedule(this.step, this.nextTime);
      this.nextTime += 60/this.bpm/4;
      this.step++;
    }
  }
  schedule(step, t){
    const s = step % 16, bar = Math.floor(step/16);
    /* СОБАЧИЙ ВАЛЬС (Chopsticks), 32 шага */
    const MEL = [
      'E4','E4','F4','G4','G4','F4','E4','D4','C4','C4','D4','E4','E4','D4','D4',0,
      'E4','E4','F4','G4','G4','F4','E4','D4','C4','C4','D4','E4','D4','C4','C4',0
    ];
    const BASSP = ['C3','G3','C3','G3','F3','C3','G3','G2',
                   'C3','G3','C3','G3','F3','G3','C3','C2'];
    const mel = MEL[step % 32];
    if(mel){
      let f = N[mel];
      /* 12% шанс СЫГРАТЬ НЕ ТУ НОТУ (специально) */
      if(Math.random() < .12){
        const keys = Object.keys(N).filter(k=>N[k]>250 && N[k]<900);
        f = N[keys[rndi(0,keys.length-1)]];
      }
      this.note(t, f, rnd(.8,1), rnd(.22,.4));
    }
    if(s===0 || s===4 || s===8 || s===12){
      this.bass(t, N[BASSP[s/4 + (bar%2)*8]] || N.C3);
      this.kick(t, s===0?1:.75);
    }
    if(s===8) this.hat(t,1.2);
    if(s%2===1) this.hat(t,.5);
    /* ГУДОК ПАРОХОДА каждые 8 тактов — потому что почему нет */
    if(bar%8===0 && s===14) this.whistle(t + 60/this.bpm/4);
  }
}
const HE = new HonkyEngine();

const soundBtn = $('#soundBtn');
let soundOn = false;
soundBtn.addEventListener('click', ()=>{
  soundOn = !soundOn;
  if(soundOn){
    HE.start();
    soundBtn.textContent = '🔇 ВЫКЛЮЧИТЬ (но зачем)';
    toast('🎵 МУЗЫКА ВКЛЮЧЕНА. это собачий вальс. не благодари');
    spawnParticles(rnd(60,innerWidth-60), rnd(100,300), ['🎵','🎶',' piano'], 8);
  } else {
    HE.stop();
    soundBtn.textContent = '🎵 ВКЛЮЧИТЬ МУЗЫКУ (ОБЯЗАТЕЛЬНО)';
  }
});

/* ============================================================
   СЧЁТЧИК ПОСЕТИТЕЛЕЙ (честный на 60%)
   ============================================================ */
(function visits(){
  const KEY = 'wetrash_visits';
  let v = +(localStorage.getItem(KEY) || rndi(300,900));
  v++;
  localStorage.setItem(KEY, v);
  $('#visitCounter').textContent = String(v).padStart(7,'0');
})();

/* ============================================================
   СКИЛЛ-БАРЫ
   ============================================================ */
const io = new IntersectionObserver(es=>{
  es.forEach(e=>{
    if(!e.isIntersecting) return;
    const bar = e.target;
    if(!bar.dataset.done){
      bar.dataset.done = 1;
      setTimeout(()=>bar.style.width = bar.dataset.val + '%', 200);
    }
    io.unobserve(bar);
  });
},{threshold:.4});
$$('.sk-bar i').forEach(b=>io.observe(b));

/* ============================================================
   КЛИК ПО ИМЕНИ → ЖЕСТЬ
   ============================================================ */
const ZH = ['ЖЕСТЬ!!!','ВОТ ЭТО БИО','ТЫ КЛИКНУЛ)','СИЛА','КРАСАВА','пианино не пострадало','(звук собачьего вальса усилился)'];
$('#bigName').addEventListener('click', e=>{
  spawnParticles(e.clientX, e.clientY, ['💥','💀','🔥','⚡','🎉'], 12);
  toast(ZH[rndi(0,ZH.length-1)]);
  if(HE.playing){ /* форте! */
    const t = HE.ctx.currentTime;
    HE.note(t, N.C5, 1.4, .5); HE.note(t, N.E5, 1.2, .5); HE.note(t, N.G5, 1.3, .6);
  }
});

/* ============================================================
   КНОПКА "НЕ НАЖИМАТЬ" → ДИСКО
   ============================================================ */
let disco = false;
$('#dontPress').addEventListener('click', ()=>{
  disco = !disco;
  document.body.classList.toggle('disco', disco);
  if(disco){
    if(!HE.playing){ HE.start(); soundOn = true; soundBtn.textContent = '🔇 ВЫКЛЮЧИТЬ (но зачем)'; }
    toast('💀 ТЫ НАЖАЛ. Я ЖЕ ГОВОРИЛ. РЕЖИМ ДИСКО ВКЛЮЧЁН');
    for(let i=0;i<5;i++) setTimeout(()=>spawnParticles(rnd(50,innerWidth-50), rnd(100,500), ['🪩','💃','🕺','✨'], 6), i*300);
  } else {
    toast('фу. скучный. (диско выключено)');
  }
});

/* ============================================================
   ОПРОС + УБЕГАЮЩАЯ КНОПКА "НЕТ"
   ============================================================ */
const pollNo = $('#pollNo'), pollBar = $('#pollBar'), pollTxt = $('#pollTxt');
let noScore = 0;
$('#pollYes').addEventListener('click', ()=>{
  pollBar.style.width = '100%';
  pollTxt.textContent = 'ДА: 100% · НЕТ: 0% (правильно)';
  toast('👍 ОТЛИЧНЫЙ ВЫБОР. ты человек вкуса');
  spawnParticles(innerWidth/2, innerHeight/2, ['👍','⭐','🏆'], 14);
});
pollNo.addEventListener('mouseenter', runAway);
pollNo.addEventListener('click', e=>{
  noScore++;
  if(noScore >= 5){
    pollBar.style.width = '99%';
    pollTxt.textContent = 'ДА: 99.9% · НЕТ: ладно 0.1%';
    toast('💀 ЛАДНО ТЫ ПОБЕДИЛ. 0.1% ТВОИ');
    pollNo.textContent = '👎 ладно';
    return;
  }
  runAway.call(pollNo, e);
  toast(['кнопка убежала','попробуй ещё','не сегодня','это бесполезно','кнопка тренируется'][rndi(0,4)]);
});
function runAway(){
  if(this.disabled) return;
  this.style.transform = `translate(${rndi(-160,160)}px, ${rndi(-60,60)}px) rotate(${rndi(-20,20)}deg)`;
}
/* тач-устройства: просто убегает по тапу */
pollNo.addEventListener('touchstart', function(e){ e.preventDefault(); runAway.call(this); }, {passive:false});

/* ============================================================
   ГОСТЕВАЯ КНИГА
   ============================================================ */
const GKEY = 'wetrash_guestbook';
function getGuests(){
  try{ return JSON.parse(localStorage.getItem(GKEY)) || []; }
  catch(e){ return []; }
}
const DEFAULT_GUESTS = [
  {n:'хакер из 2007', t:'сайт говно но мне нравится +++', d:'01.01.2007'},
  {n:'мама веты', t:'сынок хороший', d:'всегда'},
  {n:'аноним', t:'нашёл тут 3 бага. в тексте. исправь', d:'сегодня'},
];
function renderGuests(){
  const list = $('#guestList');
  const all = DEFAULT_GUESTS.concat(getGuests());
  list.innerHTML = all.map(g=>
    `<div class="guest-entry"><b>${escapeHtml(g.n)}</b> пишет:<span class="tiny">${escapeHtml(g.t)}</span><span class="tiny">📅 ${escapeHtml(g.d||'')}</span></div>`
  ).join('');
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
$('#guestForm').addEventListener('submit', e=>{
  e.preventDefault();
  const n = $('#guestName').value.trim() || 'аноним';
  const t = $('#guestText').value.trim();
  if(!t) return;
  const guests = getGuests();
  guests.push({n, t, d: new Date().toLocaleDateString('ru-RU')});
  localStorage.setItem(GKEY, JSON.stringify(guests.slice(-30)));
  renderGuests();
  e.target.reset();
  toast('📝 ЗАПИСАНО В ИСТОРИЮ (localStorage)');
  spawnParticles(innerWidth/2, innerHeight/2, ['📝','📜'], 6);
});
renderGuests();

/* ============================================================
   ЧАСТИЦЫ-ЭМОДЗИ
   ============================================================ */
function spawnParticles(x, y, emojis=['💥'], n=6){
  const box = $('#particles');
  for(let i=0;i<n;i++){
    const p = document.createElement('i');
    p.className = 'particle';
    p.textContent = emojis[rndi(0,emojis.length-1)];
    const ang = rnd(0, Math.PI*2), dist = rnd(70,240);
    p.style.left = x+'px'; p.style.top = y+'px';
    p.style.setProperty('--dx', Math.cos(ang)*dist + 'px');
    p.style.setProperty('--dy', (Math.sin(ang)*dist - 90) + 'px');
    p.style.setProperty('--rot', rndi(-360,360) + 'deg');
    p.style.fontSize = rnd(18,40) + 'px';
    box.appendChild(p);
    setTimeout(()=>p.remove(), 1700);
  }
}

/* клик по любому месту страницы — маленький салют */
document.addEventListener('click', e=>{
  if(e.target.closest('a,button,input,form')) return;
  spawnParticles(e.clientX, e.clientY, ['💀','🔥','💯','⭐'], 3);
});

/* ============================================================
   ТОСТЫ-ПОПАПЫ
   ============================================================ */
function toast(text, ms=3200){
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  box.appendChild(t);
  while(box.children.length > 3) box.firstChild.remove();
  setTimeout(()=>{ t.classList.add('bye'); setTimeout(()=>t.remove(), 350); }, ms);
}

/* фоновые приколы раз в ~25 сек */
const IDLE = [
  '💡 совет: нажми на имя ВЕТА',
  '💀 баг не спит. вета тоже',
  '🎵 музыка тут из 3100 года',
  '🐛 где-то в мире прямо нашли баг. вета при чём',
  '⭐ дай пять звёзд (звёзд тут нет но дай)',
];
setInterval(()=>{ if(document.visibilityState==='visible') toast(IDLE[rndi(0,IDLE.length-1)]); }, 25000);

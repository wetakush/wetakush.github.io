'use strict';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndi = (a,b) => Math.floor(rnd(a,b+1));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&░▒▓█▄▀01';
const RM = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || false;

const N = {
  E1:41.20, G1:49.00, B1:61.74, E2:82.41, G2:98.00, A2:110.00, B2:123.47,
  D4:293.66, E4:329.63, G4:392.00, A4:440.00, B4:493.88,
  E5:659.25, G5:783.99, A5:880.00, B5:987.77, D6:1174.66, E6:1318.51
};


class AudioEngine {
  constructor(){
    this.ctx = null;
    this.playing = false;
    this.track = 'phonk';
    this.bpm = 140;
    this.step = 0;
    this.nextTime = 0;
    this.beatQueue = [];
    this.volume = 0.7;
    this.timer = null;
    this.voidNodes = [];
    this.interrupt = false;
  }

  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;

    this.master = c.createGain(); this.master.gain.value = 0;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = .82;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value=-14; this.comp.knee.value=8; this.comp.ratio.value=4;
    this.comp.attack.value=.003; this.comp.release.value=.25;
    this.clipper = c.createWaveShaper(); this.clipper.curve = this.distCurve(1.6);
    this.bus = c.createGain(); this.bus.gain.value = .9;

    this.bus.connect(this.clipper);
    this.clipper.connect(this.comp);
    this.comp.connect(this.analyser);
    this.analyser.connect(this.master);
    this.master.connect(c.destination);

    this.drumBus = c.createGain(); this.drumBus.gain.value = .95; this.drumBus.connect(this.bus);
    this.bassBus = c.createGain(); this.bassBus.gain.value = .9;
    this.bassDist = c.createWaveShaper(); this.bassDist.curve = this.distCurve(3.2);
    const bLP = c.createBiquadFilter(); bLP.type='lowpass'; bLP.frequency.value = 900;
    this.bassBus.connect(this.bassDist); this.bassDist.connect(bLP); bLP.connect(this.bus);

    this.leadBus = c.createGain(); this.leadBus.gain.value = .34;
    this.leadDist = c.createWaveShaper(); this.leadDist.curve = this.distCurve(2.4);
    this.leadBus.connect(this.leadDist); this.leadDist.connect(this.bus);

    this.delay = c.createDelay(1); this.delay.delayTime.value = .321;
    const dfb = c.createGain(); dfb.gain.value = .34;
    const dlp = c.createBiquadFilter(); dlp.type='lowpass'; dlp.frequency.value = 3200;
    const dsend = c.createGain(); dsend.gain.value = .16;
    this.leadBus.connect(dsend); dsend.connect(this.delay);
    this.delay.connect(dlp); dlp.connect(dfb); dfb.connect(this.delay);
    dlp.connect(this.bus);

    this.reverb = c.createConvolver(); this.reverb.buffer = this.makeImpulse(1.8, 2.6);
    const rsend = c.createGain(); rsend.gain.value = .12;
    this.rsend = rsend; rsend.connect(this.reverb); this.reverb.connect(this.bus);

    this.noiseBuf = c.createBuffer(1, c.sampleRate*2, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for(let i=0;i<nd.length;i++) nd[i] = Math.random()*2-1;

    this.vinyl = c.createBufferSource(); this.vinyl.buffer = this.noiseBuf; this.vinyl.loop = true;
    const vlp = c.createBiquadFilter(); vlp.type='lowpass'; vlp.frequency.value = 3500;
    const vg = c.createGain(); vg.gain.value = 0;
    this.vinylGain = vg;
    this.vinyl.connect(vlp); vlp.connect(vg); vg.connect(this.bus);
    this.vinyl.start();
  }

  distCurve(k){
    const n=1024, c=new Float32Array(n);
    for(let i=0;i<n;i++){ const x=i*2/n-1; c[i]=Math.tanh(k*x)/Math.tanh(k); }
    return c;
  }

  makeImpulse(dur, decay){
    const c=this.ctx, len=c.sampleRate*dur, buf=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){
      const d=buf.getChannelData(ch);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
    }
    return buf;
  }

  noise(t, dur, freq, type='bandpass', vol=.5, dest=null, q=1){
    const c=this.ctx;
    const s=c.createBufferSource(); s.buffer=this.noiseBuf;
    s.playbackRate.value = rnd(.9,1.1);
    const f=c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
    const g=c.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(f); f.connect(g); g.connect(dest||this.drumBus);
    s.start(t, rnd(0,1)); s.stop(t+dur+.02);
  }

  kick(t, v=1){
    const c=this.ctx, o=c.createOscillator(), g=c.createGain();
    o.frequency.setValueAtTime(165,t);
    o.frequency.exponentialRampToValueAtTime(45,t+.10);
    g.gain.setValueAtTime(.95*v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.44);
    o.connect(g); g.connect(this.drumBus);
    o.start(t); o.stop(t+.5);
    this.noise(t,.012,3500,'highpass',.35*v); /* клик */
  }

  snare(t, v=1){
    this.noise(t,.19,1900,'bandpass',.62*v,null,.8);
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(196,t);
    o.frequency.exponentialRampToValueAtTime(120,t+.1);
    g.gain.setValueAtTime(.4*v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.13);
    o.connect(g); g.connect(this.drumBus);
    o.start(t); o.stop(t+.15);
  }

  hat(t, v=1, open=false){
    this.noise(t, open?.3:.05, 8200,'highpass',.26*v);
  }

  cowbell(t, f, v=1, dur=.26){
    const c=this.ctx, g=c.createGain(), bp=c.createBiquadFilter();
    bp.type='bandpass'; bp.frequency.value=f*4.2; bp.Q.value=1.6;
    g.gain.setValueAtTime(.5*v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    const o1=c.createOscillator(), o2=c.createOscillator();
    o1.type='square'; o2.type='square';
    o1.frequency.value=f; o2.frequency.value=f*1.478;
    o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(this.leadBus);
    o1.start(t); o2.start(t); o1.stop(t+dur+.02); o2.stop(t+dur+.02);
  }

  bass808(t, f, dur=.55, v=1){
    const c=this.ctx, o=c.createOscillator(), g=c.createGain();
    o.frequency.setValueAtTime(f*1.5,t);
    o.frequency.exponentialRampToValueAtTime(f,t+.045);
    g.gain.setValueAtTime(.85*v,t);
    g.gain.setValueAtTime(.85*v,t+dur*.55);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(this.bassBus);
    o.start(t); o.stop(t+dur+.05);
  }

  bell(t, f, v=1){
    const c=this.ctx, g=c.createGain();
    g.gain.setValueAtTime(.16*v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+1.4);
    [1,2.01].forEach((m,i)=>{
      const o=c.createOscillator(); o.frequency.value=f*m;
      const og=c.createGain(); og.gain.value = i? .3 : 1;
      o.connect(og); og.connect(g); o.start(t); o.stop(t+1.5);
    });
    g.connect(this.rsend);
    g.connect(this.delay);
  }

  thump(t, v=1){
    const c=this.ctx, o=c.createOscillator(), g=c.createGain(), lp=c.createBiquadFilter();
    lp.type='lowpass'; lp.frequency.value=140;
    o.frequency.setValueAtTime(58,t);
    o.frequency.exponentialRampToValueAtTime(36,t+.2);
    g.gain.setValueAtTime(.8*v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.3);
    o.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t+.35);
  }

  riser(t, dur){
    const c=this.ctx, s=c.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true;
    const f=c.createBiquadFilter(); f.type='bandpass'; f.Q.value=1.2;
    f.frequency.setValueAtTime(300,t);
    f.frequency.exponentialRampToValueAtTime(7000,t+dur);
    const g=c.createGain();
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.22,t+dur);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur+.1);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t); s.stop(t+dur+.15);
  }


  startDrones(){
    const c=this.ctx;
    const mk=(freq, vol, type='sawtooth')=>{
      const o=c.createOscillator(); o.type=type; o.frequency.value=freq;
      o.detune.value = rnd(-7,7);
      const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=260; lp.Q.value=2;
      const lfo=c.createOscillator(); lfo.frequency.value=rnd(.04,.08);
      const lg=c.createGain(); lg.gain.value=170;
      lfo.connect(lg); lg.connect(lp.frequency);
      const g=c.createGain(); g.gain.value=0;
      g.gain.linearRampToValueAtTime(vol, c.currentTime+3);
      o.connect(lp); lp.connect(g); g.connect(this.bus);
      o.start(); lfo.start();
      this.voidNodes.push(o,lfo,g);
    };
    mk(N.E1,.10); mk(N.E2,.07); mk(N.B1,.06); mk(N.E2*1.005,.05);

    const sub=c.createOscillator(); sub.frequency.value=N.E1;
    const sg=c.createGain(); sg.gain.value=0; sg.gain.linearRampToValueAtTime(.12,c.currentTime+4);
    sub.connect(sg); sg.connect(this.bus); sub.start();
    this.voidNodes.push(sub,sg);

    const w=c.createBufferSource(); w.buffer=this.noiseBuf; w.loop=true;
    const wf=c.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=420; wf.Q.value=.4;
    const wg=c.createGain(); wg.gain.value=0; wg.gain.linearRampToValueAtTime(.045,c.currentTime+3);
    w.connect(wf); wf.connect(wg); wg.connect(this.bus); w.start();
    this.voidNodes.push(w,wg);
  }
  stopDrones(){
    const c=this.ctx;
    this.voidNodes.forEach(n=>{ try{
      if(n.gain) n.gain.linearRampToValueAtTime(0, c.currentTime+1);
      n.stop ? n.stop(c.currentTime+1.2) : null;
    }catch(e){} });
    this.voidNodes = [];
  }


  start(){
    if(this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + .08;
    if(this.track==='void') this.startDrones();
    this.vinylGain.gain.linearRampToValueAtTime(this.track==='phonk'?.012:.0, this.ctx.currentTime+1);
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime+.6);
    this.timer = setInterval(()=>this.tick(), 25);
  }

  stop(){
    this.playing=false;
    clearInterval(this.timer);
    if(this.ctx){
      this.master.gain.linearRampToValueAtTime(0,this.ctx.currentTime+.3);
      if(this.track==='void') this.stopDrones();
    }
  }

  switchTrack(){
    const to = this.track==='phonk' ? 'void' : 'phonk';
    const wasPlaying = this.playing;
    this.stop();
    setTimeout(()=>{
      this.track = to;
      this.bpm = to==='phonk' ? 140 : 60;
      if(wasPlaying) this.start();
    }, 340);
    return to;
  }

  tick(){
    while(this.nextTime < this.ctx.currentTime + .12){
      this.schedule(this.step, this.nextTime);
      const stepDur = 60/this.bpm/4;
      this.nextTime += stepDur;
      this.step++;
      if(this.interrupt){ this.interrupt=false; return; }
    }
  }

  schedule(step, t){
    if(this.track==='phonk') this.phonk(step,t);
    else this.void(step,t);
  }

  phonk(step, t){
    const s = step % 16;                
    const bar = Math.floor(step/16);   
    const intro = bar < 4;           
    const phrase = bar % 16;              

    const MEL=['E4',0,'E4','G4',0,0,'E4',0,'A4',0,'G4',0,'E4',0,'D4',0,
               'E4',0,'E4','G4',0,0,'A4',0,'B4',0,'A4',0,'G4',0,'E4',0];
    const mel = MEL[step % 32];
    if(mel){
      const vel = intro ? .6 : rnd(.85,1);
      this.cowbell(t, N[mel], vel, intro? .3 : .24);
      if(s===0) this.beatQueue.push({t, k:.5});
    }

    if(intro){
      if(bar===3 && s===0) this.riser(t, 60/this.bpm*4);
      return;
    }

    const ROOTS=['E2','E2','A2','G2'];
    const root = N[ROOTS[bar % 4]];

    if(s===0 || s===10){
      this.kick(t, s===0?1:.85);
      this.bass808(t, root, s===0? .8 : .3, s===0?1:.7);
      this.beatQueue.push({t, k: s===0?1:.8});
    }
    if(s===7 && bar%4===3) this.kick(t,.45);

    if(s===8){
      this.snare(t,1);
      this.beatQueue.push({t, k:.75});
    }
    if(phrase%8===7 && s>=12){ this.snare(t, .4+(s-12)*.18); }

    const dense = phrase%8>=4;
    if(dense ? true : s%2===0){
      this.hat(t, s%8===4 ? .8 : .45);
    }
    if(s===6 && bar%2===0) this.hat(t,.5,true);
    if(bar%4===3 && s>=14) this.hat(t,.55);

    if(phrase>=8 && s===0 && bar%2===0){
      this.bell(t, N[['E5','G5','B5','D6'][ (bar>>1)%4 ]], .7);
    }

    if(Math.random()<.05) this.noise(t,.008,6000,'highpass',.06);
  }

  void(step, t){
    const s = step % 16;
    const bar = Math.floor(step/16);
    if(s===0 && bar%2===0){
      this.thump(t,1); this.thump(t+.34,.55);
      this.beatQueue.push({t, k:.55});
      this.beatQueue.push({t:t+.34, k:.3});
    }
    if(s===8 && Math.random()<.28){
      const scale=['E5','G5','A5','B5','D6','E6'];
      this.bell(t, N[scale[rndi(0,scale.length-1)]], 1);
    }
  }
}


const AE = new AudioEngine();
let audioReady = false;
let pulse = 0;      
let beatCount = 0;

const bootEl = $('#boot'), bootText = $('#bootText'), bootHint = $('#bootHint');
const heroVideo = $('#heroVideo'), vidWrap = $('#heroVideoWrap'),
      vidFlash = $('#vidFlash'), heroInner = $('#heroInner'),
      heroScrollEl = $('#heroScroll'), gblocks = $('#glitchBlocks');
let bootStarted = false, bootDone = false;

const BOOT_LINES = [
  ['wetakush bio - memory check ......... ', '[ OK ]', 'ok'],
  ['> initializing daemon ....................... ', '[ OK ]', 'ok'],
  ['> bypassing firewall ........................ ', '[ OK ]', 'ok'],
  ['> injecting payload into society ............ ', '[ OK ]', 'ok'],
  ['> loading profile: wetakush ................ ', '[ OK ]', 'ok'],
  ['> we are fsociety', '', 'err'],
  ['> we are finally free', '', 'err'],
  ['> we are finally awake', '', 'err'],
  ['', '', ''],
  ['hello, вета. hello, friend.', '', 'white'],
  ['[ access granted ]', '', 'ok'],
];

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function typeLine(text, cls){
  const line = document.createElement('div');
  if(cls) line.className = cls;
  bootText.appendChild(line);
  for(const ch of text){
    if(bootDone) return;
    line.textContent += ch;
    await sleep(ch===' ' ? 4 : rnd(6,16));
  }
}

async function runBoot(){
  for(const [text, tag, cls] of BOOT_LINES){
    if(bootDone) return;
    await typeLine(text + tag, cls);
    if(!bootDone) await sleep(rnd(90,200));
  }
  await sleep(300);
  finishBoot();
}

async function startBoot(){
  if(bootStarted) return;
  bootStarted = true;
  bootEl.classList.add('armed');
  bootHint.textContent = '[ init... ]';
  try{
    AE.init();
    audioReady = true;
  }catch(e){ console.warn('webaudio fail', e); }
  await runBoot();
}

function finishBoot(){
  if(bootDone) return;
  bootDone = true;
  const flash = $('#flash');
  const frames = ['WAKE','UP,','FRIEND'];
  let i = 0;
  const iv = setInterval(()=>{
    if(i>=frames.length){
      clearInterval(iv);
      flash.style.opacity = 0;
      return;
    }
    flash.textContent = frames[i++];
    flash.style.opacity = .92;
    setTimeout(()=>flash.style.opacity = 0, 85);
  }, 130);

  bootEl.classList.add('off');
  $('#stage').classList.add('on');
  if(heroVideo){ Promise.resolve(heroVideo.play()).catch(()=>{}); }
  startVhsTimer();
  setTimeout(()=>{
    if(audioReady && AE.ctx.state==='suspended') AE.ctx.resume();
    if(audioReady) AE.start();
    updatePlayBtn();
    startVisuals();
  }, 350);
  startRecTimer();
}

bootHint.addEventListener('click', startBoot);
document.addEventListener('keydown', e=>{
  if(!bootStarted){ startBoot(); return; }
  if(!bootDone && e.key!=='F12') finishBoot();
});


const heroTitle = $('#heroTitle');
let glitchTimers = [];

function scramble(el, frames=6){
  if(RM) return;
  if(!el.dataset.orig) el.dataset.orig = el.textContent;
  let f = 0;
  const iv = setInterval(()=>{
    const orig = el.dataset.orig;
    el.textContent = orig.split('').map((ch,i)=>
      Math.random()<.28 && ch!==' ' ? GLYPHS[rndi(0,GLYPHS.length-1)] : ch).join('');
    if(++f>=frames){ el.textContent = orig; clearInterval(iv); }
  }, 42);
  glitchTimers.push(iv);
}

function visualPulse(k){
  pulse = Math.max(pulse, k);
  if(RM) return;
  if(k>=.95){
    beatCount++;                           
    spawnBlocks(rndi(1,2));                 
  }
  if(k>=.5 && beatCount%2===0){        
    scramble(heroTitle, 5);
  }
  if(k>=.95 && beatCount%8===0){      
    burst();
  }
}

function burst(){
  if(RM) return;
  document.body.classList.add('burst','shake');
  const flash = $('#flash');
  flash.style.opacity = .07;
  setTimeout(()=>flash.style.opacity=0, 70);

  if(vidWrap){
    vidWrap.classList.remove('glitching');
    void vidWrap.offsetWidth;
    vidWrap.classList.add('glitching');
    setTimeout(()=>vidWrap.classList.remove('glitching'), 420);
  }
  spawnBlocks(rndi(4,6));
  const words = $$('.sec-head h2');
  if(words.length) scramble(words[rndi(0,words.length-1)], 7);
  setTimeout(()=>document.body.classList.remove('burst','shake'), 260);
}

function spawnBlocks(n=1){
  if(RM || !gblocks) return;
  const COLORS = ['#00ff41','#ff002d','#00e5ff','#e8f0e8'];
  for(let i=0;i<n;i++){
    const b = document.createElement('i');
    const bar = Math.random()<.62;
    const w = bar ? rnd(12,58) : rnd(1.2,6.5);
    const h = bar ? rnd(2,7)  : rnd(1.2,6.5);
    b.className = 'gblock';
    let css = `left:${rnd(-3,95)}%;top:${rnd(2,93)}%;width:${w}%;height:${h}px;`;
    if(Math.random()<.32){
      css += 'background:transparent;border:1px solid #00ff41;';
    } else {
      css += `background:${COLORS[rndi(0,COLORS.length-1)]};opacity:${rnd(.3,.8)};`;
    }
    b.style.cssText = css;
    gblocks.appendChild(b);
    setTimeout(()=>b.remove(), rnd(90,230));
  }
  while(gblocks.children.length>26) gblocks.firstChild.remove();
}

let rafOn = false, lastT = performance.now();
const noiseCv = $('#noise'), noiseCtx2d = noiseCv.getContext('2d');
const vizCv = $('#viz'), vizCtx = vizCv.getContext('2d');
const eqCv = $('#eq'), eqCtx = eqCv.getContext('2d');
const freqData = new Uint8Array(128);

function sizeCanvases(){
  noiseCv.width = 140; noiseCv.height = 90;
  vizCv.width = vizCv.clientWidth || innerWidth;
  vizCv.height = 130;
}
sizeCanvases();
addEventListener('resize', sizeCanvases);

let noiseFrame = 0;
function drawNoise(){
  if(RM || (noiseFrame++ % 3)) return;
  const w=noiseCv.width,h=noiseCv.height, img=noiseCtx2d.createImageData(w,h);
  for(let i=0;i<img.data.length;i+=4){
    const v = Math.random()*255|0;
    img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255;
  }
  noiseCtx2d.putImageData(img,0,0);
}

function drawViz(){
  const w=vizCv.width,h=vizCv.height;
  vizCtx.clearRect(0,0,w,h);
  if(!audioReady){ return; }
  AE.analyser.getByteFrequencyData(freqData);
  const bars=56, step=Math.floor(freqData.length/bars);
  vizCtx.fillStyle='rgba(0,255,65,.5)';
  for(let i=0;i<bars;i++){
    const v = freqData[i*step]/255;
    const bh = Math.pow(v,1.6)*h*.9;
    const bw = w/bars;
    vizCtx.fillStyle = v>.82 ? 'rgba(255,0,45,.6)' : 'rgba(0,255,65,.42)';
    vizCtx.fillRect(i*bw+1, h-bh, bw-2, bh);
  }
}

function drawEq(){
  eqCtx.clearRect(0,0,eqCv.width,eqCv.height);
  if(!audioReady){ return; }
  const bars=6, step=Math.floor(freqData.length/bars);
  for(let i=0;i<bars;i++){
    const v = freqData[(i+1)*step]/255;
    const bh = Math.max(2, v*eqCv.height);
    eqCtx.fillStyle = i===bars-1 && v>.8 ? '#ff002d' : '#00ff41';
    eqCtx.fillRect(i*9+1, eqCv.height-bh, 5, bh);
  }
}

let mx=0, my=0, cmx=0, cmy=0;
const TRAIL_COLORS = ['#00ff41','#00ff41','#00e5ff','#00ff41','#ff002d','#00e5ff','#00ff41'];
const trailDots = [];
if(matchMedia && matchMedia('(pointer:fine)').matches && !RM){
  addEventListener('mousemove', e=>{
    mx = (e.clientX/innerWidth  - .5)*2;
    my = (e.clientY/innerHeight - .5)*2;
  });
  for(let i=0;i<7;i++){
    const d = document.createElement('i');
    d.className = 'trail';
    d.style.background = TRAIL_COLORS[i];
    d.style.opacity = (.85 - i*.11).toFixed(2);
    document.body.appendChild(d);
    trailDots.push({el:d, x:innerWidth/2, y:innerHeight/2});
  }
}

function mainLoop(t){
  requestAnimationFrame(mainLoop);
  const dt = (t-lastT)/1000; lastT = t;

  if(pulse>0){
    pulse = Math.max(0, pulse - dt*5.5);
    if(!RM){
      heroTitle.style.transform = `scale(${1+pulse*.035}) skewX(${pulse*rnd(-1.6,1.6)}deg)`;
      if(vidWrap){
        vidWrap.style.transform = `translate(${(cmx*-8).toFixed(1)}px,${(cmy*-5).toFixed(1)}px) scale(${(1.02+pulse*.05).toFixed(4)})`;
        vidFlash.style.opacity = (pulse*.15).toFixed(3);
      }
      noiseCv.style.opacity = (.055 + pulse*.12).toFixed(3);
    }
  } else if(!RM && vidWrap && vidWrap.style.transform){
    vidWrap.style.transform = `translate(${(cmx*-8).toFixed(1)}px,${(cmy*-5).toFixed(1)}px) scale(1.02)`;
    vidFlash.style.opacity = 0;
    noiseCv.style.opacity = .055;
  }

  if(!RM){
    cmx += (mx-cmx)*.06; cmy += (my-cmy)*.06;
    const p = clamp(scrollY/innerHeight, 0, 1);
    heroInner.style.transform =
      `translate(${(cmx*12).toFixed(1)}px,${(cmy*8).toFixed(1)}px) scale(${(1-p*.12).toFixed(3)})`;
    heroInner.style.opacity = clamp(1-p*1.25, 0, 1).toFixed(3);
    heroScrollEl.style.opacity = clamp(1-p*2.4, 0, 1).toFixed(3);
  }

  if(trailDots.length){
    let px = cursorX, py = cursorY;
    trailDots.forEach(d=>{
      d.x += (px-d.x)*.32; d.y += (py-d.y)*.32;
      d.el.style.transform = `translate(${d.x-2.5}px,${d.y-2.5}px) rotate(${(d.x*8)%90|0}deg)`;
      px = d.x; py = d.y;
    });
  }

  if(audioReady){
    const now = AE.ctx.currentTime;
    while(AE.beatQueue.length && AE.beatQueue[0].t <= now){
      visualPulse(AE.beatQueue.shift().k);
    }
    drawViz(); drawEq();
  }
  drawNoise();
}

function startVisuals(){
  if(rafOn) return;
  rafOn = true;
  requestAnimationFrame(mainLoop);
}

const plPlay = $('#plPlay'), plTrack = $('#plTrack'), plVol = $('#plVol');

function updatePlayBtn(){
  plPlay.textContent = (audioReady && AE.playing) ? '❚❚' : '▶';
}

plPlay.addEventListener('click', ()=>{
  if(!audioReady) return;
  if(AE.playing){ AE.stop(); }
  else{ AE.start(); }
  updatePlayBtn();
});

plTrack.addEventListener('click', ()=>{
  if(!audioReady) return;
  const to = AE.switchTrack();
  plTrack.textContent = to==='phonk' ? 'PHONK://FSOCIETY' : 'VOID://DAEMON';
  setTimeout(updatePlayBtn, 380);
});

plVol.addEventListener('input', ()=>{
  AE.volume = plVol.value/100;
  if(audioReady && AE.playing) AE.master.gain.linearRampToValueAtTime(AE.volume, AE.ctx.currentTime+.1);
});

const io = new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(!en.isIntersecting) return;
    en.target.classList.add('visible');
    if(en.target.classList.contains('counter')) runCounter(en.target);
    if(en.target.classList.contains('skill')){
      const bar = en.target.querySelector('.bar i');
      const pct = en.target.querySelector('.skill-pct');
      if(bar && !bar.dataset.done){
        bar.dataset.done = 1;
        setTimeout(()=>{
          bar.style.width = bar.dataset.val + '%';
          countPct(pct, +bar.dataset.val);
        }, 250);
      }
    }
    io.unobserve(en.target);
  });
},{threshold:.25});

$$('.reveal, .counter, .skill').forEach(el=>io.observe(el));
heroTitle.dataset.orig = 'WETAKUSH';

function runCounter(el){
  if(el.dataset.done) return; el.dataset.done=1;
  const val = +el.dataset.val, pre = el.dataset.prefix||'', suf = el.dataset.suffix||'';
  const t0 = performance.now(), dur = 1300;
  (function tick(now){
    const p = clamp((now-t0)/dur, 0, 1);
    const cur = Math.floor(val * (1-Math.pow(1-p,3)));
    el.textContent = pre + cur.toLocaleString('ru-RU') + suf;
    if(p<1) requestAnimationFrame(tick);
    else el.textContent = pre + val.toLocaleString('ru-RU') + suf;
  })(t0);
}
function countPct(el, target){
  const t0=performance.now(), dur=1400;
  (function tick(now){
    const p = clamp((now-t0)/dur,0,1);
    el.textContent = Math.floor(target*(1-Math.pow(1-p,3))) + '%';
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}

const secs = $$('.sec');
function parallax(){
  if(RM) return;
  const vh = innerHeight;
  secs.forEach(s=>{
    const r = s.getBoundingClientRect();
    if(r.bottom<0 || r.top>vh) return;
    const rel = (r.top + r.height/2 - vh/2)/vh;
    s.style.setProperty('--py', (rel*-70).toFixed(1)+'px');
  });
}
addEventListener('scroll', parallax, {passive:true});

setInterval(()=>{
  const tags = $$('#chipsCloud .tag');
  if(!tags.length) return;
  tags.forEach(t=>t.classList.remove('lit'));
  for(let i=0;i<3;i++) tags[rndi(0,tags.length-1)].classList.add('lit');
}, 1600);

let recStart = null;
function startRecTimer(){
  recStart = Date.now();
  setInterval(()=>{
    const s = Math.floor((Date.now()-recStart)/1000);
    const hh = String(Math.floor(s/3600)).padStart(2,'0');
    const mm = String(Math.floor(s%3600/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    $('#recTimer').textContent = `${hh}:${mm}:${ss}`;
  }, 1000);
}
function startVhsTimer(){
  const el = $('#vhsTimer'); if(!el) return;
  const t0 = Date.now();
  setInterval(()=>{
    const s = Math.floor((Date.now()-t0)/1000);
    el.textContent =
      `${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 1000);
}

$$('.sec-head h2').forEach(h=>h.addEventListener('mouseenter', ()=>scramble(h, 5)));

const cursor = $('#cursor');
let cursorX = innerWidth/2, cursorY = innerHeight/2;
if(window.matchMedia && matchMedia('(pointer:fine)').matches && !RM){
  document.documentElement.classList.add('custom-cursor');
  let tx=cursorX, ty=cursorY;
  addEventListener('mousemove', e=>{ tx=e.clientX; ty=e.clientY; cursorX=tx; cursorY=ty; });
  (function cur(){
    requestAnimationFrame(cur);
    cursorX += (tx-cursorX)*.35; cursorY += (ty-cursorY)*.35;
    cursor.style.left = cursorX+'px'; cursor.style.top = cursorY+'px';
  })();
  document.addEventListener('mouseover', e=>{
    cursor.classList.toggle('hot', !!e.target.closest('a,button,input,.chip,.tag'));
  });
}

const term=$('#terminal'), termOut=$('#termOut'), termIn=$('#termIn');
const hist=[]; let histIdx=-1;

const MASK = [
'      ┌───────────────────────┐',
'      │  ░░░░░░░░░░░░░░░░░░░  │',
'      │  ░                 ░  │',
'      │  ░   ▄▄       ▄▄   ░  │',
'      │  ░   ▀▀       ▀▀   ░  │',
'      │  ░                 ░  │',
'      │  ░       ▄▄▄▄▄     ░  │',
'      │  ░      ▐░░░░░░▌    ░  │',
'      │  ░                 ░  │',
'      └───────────────────────┘'
].join('\n');

const PROFILE = `{
  "handle": "wetakush",
  "name": "вета",
  "role": ["Security Researcher","Software Developer","Bug Bounty Hunter"],
  "focus": "Offensive Security",
  "platforms": ["BI.ZONE Bug Bounty","Standoff 365 Bug Bounty"]
}`;

function tprint(text, cls='t-green'){
  const pre = document.createElement('pre');
  if(cls) pre.className = cls;
  pre.textContent = text;
  termOut.appendChild(pre);
  termOut.parentElement.scrollTop = termOut.parentElement.scrollHeight;
}

const CMDS = {
  help(){
    tprint(
`доступные команды:
  whoami         — кто здесь
  ls             — посмотреть файлы
  cat <файл>     — прочитать (попробуй flag.txt)
  skills         — стек
  contact        — контакты
  fsociety       — ты знаешь, зачем пришёл
  matrix         — упасть в кроличью нору
  sudo rm -rf /  — плохая идея
  clear          — очистить
  exit           — закрыть терминал`, 't-white');
  },
  whoami(){
    tprint(`вета // wetakush\nsecurity researcher & software developer\nbug bounty hunter @ BI.ZONE / Standoff 365\n\nкаждый баг-репорт — это детальный анализ с PoC.`, 't-green');
  },
  ls(){
    tprint(`profile.json   flag.txt   skills/\nmethodology/   .secret/`, 't-white');
  },
  cat(a={}){
    const f=(a._[0]||'').toLowerCase();
    if(f==='flag.txt') tprint('fsociety{w3_4r3_4w4k3}', 't-red');
    else if(f==='profile.json') tprint(PROFILE, 't-green');
    else if(f==='.secret'||f==='.secret/') tprint('control is an illusion.', 't-grey');
    else tprint(`cat: ${(a._[0]||'')||'?'}: нет такого файла`, 't-red');
  },
  skills(){
    tprint(
`python ......... ████████████████░░ 92%
pentest/web .... ████████████████░░ 90%
html/css/js .... ████████████████░░ 88%
osint&recon .... ███████████████░░░ 84%
c++/c# ......... ██████████████░░░░ 76%
devops ......... ██████████████░░░░ 72%`, 't-green');
  },
  contact(){
    tprint(
`telegram  → t.me/noxad
github    → github.com/wetakush
bi.zone   → bugbounty.bi.zone/profile/wetakush
standoff  → standoff365.com/profile/wetakush`, 't-white');
  },
  fsociety(){
    tprint(MASK, 't-green');
    tprint('\nwe are fsociety.\nwe are finally free.\nwe are finally awake.\n', 't-red');
    if(audioReady && AE.playing && AE.track==='phonk'){
      const t=AE.ctx.currentTime; AE.kick(t); AE.kick(t+.2);
    }
  },
  matrix(){
    toggleMatrix();
    tprint('просыпайся... следуй за белым кроликом. 🐇', 't-green');
  },
  sudo(a){
    if((a._||[]).join(' ').includes('rm')) return CMDS.rm(a);
    tprint('мы тут все root.', 't-grey');
  },
  rm(a){
    const args=(a._||[]).join(' ');
    if(args.includes('-rf') && (args.includes('/')||args.includes('/*'))){
      corrupt();
    } else {
      tprint('rm: осторожнее с этим.', 't-red');
    }
  },
  clear(){ termOut.innerHTML=''; },
  exit(){ toggleTerm(false); },
  echo(a){ tprint((a._||[]).join(' '),'t-grey'); },
  date(){ tprint(new Date().toString(), 't-grey'); },
  uname(){ tprint('fsociety OS 3.7.1-void x86_64', 't-grey'); },
  pwd(){ tprint('/home/wetakush/fsociety', 't-grey'); },
  hello(a){
    const w=(a._||[]).join(' ');
    tprint(/friend/i.test(w)?'hello, friend.':'hello.', 't-green');
  },
};

async function corrupt(){
  tprint('rm: удаляю /society ...', 't-red');
  await sleep(300); tprint('rm: удаляю /control ...', 't-red');
  await sleep(300); tprint('rm: удаляю /trust ...', 't-red');
  await sleep(400);
  document.body.classList.add('corrupt');
  $$('.glitch, .sec-head h2, .hero-sub').forEach(g=>scramble(g, 14));
  if(audioReady){
    const t=AE.ctx.currentTime;
    AE.noise(t,1.2,900,'bandpass',.5);
    AE.snare(t); AE.snare(t+.18); AE.kick(t+.36,.8);
  }
  await sleep(1400);
  document.body.classList.remove('corrupt');
  tprint('\nшутка. контроль - иллюзия, но данные целы.', 't-green');
  tprint('...почти целы.', 't-grey');
}

function runCmd(raw){
  const line = raw.trim();
  tprint(`wetakush@fsociety:~$ ${line}`, 't-grey');
  if(!line) return;
  hist.push(line); histIdx = hist.length;
  const [cmd, ...args] = line.split(/\s+/);
  const fn = CMDS[cmd.toLowerCase()];
  if(fn) fn({_:args});
  else tprint(`${cmd}: команда не найдена. попробуй help`, 't-red');
}

termIn.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ runCmd(termIn.value); termIn.value=''; }
  else if(e.key==='ArrowUp'){ e.preventDefault(); if(histIdx>0) termIn.value=hist[--histIdx]||''; }
  else if(e.key==='ArrowDown'){ e.preventDefault(); if(histIdx<hist.length) termIn.value=hist[++histIdx]||''; }
});

function toggleTerm(force){
  const open = force!==undefined ? force : !term.classList.contains('open');
  term.classList.toggle('open', open);
  term.setAttribute('aria-hidden', String(!open));
  if(open){
    if(!termOut.childElementCount){
      tprint('fsociety shell v3.7.1 — введи help', 't-green');
    }
    setTimeout(()=>termIn.focus(), 100);
  }
}
$('#termToggle').addEventListener('click', ()=>toggleTerm());
$('#termClose').addEventListener('click', ()=>toggleTerm(false));

document.addEventListener('keydown', e=>{
  if(!bootDone) return;
  if(e.key==='`' || (e.key==='~' && !e.shiftKey)){
    if(document.activeElement!==termIn){ e.preventDefault(); toggleTerm(); }
  }
  if(e.key==='Escape' && term.classList.contains('open')) toggleTerm(false);
});

const mCv = $('#matrix'), mCtx = mCv.getContext('2d');
let matrixOn=false, matrixDrops=[], matrixTimer=null;

function toggleMatrix(force){
  const want = force!==undefined ? force : !matrixOn;
  if(want===matrixOn) return;
  matrixOn = want;
  mCv.classList.toggle('on', matrixOn);
  if(matrixOn){
    mCv.width=innerWidth; mCv.height=innerHeight;
    const cols = Math.floor(mCv.width/16);
    matrixDrops = Array.from({length:cols},()=>rndi(-40,0));
    mCtx.fillStyle='#000'; mCtx.fillRect(0,0,mCv.width,mCv.height);
    matrixTimer = setInterval(()=>{
      mCtx.fillStyle='rgba(0,0,0,.09)';
      mCtx.fillRect(0,0,mCv.width,mCv.height);
      mCtx.fillStyle='#00ff41';
      mCtx.font='14px monospace';
      matrixDrops.forEach((y,i)=>{
        const ch = String.fromCharCode(0x30A0 + Math.random()*96|0);
        mCtx.fillText(ch, i*16, y*16);
        if(y*16>mCv.height && Math.random()>.975) matrixDrops[i]=0;
        matrixDrops[i]++;
      });
    }, 45);
    setTimeout(()=>toggleMatrix(false), 9000);
  } else {
    clearInterval(matrixTimer);
  }
}

/* debug-хук: console → __fsociety.AE, __fsociety.burst() */
window.__fsociety = { AE, burst, spawnBlocks, scramble };

(function idleNoise(){
  sizeCanvases();
  drawNoise();
})();

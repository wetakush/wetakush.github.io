'use strict';
const modes={web:{id:'01',title:'Web<br>security.',description:'Интерфейс — только начало. Дальше — запросы, состояние и границы доверия.',focus:'Авторизация<br>Клиентская логика<br>Поверхность атаки',tools:'Burp Suite<br>DevTools · Python',label:'ATTACK SURFACE'},api:{id:'02',title:'API &<br>logic.',description:'Что произойдёт, если изменить порядок действий? Проверяю логику и доступ между компонентами.',focus:'Контроль доступа<br>Бизнес-логика<br>Границы доверия',tools:'Burp Suite<br>Python · HTTP',label:'TRUST BOUNDARIES'},source:{id:'03',title:'Source<br>code.',description:'Читаю код, разбираю внутреннюю механику и пишу собственные инструменты для исследования.',focus:'Reverse engineering<br>Автоматизация<br>Разработка',tools:'Python · C++ · C#<br>JavaScript · Git',label:'SYSTEM INTERNALS'}};
const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const consolePanel = document.querySelector('.console');
const motionButton = document.querySelector('#motion-toggle');
const buildings = [
  {x:1,y:1,s:2,z:2.6,type:'web',name:'WEB / 01',height:0,light:1},
  {x:6,y:1,s:1.6,z:3.5,type:'api',name:'API / 02',height:0,light:0},
  {x:5,y:6,s:2.2,z:1.8,type:'source',name:'SOURCE / 03',height:0,light:0}
];
const routes = [[[2,3],[2,5],[7,5],[7,3]],[[7,3],[9,3],[9,7],[7,7]],[[2,3],[2,7],[5,7]]];
let mode='web', w=0, h=0, unit=20, visible=false, frame=0, last=0, clock=0;
let paused=false, pulse=1, entrance=0, mx=0, my=0, tx=0, ty=0;
const still = () => reduced.matches || paused;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const mix = (a,b,t) => a+(b-a)*t;
function color(a,b,t){return `rgb(${a.map((n,i)=>Math.round(mix(n,b[i],t))).join(',')})`;}
function project(x,y,z=0){return [w*.5+(x-y)*unit+mx,h*.24+(x+y)*unit*.48-z*unit+my];}
function line(points,stroke,width=1){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();}
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
function box(x,y,s,z,light=0){
  const b=project(x+s,y),c=project(x+s,y+s),d=project(x,y+s);
  const at=project(x,y,z),bt=project(x+s,y,z),ct=project(x+s,y+s,z),dt=project(x,y+s,z);
  poly([d,c,ct,dt],color([48,54,61],[149,141,130],light),'#626971');
  poly([b,c,ct,bt],color([28,33,39],[100,93,84],light),'#4c535c');
  poly([at,bt,ct,dt],color([85,94,104],[224,218,206],light),'#808995');
  for(let j=.25;j<z;j+=.3){line([project(x,y+s,j),project(x+s,y+s,j)],'#171b20',.75);line([project(x+s,y,j),project(x+s,y+s,j)],'#111619',.65);}
}
function settle(){buildings.forEach(b=>{b.height=b.z+(b.type===mode?.25:0);b.light=b.type===mode?1:0;});mx=my=0;}
function render(){
  if(!w||!h)return;
  ctx.clearRect(0,0,w,h);unit=Math.min(w/21,h/17);
  for(let x=-10;x<22;x++){line([project(x,-10),project(x,22)],'#3a42482a',.6);line([project(-10,x),project(22,x)],'#3a42482a',.6);}
  poly([project(-.6,-.6,-.3),project(10,-.6,-.3),project(10,10,-.3),project(-.6,10,-.3)],'#161b20aa','#48535e');
  for(let i=0;i<=10;i++){line([project(i,0),project(i,10)],'#56606b38',.6);line([project(0,i),project(10,i)],'#56606b38',.6);}
  // A slow scan across the ground plane, behind the structures.
  if(!still()){
    const scan=(clock/2200)%11;
    poly([project(0,scan,.02),project(10,scan,.02),project(10,scan+.22,.02),project(0,scan+.22,.02)],'#b9d2ee0b');
    line([project(0,scan,.03),project(10,scan,.03)],'#9fbcd02b',.8);
  }
  routes.forEach((r,i)=>{
    const active=i===buildings.findIndex(b=>b.type===mode);
    line(r.map(p=>project(...p,.06)),active?'#d0c5ae':'#626d79',active?1.4:1);
    for(let packet=0;packet<2;packet++){
      const progress=(clock/3000+i*.3+packet*.5)%1;
      const segment=Math.min(r.length-2,Math.floor(progress*(r.length-1)));
      const f=progress*(r.length-1)-segment,p=r[segment],q=r[segment+1];
      const pos=project(mix(p[0],q[0],f),mix(p[1],q[1],f),.1);
      ctx.fillStyle=active?'#ffe1ba':'#b2c4d5';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=active?8:3;
      ctx.fillRect(pos[0]-1.5,pos[1]-1.5,3,3);ctx.shadowBlur=0;
    }
  });
  for(const [x,y] of [[.4,5],[.4,6],[.4,7],[8,8],[9,8],[9,1]])box(x,y,.45,.3);
  buildings.forEach(b=>{
    const active=b.type===mode;
    if(active&&pulse<1&&!still()){
      const a=(1-pulse)*.6,spread=pulse*1.7;
      line([project(b.x-spread,b.y-spread),project(b.x+b.s+spread,b.y-spread),project(b.x+b.s+spread,b.y+b.s+spread),project(b.x-spread,b.y+b.s+spread),project(b.x-spread,b.y-spread)],`rgba(226,191,153,${a})`,1);
    }
    box(b.x,b.y,b.s,b.height,b.light);
    const p=project(b.x+b.s/2,b.y+b.s/2,b.height+.9);
    ctx.font=`${Math.max(7,unit*.36)}px "IBM Plex Mono",monospace`;ctx.textAlign='center';ctx.fillStyle=active?'#eee3ce':'#a3adb9';ctx.fillText(b.name,p[0],p[1]);
    line([[p[0],p[1]+4],project(b.x+b.s/2,b.y+b.s/2,b.height+.15)],'#8a929a',.6);
    if(active){const l=project(b.x+b.s/2,b.y+b.s,b.height*.65);ctx.fillStyle='#e78769';ctx.shadowColor='#ed9074';ctx.shadowBlur=still()?0:8+3*Math.sin(clock/550);ctx.fillRect(l[0]-2,l[1]-2,4,4);ctx.shadowBlur=0;}
  });
  const p=project(5,10.7);ctx.save();ctx.translate(...p);ctx.transform(1,.48,-1,.48,0,0);ctx.font='12px "IBM Plex Mono",monospace';ctx.fillStyle='#78818b';ctx.textAlign='center';ctx.fillText('WETAKUSH / RESEARCH ENVIRONMENT',0,0);ctx.restore();
}
function selectMode(next){
  if(next===mode)return;
  mode=next;pulse=0;
  const data=modes[mode];
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('selected',active);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelector('#node-id').textContent='NODE / '+data.id;
  document.querySelector('#node-title').innerHTML=data.title;
  document.querySelector('#node-description').textContent=data.description;
  document.querySelector('#focus').innerHTML=data.focus;
  document.querySelector('#tools').innerHTML=data.tools;
  document.querySelector('#mode-label').textContent=mode.toUpperCase()+' / '+data.id;
  document.querySelector('.scene-head>span').textContent=data.id+' / '+data.label;
  const inspector=document.querySelector('.inspector');
  inspector.classList.remove('changing');
  if(!still()){void inspector.offsetWidth;inspector.classList.add('changing');}
  if(still())settle();render();start();
}
document.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===mode));b.addEventListener('click',()=>selectMode(b.dataset.mode));});
function animate(t){
  frame=0;
  if(!visible||document.hidden||still()){last=0;return;}
  const dt=last?Math.min(t-last,50):16;last=t;clock+=dt;entrance+=dt;
  pulse=Math.min(1,pulse+dt/1100);
  const ease=1-Math.exp(-dt/190);
  mx=mix(mx,tx,ease);my=mix(my,ty,ease);
  buildings.forEach((b,i)=>{const target=entrance>i*160?b.z+(b.type===mode?.25:0):0;b.height=mix(b.height,target,ease);b.light=mix(b.light,b.type===mode?1:0,ease);});
  render();frame=requestAnimationFrame(animate);
}
function start(){if(!frame&&visible&&!document.hidden&&!still()){last=0;frame=requestAnimationFrame(animate);}}
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);if(still())settle();render();}
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;start();}).observe(canvas);
document.addEventListener('visibilitychange',start);
function syncMotion(){
  const stopped=still();document.body.classList.toggle('motion-paused',stopped);
  motionButton.setAttribute('aria-pressed',String(stopped));
  motionButton.setAttribute('aria-label',stopped?'Включить анимацию':'Приостановить анимацию');
  motionButton.innerHTML=stopped?'MOTION OFF <i>▷</i>':'MOTION ON <i>Ⅱ</i>';
  motionButton.disabled=reduced.matches;
  if(stopped){if(frame)cancelAnimationFrame(frame);frame=0;settle();render();}else start();
}
motionButton.addEventListener('click',()=>{paused=!paused;syncMotion();});
reduced.addEventListener('change',syncMotion);syncMotion();
consolePanel.addEventListener('pointermove',e=>{
  if(still()||!finePointer.matches)return;
  const r=consolePanel.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1);
  consolePanel.style.setProperty('--rx',`${(y-.5)*-3}deg`);consolePanel.style.setProperty('--ry',`${(x-.5)*3}deg`);
  consolePanel.style.setProperty('--px',`${x*100}%`);consolePanel.style.setProperty('--py',`${y*100}%`);tx=(x-.5)*7;ty=(y-.5)*5;
});
consolePanel.addEventListener('pointerleave',()=>{tx=ty=0;consolePanel.style.setProperty('--rx','0deg');consolePanel.style.setProperty('--ry','0deg');});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();document.querySelector('#coordinates').textContent='X '+String(Math.round(e.clientX-r.left)).padStart(3,'0')+' / Y '+String(Math.round(e.clientY-r.top)).padStart(3,'0');});
canvas.addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*w/r.width,y=(e.clientY-r.top)*h/r.height;
  let nearest=null,distance=Infinity;
  buildings.forEach(b=>{const p=project(b.x+b.s/2,b.y+b.s/2,b.height*.5),d=Math.hypot(p[0]-x,p[1]-y);if(d<distance){distance=d;nearest=b;}});
  if(nearest&&distance<unit*3)selectMode(nearest.type);
});

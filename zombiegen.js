import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* Zombie-Generator (aus zombie-generator.html übernommen, für Three r160 angepasst).
   Erzeugt 300 verschiedene Zombies (buildZombie(0..299)) zur Laufzeit – ohne GLB-Dateien. */
// Lambert statt PBR: schneller auf Tablets; roughness/metalness werden verworfen
const M = (o) => { const { roughness, metalness, ...rest } = o; return new THREE.MeshLambertMaterial(rest); };
let MODE='zombie';const HSKIN=['#f1c9a5','#e0ac82','#c68c62','#a8714a','#8a5a3a','#6b4430','#4a3024','#f6d9c0','#d9a37a'];
const S=128,Q=.5,N=300;
const R=s=>{let a=s>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const SKIN=['#8a7868','#7a6a5a','#9a8c7c','#6b5d50','#a39588','#5e5248','#8c7a64','#b0a090','#7d7468','#6a5f55','#8f8274','#74685c'];
const COL=['#a33','#36a','#2a6','#c93','#555','#ddd','#639','#c60','#222','#1aa'];
const JEANS=['#2d4a7a','#1e2f50','#3a3a3a','#5a4a32','#222','#4a5d3a'];
const HAIR=['#1a1410','#2b1d12','#4a3322','#6b5035','#8a7a60','#9a9a96','#b8b4a8','#3a2a22'];const BT={normal:'normal',legless:'nur Arme',armless:'nur Beine',crawler:'kriechend'};const HS={short:'kurz',messy:'zerzaust',long:'lang',receding:'lichtes Haar'};
const L={tshirt:'T-Shirt',longsleeve:'Langarmshirt',jacket:'Jacke',tank:'Tanktop',hoodie:'Hoodie',none:'Oberkörper frei',
jeans:'Jeans',shorts:'Shorts',cargo:'Cargohose',suit:'Anzughose',torn:'Zerrissene Hose',
nohat:'keine',hair:'Haare',cap:'Cap',beanie:'Mütze',hardhat:'Bauhelm',helmet:'Helm'};

function mat(draw,o){const c=document.createElement('canvas');c.width=c.height=S*Q;const cx=c.getContext('2d');cx.scale(Q,Q);draw(cx);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return M(Object.assign({map:t},o))}
const MC={};const col=(c,o)=>{const k=c+JSON.stringify(o||{});return MC[k]||(MC[k]=M(Object.assign({color:c},o)))};
function grain(g,r,n=.18){const W=g.canvas.width,d=g.getImageData(0,0,W,W);for(let i=0;i<d.data.length;i+=4){const k=1+(r()-.5)*n*2;d.data[i]*=k;d.data[i+1]*=k;d.data[i+2]*=k}g.putImageData(d,0,0)}
function bloodMark(q,r,x,y,w,h){const g=q.createRadialGradient(x,y,1,x,y,Math.max(w,h));g.addColorStop(0,'rgba(60,4,4,.95)');g.addColorStop(.5,'rgba(130,10,10,.85)');g.addColorStop(1,'rgba(160,20,20,0)');q.fillStyle=g;q.beginPath();q.ellipse(x,y,w,h,r()*3,0,7);q.fill();
 for(let i=0;i<3;i++){const dx=x+(r()-.5)*w,len=10+r()*50,gr=q.createLinearGradient(0,y,0,y+len);gr.addColorStop(0,'rgba(140,12,12,.85)');gr.addColorStop(1,'rgba(100,8,8,.3)');q.fillStyle=gr;q.fillRect(dx,y,2+r()*2,len);q.beginPath();q.arc(dx+1.5,y+len,2.2,0,7);q.fill()}
 for(let i=0;i<8;i++){q.fillStyle='rgba(150,14,14,.8)';q.beginPath();q.arc(x+(r()-.5)*w*3,y+(r()-.5)*h*3,.8+r()*1.8,0,7);q.fill()}}
function wounds(g,r,n){for(let i=0;i<n;i++)bloodMark(g,r,r()*S,r()*S,3+r()*8,3+r()*10)}
function gash(q,r){for(const x of[0,128]){const y=45+r()*10;bloodMark(q,r,x,y,18,22);q.fillStyle='#3a0606';q.beginPath();q.ellipse(x,y,11,15,0,0,7);q.fill();q.strokeStyle='#d8d0b8';q.lineWidth=2;for(let j=-1;j<=1;j++){q.beginPath();q.moveTo(x-8,y+j*7);q.lineTo(x+8,y+j*7-2);q.stroke()}}}
function rip(g,r,sk){const x=r()*S,y=r()*S,w=8+r()*18;g.fillStyle=sk;g.beginPath();for(let k=0;k<9;k++){const a=k/9*6.283,d=w*(.5+r()*.6);g.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d*.8)}g.fill();g.strokeStyle='rgba(30,0,0,.7)';g.lineWidth=2;g.stroke()}
function skinTex(g,r,s){g.fillStyle=s.skin;g.fillRect(0,0,S,S);
 for(let i=0;i<(s.z?40:0);i++){g.fillStyle=`rgba(${r()<.5?'60,30,60':'40,60,30'},${.05+r()*.12})`;g.beginPath();g.arc(r()*S,r()*S,6+r()*20,0,7);g.fill()}
 g.strokeStyle='rgba(50,40,80,.5)';g.lineWidth=1;for(let i=0;i<(s.z?8:0);i++){g.beginPath();let x=r()*S,y=r()*S;g.moveTo(x,y);for(let k=0;k<6;k++){x+=(r()-.5)*16;y+=(r()-.5)*16;g.lineTo(x,y)}g.stroke()}
 grain(g,r,.12);wounds(g,r,s.blood)}
function pat(g,t,c,c2){g.fillStyle=c;g.fillRect(0,0,S,S);g.fillStyle=c2;
 if(t==='stripes')for(let y=0;y<S;y+=16)g.fillRect(0,y,S,6);
 else if(t==='plaid'){for(let y=0;y<S;y+=24)g.fillRect(0,y,S,8);g.globalAlpha=.5;for(let x=0;x<S;x+=24)g.fillRect(x,0,8,S);g.globalAlpha=1}
 else if(t==='dots')for(let y=6;y<S;y+=16)for(let x=6;x<S;x+=16)g.fillRect(x,y,5,5);
 else if(t==='band')g.fillRect(0,S*.4,S,12)}
function cloth(g,r,pt,c,c2,rips,sk,bl){pat(g,pt,c,c2);g.fillStyle='rgba(0,0,0,.07)';for(let y=0;y<S;y+=3)g.fillRect(0,y,S,1);
 for(let i=0;i<10;i++){g.fillStyle=`rgba(0,0,0,${.04+r()*.1})`;g.fillRect(r()*S,0,3+r()*6,S)}
 grain(g,r,.1);for(let i=0;i<(rips?20:0);i++){g.fillStyle=`rgba(40,25,10,${.05+r()*.12})`;g.beginPath();g.arc(r()*S,r()*S,4+r()*14,0,7);g.fill()}
 for(let i=0;i<rips;i++)rip(g,r,sk);wounds(g,r,bl)}
function spec(i){const r=R(i*7919+13+(MODE==='human'?500009:MODE==='monster'?900011:0)),s={r,i,z:MODE!=='human',m:MODE==='monster'};
 s.skin=pick(r,SKIN);s.h=.9+r()*.25;s.w=.9+r()*.25;
 s.top=pick(r,['tshirt','longsleeve','jacket','tank','hoodie','none']);
 s.topC=pick(r,COL);s.topC2=pick(r,COL);s.pat=pick(r,['plain','plain','stripes','plaid','dots','band']);
 s.bot=pick(r,['jeans','shorts','cargo','suit','torn']);
 s.botC=s.bot==='suit'?pick(r,['#222','#334','#444']):pick(r,JEANS);
 s.shoe=pick(r,['#111','#eee','#7a4a22','#a22']);
 s.hat=r()<.1?pick(r,['cap','beanie','hardhat','helmet']):pick(r,['hair','hair','nohat']);
 s.hatC=s.hat==='hardhat'?'#e8c020':s.hat==='helmet'?'#667':pick(r,s.hat==='hair'?HAIR:COL);
 s.hs=pick(r,['short','short','messy','long','receding']);s.blood=Math.floor(r()*6);s.hb=r()<.8?1+Math.floor(r()*4):0;s.miss=r()<.1?(r()<.5?0:1):-1;
 s.pose=r();s.tilt=(r()-.5)*.5;
 if(!s.z){s.skin=pick(r,HSKIN);s.blood=0;s.hb=0;s.miss=-1;s.tilt=(r()-.5)*.1;s.hat=r()<.2?pick(r,['cap','beanie']):pick(r,['hair','hair','hair','hair','hair','hair','hair','nohat']);s.hatC=s.hat==='hair'?pick(r,HAIR):pick(r,COL);if(s.bot==='torn')s.bot='jeans'}
 if(s.m){s.skin=pick(r,['#5f7a4a','#6b5a7a','#7a4a4a','#4a6a6a','#8a8a5a','#5a4a3a','#7a5a8a','#6a7a8a']);s.h=1.15+r()*.45;s.w=1.25+r()*.5;s.top=r()<.6?'none':s.top;if(r()<.5)s.bot='torn';s.hat=r()<.15?'hair':'nohat';s.blood=2+Math.floor(r()*4);s.hb=1+Math.floor(r()*4);s.miss=-1;s.horn=[0,2,2,4][Math.floor(r()*4)];s.xarm=r()<.4;s.eyes=Math.floor(r()*3);s.spk=3+Math.floor(r()*5);s.lumps=2+Math.floor(r()*5);s.big=Math.floor(r()*2);s.glow=pick(r,['#ff3010','#ffd020','#40ff60','#c040ff','#30c0ff']);s.bt=pick(r,['normal','normal','normal','legless','legless','armless','armless','crawler','crawler']);if(s.bt==='armless')s.xarm=false}
 return s}

const HGc={};
function sculptHead(v,z){const ck=v+(z?'z':'h');if(HGc[ck])return HGc[ck];const q=R(v*131+7),k=()=>.8+q()*.5,nose=k(),jaw=k(),chk=k(),brow=k(),lipA=k(),chin=k();
 const gm=new THREE.SphereGeometry(.115,64,48),p=gm.attributes.position,vv=new THREE.Vector3();
 const G=(x,y,z,cx,cy,cz,a,b,c)=>Math.exp(-(((x-cx)/a)**2+((y-cy)/b)**2+((z-cz)/c)**2));
 for(let i=0;i<p.count;i++){vv.fromBufferAttribute(p,i).divideScalar(.115);let{x,y,z}=vv;const ax=Math.abs(x);
  const g=(...a)=>G(ax,y,z,...a);
  let d=(z?.1:.06)*brow*g(.3,.33,.9,.42,.1,.5)+.04*g(0,.45,.9,.5,.2,.4)
   +.12*nose*g(0,-.05,1,.08,.28,.35)+.11*nose*g(0,-.3,1,.12,.1,.4)+.05*nose*g(.17,-.3,.95,.07,.09,.3)-.04*g(.08,-.4,.95,.06,.05,.3)
   +.05*g(.38,.16,.9,.28,.24,.5)-.16*(z?1:.45)*g(.38,.16,.9,.15,.13,.45)
   +.07*chk*g(.64,-.1,.72,.2,.2,.4)-(z?.12:.02)*chk*g(.52,-.45,.78,.22,.2,.45)+(z?0:.05)*g(.5,-.35,.8,.22,.2,.4)-(z?.06:.01)*g(.95,.22,.3,.2,.35,.5)
   +.07*lipA*g(0,-.5,.9,.3,.06,.4)+.08*lipA*g(0,-.7,.88,.3,.07,.4)-(z?.12:.07)*g(0,-.6,.88,.28,.03,.4)-.05*g(0,-.78,.85,.25,.04,.4)
   +.1*chin*g(0,-.9,.55,.25,.14,.4)+.05*jaw*g(.85,-.55,.1,.18,.25,.5);
  if(z<0)z*=1.08;const t=Math.min(1,Math.max(0,(-y-.1)/.8));x*=1-.3*t*t/jaw;z*=1-.1*t;if(y<0)y*=1.08;
  const n=new THREE.Vector3(x,y,z).normalize().multiplyScalar(1+d);p.setXYZ(i,n.x*.115,n.y*.115*1.1,n.z*.115*1.06)}
 gm.computeVertexNormals();const nm=gm.attributes.normal,mp={},key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(a=>a.toFixed(4)).join();
 for(let i=0;i<p.count;i++){const kk=key(i);(mp[kk]=mp[kk]||new THREE.Vector3()).add(new THREE.Vector3().fromBufferAttribute(nm,i))}
 for(let i=0;i<p.count;i++){const n=mp[key(i)].clone().normalize();nm.setXYZ(i,n.x,n.y,n.z)}
 return HGc[ck]=gm}
function headTex(s,r){const H=256,c=document.createElement('canvas');c.width=c.height=H/4;const q=c.getContext('2d'),kx=354,ky=644,X=m=>64+m*kx,Y=h=>128-h*ky;q.scale(.25,.25);
 const blob=(x,y,rx,ry,col)=>{q.fillStyle=col;q.beginPath();q.ellipse(x,y,rx,ry,0,0,7);q.fill()};
 q.fillStyle=s.skin;q.fillRect(0,0,H,H);
 for(let i=0;i<(s.z?70:0);i++)blob(r()*H,r()*H,10+r()*30,10+r()*30,`rgba(${r()<.5?'70,40,80':'50,70,40'},${.05+r()*.1})`);
 q.strokeStyle='rgba(50,40,90,.45)';q.lineWidth=1;for(let i=0;i<(s.z?14:0);i++){q.beginPath();let x=X((r()-.5)*.2),y=Y(r()*.14-.08);q.moveTo(x,y);for(let k=0;k<7;k++){x+=(r()-.5)*14;y+=(r()-.5)*18;q.lineTo(x,y)}q.stroke()}
 for(const sx of s.z?[-1,1]:[]){blob(X(sx*.042),Y(.022),.03*kx,.024*ky,'rgba(40,15,50,.55)');blob(X(sx*.042),Y(-.006),.028*kx,.01*ky,'rgba(70,35,80,.55)');blob(X(sx*.06),Y(-.05),.03*kx,.03*ky,'rgba(30,40,30,.28)')}
 q.strokeStyle='rgba(40,30,30,.3)';q.lineWidth=1.5;
 for(let k=0;k<4;k++){const y=Y(.055+k*.014);q.beginPath();q.moveTo(X(-.05),y);q.quadraticCurveTo(X(0),y+(r()-.5)*5,X(.05),y);q.stroke()}
 for(const sx of[-1,1]){q.beginPath();q.moveTo(X(sx*.02),Y(-.03));q.quadraticCurveTo(X(sx*.045),Y(-.06),X(sx*.04),Y(-.09));q.stroke()}
 if(r()<.4){q.fillStyle='rgba(20,20,20,.4)';for(let i=0;i<900;i++)q.fillRect(X((r()-.5)*.13),Y(-.1-r()*.06),1,1)}
 blob(X(0),Y(-.066),.027*kx,.007*ky,s.z?'#6a4a55':'#b06a68');blob(X(0),Y(-.1),.031*kx,.009*ky,s.z?'#5a3d48':'#a05a58');
 const d=q.getImageData(0,0,c.width,c.width);for(let i=0;i<d.data.length;i+=4){const k=1+(r()-.5)*.2;d.data[i]*=k;d.data[i+1]*=k;d.data[i+2]*=k}q.putImageData(d,0,0);
 q.fillStyle='rgba(150,15,15,.75)';
 if(s.z)for(const sx of[-1,1])if(r()<.6)q.fillRect(X(sx*.042)-1,Y(-.004),3,H*(.04+r()*.1));
 if(s.z&&r()<.7){q.fillRect(X(-.025),Y(-.095),4,H*.1);q.fillRect(X(.02),Y(-.1),3,H*.07)}
 for(let i=0;i<s.hb*2;i++){const x=r()*H,y=r()*H*.5;bloodMark(q,r,x,y,8+r()*14,8+r()*16)}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return M({map:t})}
function hairTex(s,r,loss){const c=document.createElement('canvas');c.width=c.height=128*Q;const q=c.getContext('2d'),base=new THREE.Color(s.hatC),sh=k=>'#'+base.clone().multiplyScalar(k).getHexString();q.scale(Q,Q);
 q.fillStyle=sh(.5);q.fillRect(0,0,128,128);
 for(let i=0;i<1500;i++){q.strokeStyle=sh(.6+r()*.8);q.lineWidth=1+r()*.6;const x=r()*128,y=r()*100;q.beginPath();q.moveTo(x,y);q.quadraticCurveTo(x+(r()-.5)*8,y+20,x+(r()-.5)*6,y+30+r()*50);q.stroke()}
 q.strokeStyle='rgba(140,14,14,.75)';for(let i=0;i<s.hb*25;i++){const x=r()*128,y=r()*100;q.lineWidth=1+r()*2;q.beginPath();q.moveTo(x,y);q.lineTo(x+(r()-.5)*4,y+10+r()*30);q.stroke()}
 q.globalCompositeOperation='destination-out';q.fillStyle='#000';
 for(let i=0;i<loss;i++){q.beginPath();q.ellipse(r()*128,r()*128,4+r()*14,4+r()*14,0,0,7);q.fill()}
 for(let x=0;x<128;x+=2)q.fillRect(x,108+r()*16,2,20);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;
 return M({map:t,alphaTest:.5,side:THREE.DoubleSide})}
function hair(hd,s,r,add,P){const m=hairTex(s,r,s.z?(s.hs==='short'?5:12):0);
 const cp=(rad,ts,tl,sc,rx,y,z)=>{const o=add(hd,new THREE.Mesh(geo('h'+[rad,ts,tl],()=>new THREE.SphereGeometry(rad,20,12,0,P*2,ts,tl)),m),0,y,z);o.scale.set(sc,1.1*sc,1.06*sc);o.rotation.x=rx;return o};
 const card=(w,h,x,y,z,ry,rz)=>{h=Math.round(h*50)/50;const o=add(hd,new THREE.Mesh(geo('q'+[w,h],()=>new THREE.PlaneGeometry(w,h)),m),x,y,z);o.rotation.set(0,ry,rz);return o};
 if(s.hs==='receding'){cp(.127,P*.38,P*.45,1,-.1,0,-.005);cp(.133,P*.45,P*.4,1,-.1,0,-.005)}
 else{cp(.126,0,P*.52,1,-.28,.002,0);cp(.133,0,P*.5,1,-.28,.004,-.002)}
 if(s.hs==='long'){cp(.131,0,P*.75,1.02,-.2,-.005,-.012);
  for(let k=0;k<10;k++){const a=P+(k/9-.5)*P*1.1,h=.2+r()*.12;card(.065,h,Math.sin(a)*.12,-.02-h/2,Math.cos(a)*.13,a,(r()-.5)*.25)}}
 if(s.hs==='messy')for(let k=0;k<9;k++){const d=new THREE.Vector3(r()-.5,.3+r()*.7,r()*.8-.5).normalize(),o=card(.07,.09,d.x*.13,d.y*.14,d.z*.13,0,0);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d)}}
const GC={};const geo=(k,f)=>GC[k]||(GC[k]=f());
const bxg=(w,h,d)=>geo('b'+[w,h,d].map(a=>a.toFixed(3)),()=>new THREE['BoxGeometry'](w,h,d));
const cone=(rd,h,m,n=8)=>new THREE.Mesh(geo('k'+[rd,h,n],()=>new THREE['ConeGeometry'](rd,h,n)),m);
const tor=(...a)=>geo('t'+a,()=>new THREE['TorusGeometry'](...a));
function build(i){const s=spec(i),r=s.r,g=new THREE.Group();g.name=(s.m?'Monster_':s.z?'Zombie_':'Mensch_')+String(i+1).padStart(3,'0');
 const skin=mat(q=>skinTex(q,r,s));

 const hM=headTex(s,r);
 const topM=s.top==='none'?mat(q=>{skinTex(q,r,s);if(s.blood>3)gash(q,r);q.strokeStyle='rgba(30,20,30,.5)';q.lineWidth=3;for(let y=20;y<100;y+=14){q.beginPath();q.moveTo(10,y);q.quadraticCurveTo(64,y+10,118,y);q.stroke()}}):mat(q=>{cloth(q,r,s.pat,s.topC,s.topC2,s.z?2+(r()*3|0):0,s.skin,s.blood);if(s.blood>3)gash(q,r)});
 const botM=mat(q=>cloth(q,r,'plain',s.botC,s.botC,s.z?(s.bot==='torn'?6:2):0,s.skin,s.z?2:0));
 const hatM=mat(q=>{q.fillStyle=s.hatC;q.fillRect(0,0,S,S);grain(q,r,.3)},{roughness:.6});
 const shoeM=col(s.shoe,{roughness:.5}),bone=col('#e6e0cc'),flesh=col('#7a0e0e',{roughness:.35}),dark=col('#1a1218');
 const cyl=(a,b,h,m,n=14)=>new THREE.Mesh(geo('c'+[a,b,h,n],()=>new THREE.CylinderGeometry(a,b,h,n)),m);
 const sph=(rd,m,x=1,y=1,z=1)=>{const o=new THREE.Mesh(geo('s'+rd,()=>new THREE.SphereGeometry(rd,16,12)),m);o.scale.set(x,y,z);return o};
 const cap=(rd,th,m)=>{th=Math.round(th*100)/100;return new THREE.Mesh(geo('p'+[rd,th],()=>new THREE.SphereGeometry(rd,16,10,0,Math.PI*2,0,th)),m)};
 const add=(p,o,x=0,y=0,z=0)=>{o.position.set(x,y,z);p.add(o);return o};
 const grp=(p,x,y,z)=>add(p,new THREE.Group(),x,y,z);
 // Becken + Beine
 add(g,cyl(.172,.158,.22,botM,16),0,.93,0).scale.z=.7;
 for(let k=0;k<(s.bt==='legless'?0:2);k++){const x=k?.1:-.1,th=grp(g,x,.95,0);th.name=k?'legR':'legL';th.rotation.x=s.bt==='crawler'?-.6+(r()-.5)*.2:(k?-1:1)*(s.z?r()*.4-.05:r()*.12);
  add(th,cyl(.085,.068,.46,skin),0,-.23,0);
  if(s.bot==='shorts')add(th,cyl(.098,.09,.3,botM),0,-.16,0);else add(th,cyl(.098,.078,.47,botM),0,-.23,0);
  const kn=grp(th,0,-.46,0);kn.rotation.x=s.bt==='crawler'?1.5+r()*.15:s.z?r()*.5:r()*.1;add(kn,sph(.062,skin));
  add(kn,cyl(.062,.045,.45,skin),0,-.225,0);
  if(s.bot!=='shorts')add(kn,cyl(.072,.054,.45,botM),0,-.225,0);
  const ft=add(kn,sph(.06,shoeM,1,.65,2.3),0,-.47,.045);ft.rotation.x=-(th.rotation.x+kn.rotation.x);
  add(kn,cyl(.052,.05,.07,shoeM),0,-.44,0)}
 if(s.bt==='legless')add(g,sph(.15,skin,1,.9,.75),0,.86,0);
 // Oberkörper
 const tr=grp(g,0,1.0,0);tr.name='torso';tr.rotation.x=s.bt==='crawler'?1.3+r()*.1:s.bt==='legless'?.5+r()*.15:s.z?(s.m?.35+r()*.3:.1+r()*.2):.02+r()*.05;
 add(tr,cyl(.2,.155,.56,topM,16),0,.28,0).scale.z=.66;
 add(tr,cyl(.17,.165,.035,col('#2a1a10'),16),0,.01,0).scale.z=.7;
 add(tr,cyl(.052,.058,.12,skin),0,.62,0);
 const sUp={tshirt:.17,longsleeve:.3,jacket:.3,hoodie:.3,tank:0,none:0}[s.top],sFo=sUp>.2;
 if(s.top!=='none'&&s.top!=='tank'){const c=add(tr,new THREE.Mesh(tor(.066,.014,8,16),topM),0,.575,0);c.rotation.x=Math.PI/2}
 if(s.top==='hoodie')add(tr,sph(.11,topM,1.1,.9,.8),0,.6,-.06);
 // Arme
 const base=s.bt==='crawler'?-1.35+(r()-.5)*.2:s.bt==='legless'?-(.8+r()*.2):!s.z?(r()-.5)*.4:s.pose<.5?-(1.15+r()*.4):-(.3+r()*.6);
 for(let k=0;k<2;k++){const sg=k?1:-1,sh=grp(tr,sg*.225,.5,0);sh.name=k?'armR':'armL';
  add(sh,sph(.075,sUp?topM:skin));
  if(s.miss===k||s.bt==='armless'){sh.rotation.x=-.2;sh.rotation.z=sg*.15;add(sh,cyl(.055,.05,.14,skin),0,-.07,0);add(sh,cyl(.012,.012,.08,bone,6),0,-.18,0);add(sh,sph(.05,flesh),0,-.15,0);continue}
  if(s.m&&s.bt==='normal'&&k===s.big)sh.scale.setScalar(1.7);sh.rotation.x=base+(r()-.5)*.3;sh.rotation.z=sg*(.05+r()*.25);
  add(sh,cyl(.058,.048,.3,skin),0,-.15,0);if(sUp)add(sh,cyl(.068,.057,sUp,topM),0,-sUp/2,0);
  const el=grp(sh,0,-.3,0);el.rotation.x=-(s.bt==='crawler'?.3+r()*.2:s.bt==='legless'?.1:s.z?.15+r()*.6:.1+r()*.25);
  add(el,sph(.05,skin));add(el,cyl(.047,.036,.27,skin),0,-.135,0);if(sFo)add(el,cyl(.056,.044,.25,topM),0,-.125,0);
  add(el,sph(.04,skin,1,1.3,.55),0,-.31,0);
  for(let f=0;f<4;f++){const fg=add(el,s.m?cyl(.011,.002,.15,col('#d8d0b8'),5):cyl(.008,.006,.07,skin,5),(f-1.5)*.014,-.37-(s.m?.04:0),.01);fg.rotation.x=-(.3+r()*.5)}}
 // Kopf
 const nk=grp(tr,0,.66,0);nk.name='head';nk.rotation.z=s.tilt;nk.rotation.x=s.bt==='crawler'?-1.1+r()*.3:s.z?r()*.35:r()*.08;const hd=grp(nk,0,.1,0);hd.scale.set(.78,.92,.85);
 const pm=col('#'+new THREE.Color(s.skin).multiplyScalar(.9).getHexString()),lip=col('#5a3d48'),tc=['#cfc79a','#bdb287','#d8d2b0'];
 add(hd,new THREE.Mesh(sculptHead(s.i%6,s.z),hM));
 add(hd,sph(.006,dark,1,.7,1),-.009,-.047,.136);add(hd,sph(.006,dark,1,.7,1),.009,-.047,.136);
 const eC=s.z?pick(r,['#d8d8a0','#e8e8d0','#c8d890']):'#f2f2ec',ir=s.z?pick(r,['#7d8a5a','#8a7a4a','#6a7a8a']):pick(r,['#4a3a2a','#3a5a7a','#4a6a3a','#2a2a2a','#6a4a2a']);
 const eyeM=mat(q=>{q.fillStyle=eC;q.fillRect(0,0,S,S);q.strokeStyle='rgba(150,30,30,.6)';for(let k=0;k<(s.z?16:0);k++){q.beginPath();q.moveTo(32+(r()-.5)*80,64+(r()-.5)*90);q.lineTo(32+(r()-.5)*14,64+(r()-.5)*24);q.stroke()}
  q.fillStyle=ir;q.beginPath();q.ellipse(32,64,10,19,0,0,7);q.fill();q.fillStyle='#111';q.beginPath();q.ellipse(32,64,4,8,0,0,7);q.fill()},{roughness:.25});
 for(const sx of[-1,1]){add(hd,sph(.03,col(s.z?'#2a1030':'#'+new THREE.Color(s.skin).multiplyScalar(.78).getHexString()),1,.7,.5),sx*.043,.021,.092);const e=add(hd,sph(.019,eyeM,1.28,1.09,1.18),sx*.043,.022,.1);e.rotation.y=(r()-.5)*(s.z?.5:.05);
  const lid=add(hd,cap(.0215,Math.PI*(s.z?.28+r()*.2:.2),pm),sx*.043,.022,.1);lid.rotation.x=.4;lid.scale.set(1.28,1.09,1.18);
  add(hd,sph(.022,pm,.4,1,.7),sx*.117,0,0);add(hd,sph(.011,col('#3a1520'),.3,.7,.5),sx*.121,0,.002)}
 add(hd,new THREE.Mesh(bxg(.062,s.z?.026:.006,.016),col('#1a0508')),0,-.08,.1);

 for(let t=-3;t<=(s.z?2:-4);t++){add(hd,new THREE.Mesh(bxg(.01,.012+r()*.006,.008),col(pick(r,tc))),t*.0105+.005,-.069,.106);
  if(r()<.85)add(hd,new THREE.Mesh(bxg(.01,.01+r()*.005,.008),col(pick(r,tc))),t*.0105+.005+(r()-.5)*.003,-.09,.105)}

 const P=Math.PI;
 if(s.hat==='hair')hair(hd,s,r,add,P);
 else if(s.hat==='cap'){const o=add(hd,cap(.122,P*.5,hatM));o.scale.set(1,1.1,1.06);o.rotation.x=-.15;add(hd,sph(.08,hatM,1.2,.07,1.1),0,.045,.12)}
 else if(s.hat==='beanie'){const o=add(hd,cap(.128,P*.62,hatM));o.scale.set(1,1.1,1.06);const c=add(hd,new THREE.Mesh(tor(.12,.02,8,16),hatM),0,.02,0);c.rotation.x=P/2}
 else if(s.hat==='hardhat'){const o=add(hd,cap(.13,P*.5,hatM));o.scale.set(1,1.1,1.06);add(hd,sph(.14,hatM,1,.06,1.1),0,.03,.01);add(hd,new THREE.Mesh(bxg(.02,.012,.2),hatM),0,.14,0)}
 else if(s.hat==='helmet'){const o=add(hd,cap(.13,P*.62,col(s.hatC,{metalness:.6,roughness:.35})));o.scale.set(1,1.1,1.06)}
 if(s.m){const hornM=col('#cfc6a8',{roughness:.5}),claw=col('#d8d0b8'),lump=col('#'+new THREE.Color(s.skin).offsetHSL(0,.05,-.05).getHexString()),gl=col(s.glow,{emissive:s.glow,emissiveIntensity:1});
  eyeM.emissive=new THREE.Color(s.glow);eyeM.emissiveIntensity=.9;
  [[0,.075,.1],[-.07,-.02,.09],[.07,-.02,.09]].slice(0,s.eyes).forEach(q=>add(hd,sph(.012,gl,1.28,1.09,1.18),q[0],q[1],q[2]));
  for(let k=0;k<s.horn;k++){const sd=k%2?1:-1,row=k>>1,len=.14+r()*.14-row*.04,an=.5+row*.25,bx0=sd*(.07+row*.03),by0=.08-row*.06;
   const c=add(hd,cone(.022,len,hornM),bx0+sd*Math.sin(an)*len/2,by0+Math.cos(an)*len/2,0);c.rotation.z=-sd*an}
  for(const sx of[-1,1])add(hd,cone(.007,.04+r()*.03,hornM,6),sx*.03,-.075,.108);
  for(let k=0;k<s.spk;k++){const sz=.05+r()*.04,c=add(tr,cone(.025,sz*2.5,hornM),0,.08+k*(.5/s.spk),-.14-sz);c.rotation.x=-1.3}
  for(const sx of[-1,1]){const c=add(tr,cone(.03,.14,hornM),sx*.27,.6,0);c.rotation.z=-sx*.7}
  for(let k=0;k<s.lumps;k++)add(tr,sph(.03+r()*.04,lump),(r()-.5)*.34,.08+r()*.45,(r()<.5?1:-1)*.1);
  if(s.xarm)for(const sx of[-1,1]){const sh=grp(tr,sx*.2,.25,0);sh.rotation.x=-(.8+r()*.5);sh.rotation.z=sx*.3;add(sh,cyl(.05,.042,.28,skin),0,-.14,0);
   const el=grp(sh,0,-.28,0);el.rotation.x=-(.2+r()*.5);add(el,sph(.044,skin));add(el,cyl(.042,.032,.26,skin),0,-.13,0);add(el,sph(.04,skin,1,1.3,.55),0,-.3,0);
   for(let f=0;f<3;f++){const fg=add(el,cyl(.011,.002,.15,claw,5),(f-1)*.016,-.38,.01);fg.rotation.x=-.4}}}
 const dy={legless:.9,crawler:.42}[s.bt];if(dy)g.children.forEach(c=>c.position.y-=dy);
 g.scale.set(s.w,s.h*.96,s.w);g.userData.spec=s;return g}

export const ZOMBIE_COUNT = N;

// Statische Teile je Gelenk-Gruppe zu wenigen Meshes verschmelzen (Draw-Calls: ~100 -> ~35 pro Zombie)
function bake(group) {
  const buckets = new Map(), meshes = group.children.filter((c) => c.isMesh);
  for (const m of meshes) {
    m.updateMatrix();
    const geo = m.geometry.clone().applyMatrix4(m.matrix);
    (buckets.get(m.material) || buckets.set(m.material, []).get(m.material)).push(geo);
    group.remove(m);
  }
  for (const [mat, geos] of buckets) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (merged) group.add(new THREE.Mesh(merged, mat));
    else for (const g of geos) group.add(new THREE.Mesh(g, mat));
  }
  for (const c of group.children.filter((c) => !c.isMesh)) bake(c);
}

export function buildZombie(i) {
  const g = build(((i % N) + N) % N);
  bake(g);
  g.updateMatrixWorld(true);
  const v = new THREE.Vector3(); g.getObjectByName('head').getWorldPosition(v);
  g.userData.headY = v.y + 0.1;
  return g;
}

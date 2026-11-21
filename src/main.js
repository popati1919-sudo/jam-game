import Phaser from 'phaser';
import './style.css';

const WORLD={w:3200,h:2400}, TILE=100;
const state={money:2500,health:100,rep:0,wanted:0,weapon:0,mission:0,robbed:false,drugRun:false,car:null,paused:true,gameStarted:false,day:1};
const $=id=>document.getElementById(id);
const keys={};
let scene,toastTimer;
const roads=[{x:0,y:360,w:3200,h:100},{x:0,y:760,w:3200,h:100},{x:0,y:1160,w:3200,h:100},{x:0,y:1560,w:3200,h:100},{x:0,y:1960,w:3200,h:100},{x:400,y:0,w:100,h:2400},{x:1000,y:0,w:100,h:2400},{x:1600,y:0,w:100,h:2400},{x:2200,y:0,w:100,h:2400},{x:2800,y:0,w:100,h:2400}];
const districts=[{name:'SOUTH BEACH',x:0,y:0,w:1200,h:800,color:0x8cae9a},{name:'CENTRO',x:1200,y:0,w:1100,h:1000,color:0x9a9a83},{name:'LITTLE HAVANA',x:0,y:850,w:1400,h:850,color:0x9b8469},{name:'PORT INDUSTRIEL',x:1700,y:1100,w:1500,h:1300,color:0x78847b},{name:'PALM HEIGHTS',x:1100,y:1700,w:600,h:700,color:0x8c9e77}];
const missions=[
{title:'Bienvenue à Vice District',text:'Rends-toi au garage indiqué en jaune et récupère ton premier véhicule.',x:780,y:610,reward:250,action:'reach'},
{title:'Un service entre amis',text:'Va rencontrer Maya près du diner. Appuie sur F pour lui parler.',x:1350,y:910,reward:450,action:'interact'},
{title:'Livraison express',text:'Prends la voiture et rejoins le marqueur au port avant la fin du temps.',x:2700,y:1830,reward:700,action:'drive'},
{title:'La nuit appartient à la ville',text:'Entre dans la boutique signalée et récupère le sac. Attention aux témoins.',x:1850,y:690,reward:900,action:'rob'},
{title:'Dernier détour',text:'Échappe à la police et rejoins la planque.',x:500,y:2050,reward:1400,action:'escape'}
];
function notify(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
function hud(){ $('money').textContent='$ '+state.money.toLocaleString('fr-CA');$('health').textContent=Math.max(0,state.health)+'%';$('rep').textContent=state.rep;$('wanted').querySelector('b').textContent='★'.repeat(state.wanted)+'☆'.repeat(6-state.wanted);$('mission-title').textContent=missions[state.mission]?.title||'Vice District est à toi';$('mission-text').textContent=missions[state.mission]?.text||'Explore la ville, découvre les activités et construis ta réputation.';$('mission-progress').style.width=state.mission/5*100+'%';}
function completeMission(){const m=missions[state.mission];if(!m)return;state.money+=m.reward;state.rep+=10;state.mission++;notify('Mission terminée · +$'+m.reward+' · +10 réputation');hud();}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
class OpenWorld extends Phaser.Scene{
constructor(){super('world');}
create(){
scene=this;this.physics.world.setBounds(0,0,WORLD.w,WORLD.h);this.cameras.main.setBounds(0,0,WORLD.w,WORLD.h);this.drawMap();
this.player=this.add.container(720,520);const shadow=this.add.ellipse(0,17,30,12,0x000000,.3);const body=this.add.ellipse(0,0,20,27,0xd9a35f).setStrokeStyle(2,0x282b28);const head=this.add.circle(0,-15,8,0x8f5e43).setStrokeStyle(1,0x1b2524);const hair=this.add.arc(0,-17,8,180,360,false,0x211d1b).setOrigin(.5);this.player.add([shadow,body,head,hair]);this.player.setDepth(5000);
this.cameras.main.startFollow(this.player,true,.09,.09);this.cameras.main.setZoom(1);
this.cars=[];this.peds=[];this.police=[];this.createCars();this.createPedestrians();this.createMissionMarker();this.createProps();
this.input.keyboard.on('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' '){e.preventDefault();this.playerAction();}if(e.key.toLowerCase()==='e')this.enterExitCar();if(e.key.toLowerCase()==='f')this.interact();if(e.key.toLowerCase()==='m')$('minimap').parentElement.classList.toggle('map-large');});
this.input.keyboard.on('keyup',e=>keys[e.key.toLowerCase()]=false);
this.input.on('pointerdown',p=>{if(p.rightButton)this.playerAction();});
this.time.addEvent({delay:16000,loop:true,callback:()=>{state.day++;this.cameras.main.setAlpha(1);}});
this.physics.world.pause();
this.renderMiniMap();
}
drawMap(){
const g=this.add.graphics();
const rand=(n)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
g.fillStyle(0x899b78).fillRect(0,0,WORLD.w,WORLD.h);
g.fillStyle(0x1f7187).fillRect(0,0,WORLD.w,145);
for(let i=0;i<70;i++){const x=rand(i+900)*WORLD.w,y=rand(i+1200)*125;g.lineStyle(2,0x70a8ad,.18);g.beginPath();g.arc(x,y,12+rand(i+1800)*45,0,Math.PI*1.6,false);g.strokePath();}
g.fillStyle(0xd9c69a).fillRect(0,140,WORLD.w,95);
g.fillStyle(0xf0dcb0,.7).fillRect(0,148,WORLD.w,8);
g.fillStyle(0x9baf85,.25).fillRect(0,235,WORLD.w,WORLD.h-235);
districts.forEach((d,i)=>{g.fillStyle(d.color,.13).fillRect(d.x,d.y,d.w,d.h);});
for(let i=0;i<240;i++){
 const x=rand(i+40)*WORLD.w,y=260+rand(i+540)*2100;
 if(roads.some(r=>x>r.x-42&&x<r.x+r.w+42&&y>r.y-42&&y<r.y+r.h+42))continue;
 const park=rand(i+850)>.78;
 if(park){g.fillStyle(0x527b50,.6).fillRoundedRect(x-35,y-27,70,54,12);g.lineStyle(2,0x9aaf78,.3).strokeRoundedRect(x-35,y-27,70,54,12);}
 for(let t=0;t<(park?5:1);t++){
  const tx=x+(rand(i*7+t+10)-.5)*(park?55:12),ty=y+(rand(i*9+t+20)-.5)*(park?40:12);
  g.fillStyle(0x253b2d,.22).fillEllipse(tx+5,ty+8,25,15);
  g.fillStyle([0x416b45,0x4d7548,0x587d4d][(i+t)%3]).fillCircle(tx,ty,park?9:13);
  g.fillStyle(0x8ca66a,.35).fillCircle(tx-4,ty-5,park?4:6);
 }
}
this.buildings=[];
for(let i=0;i<190;i++){
 let x=250+rand(i+51)*2850,y=265+rand(i+88)*2070;
 if(roads.some(r=>x>r.x-105&&x<r.x+r.w+105&&y>r.y-105&&y<r.y+r.h+105))continue;
 const w=42+rand(i+120)*72,h=42+rand(i+240)*72;
 const palette=[0xc8b99c,0xb9b8a8,0x9eaaa1,0xd2bd98,0xa7b4ad,0xb28f76];
 const col=palette[i%palette.length];
 g.fillStyle(0x17251f,.23).fillRoundedRect(x+9,y+12,w,h,4);
 g.fillStyle(0x59675d,.5).fillRoundedRect(x-4,y-4,w+8,h+8,5);
 g.fillStyle(col).fillRoundedRect(x,y,w,h,4);
 g.fillStyle(0xe6d9bd,.72).fillRoundedRect(x+5,y+5,w-10,7,2);
 g.fillStyle(0x777d70,.28).fillRect(x+5,y+h-9,w-10,4);
 g.lineStyle(1,0x38463d,.55).strokeRoundedRect(x,y,w,h,4);
 for(let wx=x+10;wx<x+w-8;wx+=16){
  g.fillStyle(0x49666a,.9).fillRect(wx,y+18,8,9);
  g.lineStyle(1,0xe4d9bf,.6).lineBetween(wx+4,y+18,wx+4,y+27);
 }
 if(w>76&&h>76){g.fillStyle(0x788b78,.75).fillRoundedRect(x+w*.35,y+h*.35,w*.3,h*.3,3);g.fillStyle(0x9eaa8a,.5).fillRect(x+w*.4,y+h*.4,w*.2,h*.2);}
 this.buildings.push({x:x+w/2,y:y+h/2,w,h});
}
roads.forEach(r=>{
 const horizontal=r.w>r.h;
 g.fillStyle(0x6e7867,.35).fillRect(r.x-5,r.y-5,r.w+10,r.h+10);
 g.fillStyle(0xc0bba4).fillRect(r.x-5,r.y-5,r.w+10,r.h+10);
 g.fillStyle(0x777e78).fillRect(r.x,r.y,r.w,r.h);
 g.fillStyle(0x41494a).fillRect(r.x+5,r.y+5,r.w-10,r.h-10);
 g.lineStyle(2,0xe1d2a1,.62);
 if(horizontal){
  for(let x=r.x+20;x<r.x+r.w;x+=54)g.lineBetween(x,r.y+r.h/2,x+27,r.y+r.h/2);
  g.lineStyle(2,0xbac0b2,.5);g.lineBetween(r.x,r.y+5,r.x+r.w,r.y+5);g.lineBetween(r.x,r.y+r.h-5,r.x+r.w,r.y+r.h-5);
  for(let x=100;x<WORLD.w;x+=600){g.fillStyle(0xe9e5d6,.65);for(let k=0;k<5;k++)g.fillRect(x+k*8,r.y+10,4,13);for(let k=0;k<5;k++)g.fillRect(x+k*8,r.y+r.h-23,4,13);}
 }else{
  for(let y=r.y+20;y<r.y+r.h;y+=54)g.lineBetween(r.x+r.w/2,y,r.x+r.w/2,y+27);
  g.lineStyle(2,0xbac0b2,.5);g.lineBetween(r.x+5,r.y,r.x+5,r.y+r.h);g.lineBetween(r.x+r.w-5,r.y,r.x+r.w-5,r.y+r.h);
 }
});
for(let i=0;i<55;i++){
 const x=rand(i+3300)*WORLD.w,y=280+rand(i+4400)*2050;
 if(roads.some(r=>x>r.x-8&&x<r.x+r.w+8&&y>r.y-8&&y<r.y+r.h+8))continue;
 g.fillStyle(0x26372c,.2).fillEllipse(x+3,y+7,24,13);
 g.fillStyle(0x557c51).fillCircle(x,y,10+rand(i+5500)*5);
 g.fillStyle(0x9eb477,.35).fillCircle(x-3,y-4,5);
}
this.add.text(75,270,'VICE BEACH',{font:'800 34px Arial',color:'#fff1d0',stroke:'#293c38',strokeThickness:6}).setDepth(2);
this.add.text(1260,255,'CENTRO',{font:'800 36px Arial',color:'#fff1d0',stroke:'#293c38',strokeThickness:6}).setDepth(2);
this.add.text(85,925,'LITTLE HAVANA',{font:'800 30px Arial',color:'#fff1d0',stroke:'#293c38',strokeThickness:6}).setDepth(2);
this.add.text(2180,1270,'PORT INDUSTRIEL',{font:'800 30px Arial',color:'#fff1d0',stroke:'#293c38',strokeThickness:6}).setDepth(2);
this.add.text(1160,1810,'PALM HEIGHTS',{font:'800 29px Arial',color:'#fff1d0',stroke:'#293c38',strokeThickness:6}).setDepth(2);
g.fillStyle(0x267b91,.9).fillRoundedRect(1320,285,470,245,28);
g.lineStyle(8,0xd5c79e,.85).strokeRoundedRect(1320,285,470,245,28);
g.lineStyle(3,0x7cb4b2,.45);
for(let i=0;i<18;i++)g.lineBetween(1340,305+i*11,1765,305+i*11);
this.add.text(1450,390,'LAC AZUR',{font:'800 18px Arial',color:'#eff3d9',stroke:'#1e5260',strokeThickness:3}).setDepth(3);
}
createCars(){const palette=[0xc94f42,0x2f6d9c,0xd7c18b,0x3b4143,0xd9d9ce,0x4c7a56,0x9e6d9e];for(let i=0;i<24;i++){let r=roads[i%roads.length],horizontal=r.w>r.h,x=horizontal?120+((i*137)%2900):r.x+50,y=horizontal?r.y+25+((i%2)*48):120+((i*113)%2150);let c=this.add.container(x,y);let shadow=this.add.ellipse(0,5,53,27,0x000000,.25);let base=this.add.rectangle(0,0,48,23,palette[i%palette.length]).setStrokeStyle(2,0x222c2a);let roof=this.add.rectangle(-2,0,22,17,0x9db8b8).setStrokeStyle(1,0x273b3b);let lights=this.add.rectangle(22,0,4,17,0xe9d6a2);c.add([shadow,base,roof,lights]);c.setDepth(2000+i);this.cars.push({sprite:c,x,y,dx:horizontal?1.1:0,dy:horizontal?0:1.1,ai:true,occupied:false});}}
createPedestrians(){for(let i=0;i<36;i++){let x=300+(i*79)%2600,y=300+(i*131)%1900;if(roads.some(r=>x>r.x-25&&x<r.x+r.w+25&&y>r.y-25&&y<r.y+r.h+25))continue;let p=this.add.container(x,y);p.add([this.add.ellipse(0,9,14,6,0x000000,.25),this.add.circle(0,0,6,[0xd0a078,0x7d9eaa,0xb48a6e,0x596f5e][i%4]),this.add.rectangle(0,9,9,13,[0xd1a24c,0x536c8b,0x9b665b,0x52634f][i%4])]);p.setDepth(3000+i);this.peds.push({sprite:p,origin:{x,y},phase:i*.8});}}
createProps(){this.add.rectangle(780,610,60,36,0x42664e).setStrokeStyle(3,0xe8bd57).setDepth(4);this.add.text(744,576,'GARAGE',{font:'bold 12px Arial',color:'#fff4d0'}).setDepth(5);this.add.rectangle(1350,910,42,42,0x8d6547).setStrokeStyle(3,0xe8bd57).setDepth(4);this.maya=this.add.text(1320,870,'MAYA  [F]',{font:'bold 12px Arial',color:'#fff4d0',backgroundColor:'#293a32',padding:4}).setDepth(5);this.store=this.add.rectangle(1850,690,58,50,0x9c6945).setStrokeStyle(3,0xe8bd57).setDepth(4);this.add.text(1810,650,'MARKET  [F]',{font:'bold 12px Arial',color:'#fff4d0'}).setDepth(5);}
createMissionMarker(){this.marker=this.add.circle(missions[0].x,missions[0].y,27,0xf4bd4f,.25).setStrokeStyle(4,0xffdf80).setDepth(4900);this.tweens.add({targets:this.marker,scale:1.5,alpha:.3,duration:750,yoyo:true,repeat:-1});}
update(time,delta){
if(!state.gameStarted)return;const dt=Math.min(delta/1000,.05);const p=this.player;
let speed=state.car?260:state.health<30?120:175;if(keys.shift)speed*=1.45;
let dx=0,dy=0;if(keys.w||keys.z||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if(keys.a||keys.q||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;const l=Math.hypot(dx,dy)||1;dx=dx/l;dy=dy/l;
if(state.car){const car=state.car;car.speed=Phaser.Math.Clamp((car.speed||0)+(dy!==0?dy*dt*280:-car.speed*dt*1.2),-220,360);car.sprite.rotation+=dx*dt*2.4*(car.speed>=0?1:-1);car.sprite.x+=Math.cos(car.sprite.rotation-Math.PI/2)*car.speed*dt;car.sprite.y+=Math.sin(car.sprite.rotation-Math.PI/2)*car.speed*dt;p.setPosition(car.sprite.x,car.sprite.y);if(Math.abs(car.speed)>180&&this.police.length){}}
else {p.x+=dx*speed*dt;p.y+=dy*speed*dt;if(dx||dy)p.rotation=Math.atan2(dy,dx)+Math.PI/2;}
p.x=Phaser.Math.Clamp(p.x,25,WORLD.w-25);p.y=Phaser.Math.Clamp(p.y,235,WORLD.h-25);
this.cars.forEach(c=>{if(c.ai&&!c.occupied){c.x+=c.dx*42*dt;c.y+=c.dy*42*dt;if(c.x>WORLD.w-30)c.x=20;if(c.y>WORLD.h-30)c.y=250;c.sprite.setPosition(c.x,c.y);}});
this.peds.forEach((v,i)=>{v.phase+=dt;v.sprite.x=v.origin.x+Math.sin(v.phase*.4)*15;v.sprite.y=v.origin.y+Math.cos(v.phase*.3)*12;});
if(state.wanted>0){this.spawnPolice(dt);this.police.forEach(pol=>{let angle=Phaser.Math.Angle.Between(pol.sprite.x,pol.sprite.y,p.x,p.y);pol.sprite.x+=Math.cos(angle)*pol.speed*dt;pol.sprite.y+=Math.sin(angle)*pol.speed*dt;if(dist(pol.sprite,p)<26){state.health=Math.max(0,state.health-8*dt);if(state.health<=0){state.health=100;state.money=Math.max(0,state.money-300);state.wanted=0;notify('Tu as été arrêté. Amende de $300.');this.clearPolice();}}});if(this.police.length&&state.wanted>0&&!this.police.some(pol=>dist(pol.sprite,p)<450)){this.escapeTimer=(this.escapeTimer||0)+dt;if(this.escapeTimer>12){state.wanted=Math.max(0,state.wanted-1);this.escapeTimer=0;notify('La police a perdu ta trace.');}}else this.escapeTimer=0;}
this.marker.setPosition(missions[state.mission]?.x||p.x,missions[state.mission]?.y||p.y);if(missions[state.mission]?.action==='reach'&&dist(p,missions[0])<70&&!state.car){completeMission();this.marker.setPosition(missions[1].x,missions[1].y);}
$('location').textContent=this.getDistrict(p.x,p.y);this.updateInteraction();this.renderMiniMap();hud();
}
getDistrict(x,y){return districts.find(d=>x>d.x&&x<d.x+d.w&&y>d.y&&y<d.y+d.h)?.name||'VICE DISTRICT';}
updateInteraction(){const p=this.player;let msg='';if(!state.car){const near=this.cars.find(c=>dist(c.sprite,p)<65&&!c.occupied);if(near)msg='[E] Monter dans le véhicule';if(dist(p,{x:1350,y:910})<75)msg='[F] Parler à Maya';if(dist(p,{x:1850,y:690})<75)msg='[F] Braquer le Market';}else msg='[E] Sortir du véhicule · [F] Klaxon';$('interaction').textContent=msg;$('interaction').classList.toggle('show',!!msg);}
enterExitCar(){if(state.car){const c=state.car;c.occupied=false;c.ai=true;this.player.setPosition(c.sprite.x+45,c.sprite.y);state.car=null;notify('Tu es sorti du véhicule.');return;}const car=this.cars.find(c=>dist(c.sprite,this.player)<70&&!c.occupied);if(!car){notify('Aucun véhicule à proximité.');return;}car.occupied=true;car.ai=false;car.speed=0;state.car=car;notify('Véhicule récupéré. Appuie sur ZQSD pour conduire.');}
interact(){const p=this.player;if(state.car){notify('Klaxon !');return;}if(dist(p,{x:1350,y:910})<80){if(state.mission===1)completeMission();else notify('Maya : « On a du travail. Suis le marqueur. »');return;}if(dist(p,{x:1850,y:690})<80){if(!state.robbed){state.robbed=true;state.money+=850;state.wanted=Math.min(6,state.wanted+2);completeMissionIf(3);notify('Caisse récupérée : +$850. Les témoins ont appelé la police !');}else notify('La boutique a fermé après le braquage.');return;}notify('Rien à faire ici.');}
playerAction(){if(state.car){notify('Klaxon !');return;}if(state.weapon===0){notify('Aucune arme équipée.');return;}this.add.circle(this.player.x+Math.cos(this.player.rotation)*55,this.player.y+Math.sin(this.player.rotation)*55,7,0xffd17a).setDepth(6000).setAlpha(.8);state.wanted=Math.min(6,state.wanted+1);notify('Coup de feu entendu. Niveau de recherche augmenté.');}
completeMissionIf(n){if(state.mission===n)completeMission();}
spawnPolice(dt){if(this.police.length<Math.min(6,state.wanted+1)&&Math.random()<dt*.25){const angle=Math.random()*Math.PI*2,x=Phaser.Math.Clamp(this.player.x+Math.cos(angle)*600,30,WORLD.w-30),y=Phaser.Math.Clamp(this.player.y+Math.sin(angle)*600,240,WORLD.h-30);let s=this.add.container(x,y);s.add([this.add.rectangle(0,0,44,22,0x273c91).setStrokeStyle(2,0xe2e5de),this.add.rectangle(0,-13,10,4,0xef6262)]);s.setDepth(4000);this.police.push({sprite:s,speed:110+state.wanted*12});}}
clearPolice(){this.police.forEach(p=>p.sprite.destroy());this.police=[];}
renderMiniMap(){const c=$('minimap'),ctx=c.getContext('2d');ctx.fillStyle='#6e906e';ctx.fillRect(0,0,180,180);ctx.fillStyle='#267b91';ctx.fillRect(0,0,180,12);ctx.fillStyle='#404849';roads.forEach(r=>ctx.fillRect(r.x/WORLD.w*180,r.y/WORLD.h*180,Math.max(3,r.w/WORLD.w*180),Math.max(3,r.h/WORLD.h*180)));ctx.fillStyle='#e9b34c';ctx.beginPath();ctx.arc(this.player.x/WORLD.w*180,this.player.y/WORLD.h*180,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e15d55';this.police.forEach(p=>{ctx.fillRect(p.sprite.x/WORLD.w*180-2,p.sprite.y/WORLD.h*180-2,4,4);});}
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game-container',backgroundColor:'#77966f',scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},render:{antialias:true,pixelArt:false},scene:[OpenWorld],physics:{default:'arcade',arcade:{debug:false}}});
$('start-game').addEventListener('click',()=>{state.gameStarted=true;state.paused=false;$('start-screen').style.display='none';game.scene.start('world');$('status').textContent='LIBERTÉ TOTALE';notify('Bienvenue à Vice District. Bonne chance !');});
window.addEventListener('keydown',e=>{if(e.key===' '||e.key.startsWith('Arrow'))e.preventDefault();});
document.querySelectorAll('[data-key]').forEach(btn=>{const k=btn.dataset.key;btn.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;});['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,()=>keys[k]=false));});
hud();

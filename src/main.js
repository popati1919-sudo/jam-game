import Phaser from 'phaser';
import './style.css';

const GRID=64,TILE_W=40,TILE_H=40;
const COST={road:35,power:2500,water:1800,park:700,school:3000,clinic:4000};
const COLORS={grass:0x648d62,grass2:0x6d9867,road:0x59636a,residential:0x86c77b,commercial:0xe7bd68,industrial:0xd58a72,power:0xd7a85b,water:0x6cb7cb,park:0x75b879,school:0xd5c18b,clinic:0xe18b8b};
const freshState=()=>{const tiles={};for(let x=0;x<=8;x++)tiles[x+',12']={type:'road'};return{money:25000,day:1,population:0,happiness:65,speed:1,paused:true,tool:'select',tiles,buildings:[],residents:0,jobs:0,power:0,water:0};};
const state=freshState();
const key=(x,y)=>x+','+y,get=(x,y)=>state.tiles[key(x,y)],ui=id=>document.getElementById(id);
let sceneRef,toastTimer,simulationTimer=null,autosaveTimer=null,routeStart=null,tutorialStep=0,tutorialActive=false,tutorialDone=false,networkCache=null,networkDirty=true,serviceRoadCaches={power:null,water:null},lastEmergencyGrant=0,currentOverlay='none',lastSeasonEvent=-1;
function stopUIEvent(e){e.stopPropagation();}
function syncPauseUI(){ui('pause').textContent=state.paused?'▶ JOUER':'Ⅱ PAUSE';ui('sim-status').textContent=state.paused?'SIMULATION EN PAUSE':'SIMULATION · '+state.speed+'×';}
function notify(msg){const el=ui('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);ui('city-news').textContent=msg;}
function iso(x,y){return{x:x*TILE_W+(sceneRef.scale.width-GRID*TILE_W)/2+TILE_W/2,y:y*TILE_H+(sceneRef.scale.height-GRID*TILE_H)/2+TILE_H/2};}
function gridAt(px,py){const p=sceneRef.cameras.main.getWorldPoint(px,py),ox=(sceneRef.scale.width-GRID*TILE_W)/2,oy=(sceneRef.scale.height-GRID*TILE_H)/2;return{x:Math.floor((p.x-ox)/TILE_W),y:Math.floor((p.y-oy)/TILE_H)};}
function riverAt(x,y){const center=31+Math.round(Math.sin(x*.16)*5+Math.sin(x*.047)*3);return Math.abs(y-center)<=1;}
function roadNear(x,y){return[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>get(x+dx,y+dy)?.type==='road');}
function invalidateNetworks(){networkDirty=true;serviceRoadCaches={power:null,water:null};}
function connectedRoads(){if(!networkDirty&&networkCache)return networkCache;const seen=new Set(),queue=[];for(let y=0;y<GRID;y++)if(get(0,y)?.type==='road'){const k=key(0,y);seen.add(k);queue.push({x:0,y});}for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=key(x,y);if(x>=0&&y>=0&&x<GRID&&y<GRID&&!seen.has(k)&&get(x,y)?.type==='road'){seen.add(k);queue.push({x,y});}}}networkCache=seen;networkDirty=false;return seen;}
function adjacentOrthogonal(x,y,types){return[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>types.includes(get(x+dx,y+dy)?.type));}
function connectedServiceRoads(kind){if(serviceRoadCaches[kind])return serviceRoadCaches[kind];const sources=kind==='power'?['power','substation']:['water','pumping','reservoir'],seen=new Set(),queue=[];for(const [k,t] of Object.entries(state.tiles)){if(!sources.includes(t.type))continue;const [x,y]=k.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const rx=x+dx,ry=y+dy,rk=key(rx,ry);if(get(rx,ry)?.type==='road'&&!seen.has(rk)){seen.add(rk);queue.push({x:rx,y:ry});}}}for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=key(x,y);if(x>=0&&y>=0&&x<GRID&&y<GRID&&!seen.has(k)&&get(x,y)?.type==='road'){seen.add(k);queue.push({x,y});}}}serviceRoadCaches[kind]=seen;return seen;}
function serviceConnected(x,y,kind){const roads=connectedServiceRoads(kind);return[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>roads.has(key(x+dx,y+dy)));}
function pollutionAt(x,y){let d=99;for(const [k,t] of Object.entries(state.tiles)){if(t.type!=='industrial')continue;const [ix,iy]=k.split(',').map(Number);d=Math.min(d,Math.abs(ix-x)+Math.abs(iy-y));}return d;}
function playTone(freq=520,duration=.055){try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=freq;gain.gain.setValueAtTime(.035,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);osc.onended=()=>ctx.close();}catch{}}
function drawTile(s,x,y,t){
const p=iso(x,y),depth=y*GRID+x;
const grass=riverAt(x,y)?0x75aeb0:((x*17+y*31)%5===0?0x71996a:((x+y)%2?0x729b6b:0x789f70));
if(t?.type==='road'){
s.add.rectangle(p.x,p.y,TILE_W+1,TILE_H+1,0x424e53).setDepth(depth);
s.add.rectangle(p.x,p.y,TILE_W-2,TILE_H-2,0x59666b).setDepth(depth+.1);
const h=get(x-1,y)?.type==='road'||get(x+1,y)?.type==='road',v=get(x,y-1)?.type==='road'||get(x,y+1)?.type==='road';
const junction=h&&v;
if(h||!v){
s.add.rectangle(p.x,p.y-TILE_H/2+2,TILE_W,1,0x9ba7a0,.65).setDepth(depth+.2);
s.add.rectangle(p.x,p.y+TILE_H/2-2,TILE_W,1,0x9ba7a0,.65).setDepth(depth+.2);
}
if(v||!h){
s.add.rectangle(p.x-TILE_W/2+2,p.y,1,TILE_H,0x9ba7a0,.65).setDepth(depth+.2);
s.add.rectangle(p.x+TILE_W/2-2,p.y,1,TILE_H,0x9ba7a0,.65).setDepth(depth+.2);
}
if(h&&!junction)s.add.rectangle(p.x,p.y,10,1.5,0xe8d78a,.9).setDepth(depth+.3);
if(v&&!junction)s.add.rectangle(p.x,p.y,1.5,10,0xe8d78a,.9).setDepth(depth+.3);
if(junction)s.add.circle(p.x,p.y,2,0xe8d78a,.7).setDepth(depth+.3);
return;
}
s.add.rectangle(p.x,p.y,TILE_W-1,TILE_H-1,grass).setStrokeStyle(1,0x355a42,.13).setDepth(depth);
if(currentOverlay!=='none'&&t){let tint=null;if(currentOverlay==='power')tint=serviceConnected(x,y,'power')?0x45d7ff:0xd74747;else if(currentOverlay==='water')tint=serviceConnected(x,y,'water')?0x45bfff:0xd74747;else if(currentOverlay==='life')tint=pollutionAt(x,y)<=3?0xf05b45:0x68d88a;if(tint)s.add.rectangle(p.x,p.y,TILE_W-2,TILE_H-2,tint,.36).setDepth(depth+4);}
if(riverAt(x,y)&&t?.type!=='road'){
s.add.rectangle(p.x,p.y,TILE_W-1,TILE_H-1,0x6da5aa,.35).setDepth(depth+.1);
s.add.line(p.x-10,p.y-7,p.x-10,p.y-7,p.x+10,p.y-7,0xb4d8ce,.25).setDepth(depth+.2);
}
if(!t){
const seed=(x*73856093^y*19349663)>>>0;
if(seed%7===0){
s.add.ellipse(p.x+((seed>>>4)%17)-8,p.y+((seed>>>9)%15)-7,5,2,0x9ab77b,.22).setDepth(depth+.3);
}
if(seed%29===0){
s.add.circle(p.x-8,p.y+7,1.4,0xd9d18b,.8).setDepth(depth+.3);
s.add.circle(p.x-5,p.y+8,1.2,0xe7e0b0,.8).setDepth(depth+.3);
}
return;
}
// A neat landscaped lot visually anchors every building to its square plot.
s.add.ellipse(p.x,p.y+12,34,10,0x344c3b,.18).setDepth(depth+1);
s.add.rectangle(p.x,p.y+14,34,7,0x71945e,.9).setDepth(depth+1.1);
s.add.rectangle(p.x,p.y+14,14,3,0xc6b58a,.9).setDepth(depth+1.2);
const place=(key,offset=0,size=62)=>s.add.image(p.x,p.y-7+offset,key).setDisplaySize(size,size).setDepth(depth+2+offset*.01);
if(t.type==='residential'&&!t.built){
place('foundation',0,62);
if(t.building)place('crane',-18,58);
s.add.text(p.x,p.y+18,t.building?'CHANTIER':'À CONSTRUIRE',{fontFamily:'monospace',fontSize:'6px',color:'#fff4d6',backgroundColor:'#76502d',padding:{x:3,y:2}}).setOrigin(.5).setDepth(depth+5);
return;
}
const houses=['house1','house2','house3','house4'];
const houseSeed=(Math.imul(x+17,374761393)^Math.imul(y+29,668265263))>>>0;
const map={residential:houses[houseSeed%houses.length],commercial:'shop',industrial:'factory',power:'power',water:'tower',park:'park',school:'school',clinic:'clinic',police:'police',fire:'fire',substation:'substation',pumping:'pump',reservoir:'reservoir'};
const sprite=map[t.type];
if(sprite){place(sprite,0,64);return;}
place('foundation',0,62);
if(t.building)place('crane',-18,58);
}
class CityScene extends Phaser.Scene{
constructor(){super('city');}
preload(){this.load.spritesheet('city-assets',new URL('../assets/sprites/city-assets.svg',import.meta.url).href,{frameWidth:256,frameHeight:256});this.load.spritesheet('city-upgrades',new URL('../assets/sprites/city-upgrades.svg',import.meta.url).href,{frameWidth:256,frameHeight:256});this.load.image('house1',new URL('../assets/sprites/buildings/house1.svg',import.meta.url).href);this.load.image('house2',new URL('../assets/sprites/buildings/house2.svg',import.meta.url).href);this.load.image('house3',new URL('../assets/sprites/buildings/house3.svg',import.meta.url).href);this.load.image('house4',new URL('../assets/sprites/buildings/house4.svg',import.meta.url).href);this.load.image('shop',new URL('../assets/sprites/buildings/shop.svg',import.meta.url).href);this.load.image('factory',new URL('../assets/sprites/buildings/factory.svg',import.meta.url).href);this.load.image('school',new URL('../assets/sprites/buildings/school.svg',import.meta.url).href);this.load.image('clinic',new URL('../assets/sprites/buildings/clinic.svg',import.meta.url).href);this.load.image('power',new URL('../assets/sprites/buildings/power.svg',import.meta.url).href);this.load.image('tower',new URL('../assets/sprites/buildings/tower.svg',import.meta.url).href);this.load.image('park',new URL('../assets/sprites/buildings/park.svg',import.meta.url).href);this.load.image('substation',new URL('../assets/sprites/buildings/substation.svg',import.meta.url).href);this.load.image('pump',new URL('../assets/sprites/buildings/pump.svg',import.meta.url).href);this.load.image('foundation',new URL('../assets/sprites/buildings/foundation.svg',import.meta.url).href);this.load.image('crane',new URL('../assets/sprites/buildings/crane.svg',import.meta.url).href);this.load.image('police',new URL('../assets/sprites/buildings/police.svg',import.meta.url).href);this.load.image('fire',new URL('../assets/sprites/buildings/fire.svg',import.meta.url).href);this.load.image('reservoir',new URL('../assets/sprites/buildings/reservoir.svg',import.meta.url).href);}
create(){sceneRef=this;this.vehicles=[];this.constructions=[];this.vehicleClock=0;this.cameras.main.setBackgroundColor('#35534b');this.cameras.main.setBounds(-4000,-4000,8000,8000);this.input.mouse.disableContextMenu();this.drawWorld();const entryView=iso(9,12);this.cameras.main.centerOn(entryView.x,entryView.y);
this.input.on('pointerdown',p=>{if(p.button!==0&&p.button!==2&&!p.middleButton)return;if(p.button===2||p.middleButton){this.dragPointer={x:p.x,y:p.y};return;}if(state.tool==='road'&&p.button===0){const g=gridAt(p.x,p.y);if(g.x>=0&&g.y>=0&&g.x<GRID&&g.y<GRID){this.roadDragStart=g;this.roadDragCurrent=g;this.drawRoadPreview();}return;}this.place(p);});
this.input.on('pointermove',p=>{if(this.roadDragStart&&((p.event?.buttons??0)&1)!==1)return;if(this.dragPointer&&p.isDown){const cam=this.cameras.main;cam.scrollX-=(p.x-this.dragPointer.x)/cam.zoom;cam.scrollY-=(p.y-this.dragPointer.y)/cam.zoom;this.dragPointer={x:p.x,y:p.y};}if(this.roadDragStart&&p.isDown){const g=gridAt(p.x,p.y);if(g.x>=0&&g.y>=0&&g.x<GRID&&g.y<GRID){this.roadDragCurrent=g;this.drawRoadPreview();}}});
this.input.on('pointerup',p=>{if(p.button!==0)return;this.dragPointer=null;if(this.roadDragStart){const a=this.roadDragStart,b=this.roadDragCurrent||this.roadDragStart;this.roadDragStart=null;this.roadDragCurrent=null;this.commitRoadLine(a,b);}});
this.input.on('wheel',(p,objects,dx,dy)=>{const cam=this.cameras.main;const before=cam.getWorldPoint(p.x,p.y);cam.setZoom(Phaser.Math.Clamp(cam.zoom*(dy>0?.9:1.1),.55,2.2));const after=cam.getWorldPoint(p.x,p.y);cam.scrollX+=before.x-after.x;cam.scrollY+=before.y-after.y;});
this.scale.on('resize',()=>this.drawWorld());
}
update(time,delta){
if(state.paused)return;
let constructionFinished=false;
for(const tile of Object.values(state.tiles)){
if(tile.type==='residential'&&tile.building){tile.buildProgress=(tile.buildProgress||0)+delta*state.speed;const duration=tile.buildDuration||9000;if(tile.buildProgress>=duration){tile.built=true;tile.building=false;delete tile.buildProgress;delete tile.buildDuration;constructionFinished=true;}}
}
if(constructionFinished){notify('Résidence terminée : les premiers habitants peuvent arriver.');this.drawWorld();updateUI();}
this.vehicleClock+=delta*state.speed;
if(this.vehicleClock>=6500&&this.vehicles.length===0){this.vehicleClock=0;const route=this.findDestinationRoute();if(route&&route.length>1){const start=iso(route[0].x,route[0].y),target=route[route.length-1],truck=target.type==='residential'&&!get(target.x,target.y)?.built;const frame=truck?8:(target.type==='industrial'?6:target.type==='commercial'?7:9);const sprite=this.add.image(start.x,start.y,'city-upgrades',frame).setDisplaySize(truck?34:33,truck?27:25).setDepth(10000);this.vehicles.push({route,index:0,progress:0,sprite,truck,target});}}
for(let i=this.vehicles.length-1;i>=0;i--){const v=this.vehicles[i];const current=v.route[v.index];if(!current||(v.index<v.route.length-1&&get(current.x,current.y)?.type!=='road')){v.sprite?.destroy();this.vehicles.splice(i,1);continue;}v.progress+=delta/1000*1.15;while(v.progress>=1&&v.index<v.route.length-1){v.progress-=1;v.index++;}if(v.index>=v.route.length-1){if(v.truck){const tile=get(v.target.x,v.target.y);if(tile&&tile.type==='residential'&&!tile.built&&!tile.building){tile.building=true;tile.buildProgress=0;tile.buildDuration=9000;notify('Le camion est arrivé : le chantier commence.');this.drawWorld();}}v.sprite.destroy();this.vehicles.splice(i,1);continue;}const a=iso(v.route[v.index].x,v.route[v.index].y),b=iso(v.route[v.index+1].x,v.route[v.index+1].y),t=v.progress;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;const laneX=(-dy/len)*7,laneY=(dx/len)*7;v.sprite.setPosition(Phaser.Math.Linear(a.x,b.x,t)+laneX,Phaser.Math.Linear(a.y,b.y,t)+laneY);v.sprite.setFlipX(true);v.sprite.setRotation(Math.atan2(dy,dx));}
}
findDestinationRoute(){
const queue=[],parent=new Map(),seen=new Set();
for(let y=0;y<GRID;y++)if(get(0,y)?.type==='road'){const k=key(0,y);seen.add(k);parent.set(k,null);queue.push({x:0,y});}
for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=key(x,y);if(x>=0&&y>=0&&x<GRID&&y<GRID&&!seen.has(k)&&get(x,y)?.type==='road'){seen.add(k);parent.set(k,key(p.x,p.y));queue.push({x,y});}}}
const destinations=[];
for(const [k,t] of Object.entries(state.tiles)){if(!['residential','commercial','industrial'].includes(t.type))continue;if(t.type==='residential'&&t.built)continue;const [x,y]=k.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const rx=x+dx,ry=y+dy,rk=key(rx,ry);if(seen.has(rk)){destinations.push({x,y,type:t.type,roadKey:rk,built:!!t.built});break;}}}
if(!destinations.length)return null;
const target=Phaser.Utils.Array.GetRandom(destinations),roadPath=[];let cursor=target.roadKey;
while(cursor){const [x,y]=cursor.split(',').map(Number);roadPath.push({x,y});cursor=parent.get(cursor);}
roadPath.reverse();roadPath.push({x:target.x,y:target.y,type:target.type});return roadPath;
}
drawWorld(){this.children.removeAll();this.vehicles=[];this.vehicleClock=0;for(let x=0;x<GRID;x++)for(let y=0;y<GRID;y++)drawTile(this,x,y,get(x,y));const gate=iso(0,12);this.add.text(gate.x+4,gate.y-24,'ENTRÉE DE LA VILLE',{fontFamily:'monospace',fontSize:'10px',color:'#fff3c4',backgroundColor:'#263b36',padding:{x:4,y:3}}).setOrigin(0,.5).setDepth(9999);if(routeStart){const p=iso(routeStart.x,routeStart.y);this.add.circle(p.x,p.y,9,0xf4d35e).setStrokeStyle(3,0x26352e).setDepth(9999);}}
place(p){const g=gridAt(p.x,p.y);if(g.x<0||g.y<0||g.x>=GRID||g.y>=GRID)return;const old=get(g.x,g.y),tool=state.tool;if(riverAt(g.x,g.y)&&!old){notify('La rivière est un terrain naturel : construis autour.');return;}
if(tool==='road'){this.routeClick(g);return;}
if(routeStart){routeStart=null;this.drawWorld();}
const k=key(g.x,g.y);
if(tool==='select'){if(old)notify('Case '+(g.x+1)+', '+(g.y+1)+' : '+old.type);else notify('Terrain libre.');return;}
if(tool==='bulldoze'){if(!old){notify('Rien à démolir ici.');return;}state.money+=Math.floor((COST[old.type]||100)*.5);delete state.tiles[k];invalidateNetworks();this.vehicles=this.vehicles.filter(v=>{const onRoute=v.route.some(p=>p.x===g.x&&p.y===g.y);if(onRoute)v.sprite?.destroy();return !onRoute;});state.buildings=state.buildings.filter(b=>b.x!==g.x||b.y!==g.y);notify('Terrain dégagé.');this.drawWorld();updateUI();return;}
if(old){notify('Cette case est déjà occupée.');return;}
if(['residential','commercial','industrial'].includes(tool)&&!roadNear(g.x,g.y)){notify('Construisez une route adjacente avant de zoner.');return;}
const cost=COST[tool]||0;if(state.money<cost){notify('Fonds insuffisants !');return;}state.money-=cost;state.tiles[k]={type:tool};invalidateNetworks();playTone(640);if(!['road','residential','commercial','industrial'].includes(tool))state.buildings.push({type:tool,x:g.x,y:g.y});notify(({residential:'Zone résidentielle délimitée.',commercial:'Zone commerciale délimitée.',industrial:'Zone industrielle délimitée.',power:'Centrale électrique construite.',water:'Château d’eau construit.',park:'Parc aménagé.',school:'École construite.',clinic:'Clinique construite.'})[tool]||'Construction terminée.');this.drawWorld();updateUI();if(tool==='residential')tutorialAction('housing');if(tool==='power')tutorialAction('power');if(tool==='water')tutorialAction('water');}
drawRoadPreview(){if(this.roadPreview)this.roadPreview.destroy();if(this.roadPreviewLabel)this.roadPreviewLabel.destroy();if(!this.roadDragStart||!this.roadDragCurrent)return;const a=this.roadDragStart,b=this.roadDragCurrent;let x=a.x,y=a.y;const points=[{x,y}];while(x!==b.x){x+=Math.sign(b.x-x);points.push({x,y});}while(y!==b.y){y+=Math.sign(b.y-y);points.push({x,y});}const fresh=points.filter(p=>!get(p.x,p.y)).length;const end=iso(b.x,b.y);this.roadPreview=this.add.graphics().setDepth(20000);this.roadPreview.lineStyle(4,0xb4df72,.85);const start=iso(a.x,a.y);this.roadPreview.beginPath();this.roadPreview.moveTo(start.x,start.y);for(const p of points.slice(1)){const q=iso(p.x,p.y);this.roadPreview.lineTo(q.x,q.y);}this.roadPreview.strokePath();this.roadPreviewLabel=this.add.text(end.x+10,end.y-25,(fresh*COST.road)+' $ · '+fresh+' cases',{fontFamily:'monospace',fontSize:'9px',color:'#b4df72',backgroundColor:'#17252d',padding:{x:4,y:3}}).setDepth(20001);}
commitRoadLine(a,b){const path=[];let x=a.x,y=a.y;path.push({x,y});while(x!==b.x){x+=Math.sign(b.x-x);path.push({x,y});}while(y!==b.y){y+=Math.sign(b.y-y);path.push({x,y});}if(path.some(p=>riverAt(p.x,p.y)&&!get(p.x,p.y))){notify('Impossible de traverser la rivière.');return;}if(path.some(p=>get(p.x,p.y)&&get(p.x,p.y).type!=='road')){notify('Le tracé traverse un bâtiment.');return;}const unique=new Map(path.map(p=>[key(p.x,p.y),p]));const fresh=[...unique.values()].filter(p=>!get(p.x,p.y)),cost=fresh.length*COST.road;if(state.money<cost){notify('Fonds insuffisants : '+cost.toLocaleString('fr-CA')+' $ nécessaires.');return;}fresh.forEach(p=>state.tiles[key(p.x,p.y)]={type:'road'});state.money-=cost;invalidateNetworks();this.drawWorld();updateUI();notify('Route construite : '+fresh.length+' cases, '+cost.toLocaleString('fr-CA')+' $.');if(fresh.length)playTone(720);tutorialAction('road');}
routeClick(g){const t=get(g.x,g.y);if(t&&t.type!=='road'){notify('Choisis une case libre ou une route comme départ.');return;}
if(!routeStart){routeStart={x:g.x,y:g.y};notify('Départ choisi. Clique maintenant sur la destination.');this.drawWorld();return;}
const end={x:g.x,y:g.y},path=[];let x=routeStart.x,y=routeStart.y;path.push({x,y});while(x!==end.x){x+=Math.sign(end.x-x);path.push({x,y});}while(y!==end.y){y+=Math.sign(end.y-y);path.push({x,y});}
const riverBlock=path.find(p=>riverAt(p.x,p.y));if(riverBlock){notify('Impossible de traverser la rivière : construis une route le long de ses rives.');routeStart=null;this.drawWorld();return;}const newTiles=path.filter(p=>!get(p.x,p.y));const blocked=path.find(p=>get(p.x,p.y)&&get(p.x,p.y).type!=='road');if(blocked){notify('Le tracé traverse un bâtiment. Choisis une autre destination.');routeStart=null;this.drawWorld();return;}
const cost=newTiles.length*COST.road;if(state.money<cost){notify('Fonds insuffisants : '+cost.toLocaleString('fr-CA')+' $ nécessaires.');routeStart=null;this.drawWorld();return;}
newTiles.forEach(p=>state.tiles[key(p.x,p.y)]={type:'road'});state.money-=cost;invalidateNetworks();routeStart=null;this.drawWorld();updateUI();notify('Route construite : '+newTiles.length+' cases, '+cost.toLocaleString('fr-CA')+' $.');tutorialAction('road');}
}
function updateUI(){const a=Object.values(state.tiles),count=t=>a.filter(v=>v.type===t).length,h=count('residential'),c=count('commercial'),i=count('industrial'),resTiles=Object.entries(state.tiles).filter(([,t])=>t.type==='residential'),powered=resTiles.filter(([k])=>{const [x,y]=k.split(',').map(Number);return serviceConnected(x,y,'power');}).length,watered=resTiles.filter(([k])=>{const [x,y]=k.split(',').map(Number);return serviceConnected(x,y,'water');}).length,power=powered*24,water=watered*24;state.jobs=c*18+i*35;const pollutionPenalty=Object.entries(state.tiles).filter(([k,t])=>t.type==='residential').reduce((sum,[k])=>{const [x,y]=k.split(',').map(Number);return sum+(pollutionAt(x,y)<=3?8:0);},0);state.happiness=Math.max(10,Math.min(99,58+count('park')*4+count('school')*3+count('clinic')*3-Math.max(0,i-h)*2-pollutionPenalty));ui('money').textContent='$ '+Math.floor(state.money).toLocaleString('fr-CA');ui('population').textContent=state.residents.toLocaleString('fr-CA');ui('happiness').textContent=state.residents?state.happiness+' %':'—';ui('jobs').textContent=state.jobs;const fmt=n=>Number(n).toLocaleString('fr-CA',{minimumFractionDigits:0,maximumFractionDigits:1});ui('power-status').textContent=state.residents?fmt(Math.min(power,state.residents))+' / '+fmt(state.residents):'0 / 0';ui('water-status').textContent=state.residents?fmt(Math.min(water,state.residents))+' / '+fmt(state.residents):'0 / 0';ui('power-bar').style.width=(state.residents?Math.min(100,power/state.residents*100):0)+'%';ui('water-bar').style.width=(state.residents?Math.min(100,water/state.residents*100):0)+'%';ui('jobs-bar').style.width=Math.min(100,state.jobs/Math.max(1,state.residents)*100)+'%';[['res',h],['com',c],['ind',i]].forEach(([n,v])=>{ui('demand-'+n).textContent=v?'Faible':'Élevée';ui(n+'-bar').style.width=Math.max(20,80-v*8)+'%';});const net=state.residents*1.2+state.jobs*.5-state.buildings.length*35;ui('balance').textContent=(net>=0?'+$ ':'−$ ')+Math.abs(Math.round(net)).toLocaleString('fr-CA');ui('date-label').textContent=['PRINTEMPS','ÉTÉ','AUTOMNE','HIVER'][Math.floor((state.day-1)/20)%4]+' · JOUR '+state.day;}
/* connectedRoads is cached and invalidated only after map edits. */
function simulate(){if(state.paused)return;state.day++;const season=Math.floor((state.day-1)/20)%4;if(season!==lastSeasonEvent){lastSeasonEvent=season;const events=['Festival du printemps : les parcs rendent les quartiers plus heureux.','Canicule : surveillez vos réserves d’eau pendant cette saison.','Rentrée d’automne : les écoles deviennent essentielles à la qualité de vie.','Hiver : les services municipaux coûtent plus cher.'];notify(events[season]);if(season===1)state.happiness=Math.max(10,state.happiness-2);if(season===0&&Object.values(state.tiles).filter(t=>t.type==='park').length>=2)state.happiness=Math.min(99,state.happiness+5);}const connected=connectedRoads();const houses=Object.entries(state.tiles).filter(([k,t])=>{if(t.type!=='residential')return false;const [x,y]=k.split(',').map(Number);return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>connected.has(key(x+dx,y+dy)));}).length,supplied=state.buildings.some(b=>b.type==='power')&&state.buildings.some(b=>b.type==='water'),growth=houses?Math.max(1,Math.floor(houses*(supplied?0.12:0.035))):0;state.residents=Math.min(houses*24,state.residents+growth);state.money+=state.residents*1.2+state.jobs*.5-state.buildings.length*35-state.residents*.25;if(state.money<0&&state.day-lastEmergencyGrant>=5){state.money+=2500;lastEmergencyGrant=state.day;notify('Subvention d’urgence municipale : +2 500 $.');}updateUI();if(state.day%5===0)notify('Jour '+state.day+' : '+state.residents+' habitants.');}
function setTool(t){state.tool=t;routeStart=null;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));sceneRef?.drawWorld();ui('tool-help').textContent=t==='road'?'Route : 35 $ par case. Clique le départ puis la destination.':'Outil sélectionné : '+t+'.';}
function startNewGame(){Object.assign(state,freshState());lastSeasonEvent=-1;lastEmergencyGrant=0;invalidateNetworks();sceneRef.vehicles?.forEach(v=>v.sprite?.destroy());if(sceneRef.vehicles)sceneRef.vehicles.length=0;routeStart=null;sceneRef.cameras.main.setZoom(1);const entryView=iso(9,12);sceneRef.cameras.main.centerOn(entryView.x,entryView.y);sceneRef.drawWorld();updateUI();notify('Nouvelle ville créée.');}
function loadGame(){const raw=localStorage.getItem('citybuilder2d-save');if(!raw){notify('Aucune sauvegarde trouvée. Crée une nouvelle partie.');return;}try{const parsed=JSON.parse(raw),saved=parsed.state||parsed,base=freshState();Object.assign(state,base,saved);state.tiles=Object.fromEntries(Object.entries(saved.tiles||base.tiles).map(([k,t])=>[k,{...t,pollution:Number.isFinite(t.pollution)?t.pollution:0,niveau:Number.isFinite(t.niveau)?t.niveau:1,watered:!!t.watered,powered:!!t.powered,buildProgress:Number.isFinite(t.buildProgress)?t.buildProgress:0}]));state.buildings=Array.isArray(saved.buildings)?saved.buildings:[];state.residents=Number.isFinite(state.residents)?Math.max(0,state.residents):0;state.jobs=Number.isFinite(state.jobs)?Math.max(0,state.jobs):0;state.happiness=Number.isFinite(state.happiness)?state.happiness:65;state.day=Number.isFinite(state.day)?Math.max(1,state.day):1;state.money=Number.isFinite(state.money)?state.money:25000;state.speed=[1,2,4].includes(state.speed)?state.speed:1;state.paused=typeof state.paused==='boolean'?state.paused:true;invalidateNetworks();routeStart=null;sceneRef.drawWorld();updateUI();ui('main-menu').classList.add('hidden');notify('Partie chargée.');}catch{notify('Sauvegarde illisible.');}}
ui('menu-new').addEventListener('click',()=>{ui('main-menu').classList.add('hidden');startNewGame();tutorialStep=0;showTutorial();});
ui('menu-continue').addEventListener('click',()=>{ui('main-menu').classList.add('hidden');loadGame();tutorialStep=0;showTutorial();});
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
document.querySelectorAll('.overlay-btn').forEach(b=>b.addEventListener('click',()=>{currentOverlay=b.dataset.overlay;document.querySelectorAll('.overlay-btn').forEach(x=>x.classList.toggle('active',x===b));sceneRef.drawWorld();}));
const layout=ui('app').querySelector('.layout');ui('left-collapse').addEventListener('click',()=>{ui('app').querySelector('.sidebar.left').classList.toggle('collapsed');layout.classList.toggle('left-collapsed');sceneRef.scale.refresh();});ui('right-collapse').addEventListener('click',()=>{ui('app').querySelector('.sidebar.right').classList.toggle('collapsed');layout.classList.toggle('right-collapsed');sceneRef.scale.refresh();});
ui('export-save').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({saveVersion:2,exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='citybuilder2d-ville.json';a.click();URL.revokeObjectURL(url);notify('Export JSON téléchargé.');});
document.querySelectorAll('.speed').forEach(b=>b.addEventListener('click',()=>{state.speed=Number(b.dataset.speed);document.querySelectorAll('.speed').forEach(x=>x.classList.toggle('active',x===b));syncPauseUI();}));
ui('pause').addEventListener('click',()=>{state.paused=!state.paused;if(!state.paused)tutorialAction('simulation');syncPauseUI();});
ui('save').addEventListener('click',()=>{localStorage.setItem('citybuilder2d-save',JSON.stringify({saveVersion:2,...state}));notify('Ville sauvegardée dans ce navigateur.');});
ui('load').addEventListener('click',loadGame);
ui('reset').addEventListener('click',()=>{if(confirm('Recommencer une nouvelle ville ?'))startNewGame();});
ui('tutorial-open').addEventListener('click',()=>{tutorialStep=0;showTutorial();});
const tutorialSteps=[
{title:'Bienvenue, maire !',text:'Ce guide est interactif : tu dois réaliser les actions dans la ville pour débloquer les étapes. Clique sur Suivant pour commencer.',action:null},
{title:'1 · Prolonge la route d’entrée',text:'La route arrive du bord gauche de la carte. Choisis Route, clique sur une case de la route d’entrée, puis sur une case libre pour la prolonger. Prix : 35 $ par case.',action:'road',hint:'Construis une route en partant de la route qui arrive du bord gauche.'},
{title:'2 · Construis un quartier résidentiel',text:'Choisis Résidentiel et place au moins une zone juste à côté d’une route.',action:'housing',hint:'Place une zone résidentielle adjacente à une route.'},
{title:'3 · Fournis l’électricité et l’eau',text:'Construis une centrale électrique et un château d’eau.',action:'services',hint:'Construis une centrale ET un château d’eau.'},
{title:'4 · Lance la simulation',text:'Démarre la simulation avec le bouton ▶.',action:'simulation',hint:'Clique sur ▶ pour démarrer la simulation.'},
{title:'Tu es prêt !',text:'Développe ta ville. Garde tes rues reliées à l’entrée de gauche : les véhicules entreront par cette route et rejoindront uniquement les quartiers et lieux de travail accessibles.',action:null}
];
function tutorialRequirementMet(action){if(action==='road')return Object.entries(state.tiles).some(([k,v])=>v.type==='road'&&Number(k.split(',')[0])>8);if(action==='housing')return Object.values(state.tiles).some(v=>v.type==='residential');if(action==='services')return Object.values(state.tiles).some(v=>v.type==='power')&&Object.values(state.tiles).some(v=>v.type==='water');if(action==='simulation')return !state.paused;return true;}
function showTutorial(){tutorialActive=true;const step=tutorialSteps[tutorialStep];ui('tutorial-title').textContent=step.title;ui('tutorial-text').textContent=step.text+(step.hint?'\n\n'+step.hint:'');ui('tutorial-count').textContent=(tutorialStep+1)+' / '+tutorialSteps.length;ui('tutorial-prev').disabled=tutorialStep===0;ui('tutorial-next').textContent=tutorialStep===tutorialSteps.length-1?'Terminer':'Suivant';ui('tutorial-next').disabled=!!step.action&&!tutorialRequirementMet(step.action);ui('tutorial-panel').classList.remove('hidden');}
function tutorialAction(action){if(!tutorialActive)return;const currentStep=tutorialStep,step=tutorialSteps[currentStep];if(step?.action===action||step?.action==='services'&&(action==='power'||action==='water')){if(tutorialRequirementMet(step.action)){ui('tutorial-next').disabled=false;ui('tutorial-text').textContent=step.text+'\n\n✓ Objectif atteint ! Passage à l’étape suivante…';window.setTimeout(()=>{if(tutorialActive&&tutorialStep===currentStep&&tutorialRequirementMet(step.action)){if(tutorialStep<tutorialSteps.length-1){tutorialStep++;showTutorial();}else{ui('tutorial-panel').classList.add('hidden');tutorialActive=false;tutorialDone=true;localStorage.setItem('citybuilder2d-tutorial-done','1');}}},900);}}}
ui('tutorial-close').addEventListener('click',()=>{ui('tutorial-panel').classList.add('hidden');tutorialActive=false;});
ui('tutorial-next').addEventListener('click',()=>{if(ui('tutorial-next').disabled)return;if(tutorialStep>=tutorialSteps.length-1){ui('tutorial-panel').classList.add('hidden');tutorialActive=false;tutorialDone=true;localStorage.setItem('citybuilder2d-tutorial-done','1');return;}tutorialStep++;showTutorial();});
ui('tutorial-prev').addEventListener('click',()=>{tutorialStep=Math.max(0,tutorialStep-1);showTutorial();});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if(e.code==='Space'){e.preventDefault();ui('pause').click();return;}const m={v:'select',r:'road',x:'bulldoze'};if(m[e.key.toLowerCase()])setTool(m[e.key.toLowerCase()]);if(e.key==='Escape'&&localStorage.getItem('citybuilder2d-tutorial-done')==='1'){ui('tutorial-panel').classList.add('hidden');}});
new Phaser.Game({type:Phaser.CANVAS,parent:'game-container',backgroundColor:'#35534b',scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},render:{antialias:false,pixelArt:true},scene:[CityScene]});
function startGameTimers(){if(simulationTimer!==null)clearInterval(simulationTimer);if(autosaveTimer!==null)clearInterval(autosaveTimer);simulationTimer=setInterval(()=>{if(!state.paused)for(let n=0;n<state.speed;n++)simulate();},5000);autosaveTimer=setInterval(()=>{try{localStorage.setItem('citybuilder2d-save',JSON.stringify({saveVersion:2,...state}));}catch{}},30000);}
startGameTimers();
document.querySelectorAll('button,a,.dialog-overlay,.menu-overlay,.sidebar,.topbar,footer').forEach(el=>['pointerdown','pointerup','mousedown','mouseup','click'].forEach(type=>el.addEventListener(type,stopUIEvent)));
updateUI();syncPauseUI();

/* The town is painted on a small integer-pixel canvas, including every letter. */
(() => {
  'use strict';

  const W = 540, H = 360, DX = 76, DY = 36;
  const ink = '#463145', wood = '#a95e4f', cream = '#fff1c9';
  const palettes = [
    { wall:'#d7856d', side:'#a45961', light:'#f4bb8a', ledge:'#a35556', roof:'#d9a680', rim:'#ffcf98', shutter:'#667975' },
    { wall:'#d8b68c', side:'#a08487', light:'#f3d3a0', ledge:'#a18176', roof:'#c7b19e', rim:'#f7d8b0', shutter:'#648e87' },
    { wall:'#bda0ac', side:'#89758b', light:'#e4bfba', ledge:'#937482', roof:'#c9a69e', rim:'#f1c8ae', shutter:'#7a6879' },
    { wall:'#9db6a5', side:'#718f8c', light:'#c9cdb0', ledge:'#718f82', roof:'#c2bba3', rim:'#e1d7b3', shutter:'#57847c' },
    { wall:'#dfab77', side:'#b77f72', light:'#f8cb94', ledge:'#b77c60', roof:'#d5ad85', rim:'#ffdaa6', shutter:'#8e6d76' },
    { wall:'#ca8f83', side:'#a26b75', light:'#efba98', ledge:'#ad7069', roof:'#d9ac9a', rim:'#fbd1a8', shutter:'#678988' },
    { wall:'#a0a5b0', side:'#717c8e', light:'#c9bbc1', ledge:'#7c818f', roof:'#c2b2af', rim:'#ead3bb', shutter:'#627f8c' },
    { wall:'#e8b18c', side:'#bc8581', light:'#f9d2a3', ledge:'#bf826c', roof:'#e3bb93', rim:'#ffe0ae', shutter:'#81998a' },
    { wall:'#c9a2a5', side:'#a17886', light:'#e8bfba', ledge:'#a27679', roof:'#ccabb0', rim:'#f6cfb7', shutter:'#94758a' }
  ];
  const heights = [51,36,48,40,51,38,49,38,32];
  const glyphs = {
    A:['010','101','111','101','101'], B:['110','101','110','101','110'],
    C:['011','100','100','100','011'], D:['110','101','101','101','110'],
    E:['111','100','110','100','111'], F:['111','100','110','100','100'],
    G:['011','100','101','101','011'], H:['101','101','111','101','101'],
    I:['111','010','010','010','111']
  };
  const cache = new WeakMap();
  let ctx;

  function rect(x,y,w,h,c) {
    ctx.fillStyle=c;
    ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  function line(a,b,c) {
    let x=Math.round(a[0]), y=Math.round(a[1]);
    const tx=Math.round(b[0]), ty=Math.round(b[1]), dx=Math.abs(tx-x), dy=-Math.abs(ty-y);
    const sx=x<tx?1:-1, sy=y<ty?1:-1;
    let error=dx+dy;
    ctx.fillStyle=c;
    while (true) {
      ctx.fillRect(x,y,1,1);
      if (x===tx && y===ty) break;
      const twice=2*error;
      if (twice>=dy) {error+=dy;x+=sx;}
      if (twice<=dx) {error+=dx;y+=sy;}
    }
  }
  function poly(points,c) {
    const min=Math.floor(Math.min(...points.map(p=>p[1])));
    const max=Math.ceil(Math.max(...points.map(p=>p[1])));
    ctx.fillStyle=c;
    for (let y=min;y<max;y++) {
      const test=y+0.5, hits=[];
      for (let i=0;i<points.length;i++) {
        const a=points[i], b=points[(i+1)%points.length];
        if ((a[1]<=test && b[1]>test)||(b[1]<=test && a[1]>test))
          hits.push(a[0]+(test-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      if(hits.length>1){
        const left=Math.round(Math.min(...hits)), right=Math.round(Math.max(...hits));
        ctx.fillRect(left,y,right-left,1);
      }
    }
  }
  function ring(points,c) {
    points.forEach((p,i)=>line(p,points[(i+1)%points.length],c));
  }
  function proj(x,y,z=0) {return [270+(x-y)*DX,126+(x+y)*DY-z];}
  function quad(x0,y0,x1,y1,z=0) {
    return [proj(x0,y0,z),proj(x1,y0,z),proj(x1,y1,z),proj(x0,y1,z)];
  }
  function deck(x0,y0,x1,y1,z,c){poly(quad(x0,y0,x1,y1,z),c);}
  function box(x0,y0,x1,y1,z,h,top,left,right,outline) {
    const upper=quad(x0,y0,x1,y1,z+h), lower=quad(x0,y0,x1,y1,z);
    poly([upper[3],upper[2],lower[2],lower[3]],left);
    poly([upper[2],upper[1],lower[1],lower[2]],right);
    poly(upper,top);
    if(outline){
      ring(upper,outline);line(upper[2],lower[2],outline);
      line(lower[3],lower[2],outline);line(lower[2],lower[1],outline);
    }
  }
  function rng(seed) {
    let v=seed>>>0;
    return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
  }
  function disk(x,y,r,c) {
    for(let i=-r;i<=r;i++) {
      const span=Math.floor(Math.sqrt(r*r-i*i));
      rect(x-span,y+i,span*2+1,1,c);
    }
  }
  function cloud(x,y,l,c,s) {
    rect(x,y,l,2,c);rect(x+5*s,y-2*s,l-8*s,2*s,c);
    rect(x+12*s,y-4*s,l-23*s,2*s,c);rect(x+14*s,y-6*s,9*s,2*s,c);
  }
  function cityBack() {
    // Long horizontal bands give the sky the palette of a printed sunset.
    const sky=['#efb9aa','#f2c0ac','#f5c7ad','#f8cdae','#fad2b0','#fbd7b2','#fcdcb6'];
    rect(0,0,W,H,sky[sky.length-1]);
    sky.forEach((color,i)=>rect(0,i*14,W,15,color));
    disk(431,49,19,'#ffe6b2');disk(431,48,16,'#ffedba');
    cloud(16,53,67,'#ffdfba',1);cloud(95,25,47,'#fdd8b7',1);
    cloud(277,40,78,'#ffddba',1);cloud(452,29,57,'#fad3b5',1);
    cloud(175,63,35,'#ffe4c6',1);cloud(398,61,51,'#ffe0b6',1);
    const random=rng(434);
    for(let layer=0;layer<2;layer++){
      const base=layer?128:103, color=layer?'#d7aaad':'#e4b4af', trim=layer?'#dfb5b1':'#e9bdb5';
      for(let x=-10;x<W+5;){
        const w=7+Math.floor(random()*21), h=8+Math.floor(random()*27), y=base-h;
        rect(x,y,w,h,color);
        const type=Math.floor(random()*4);
        if(type===0) poly([[x-1,y],[x+w*.6,y-6],[x+w+1,y]],color);
        if(type===1){rect(x+3,y-4,w-6,4,color);rect(x+5,y-7,2,4,color);}
        if(type===2){rect(x+1,y-4,2,5,color);rect(x+w-4,y-3,3,4,color);}
        if(w>13 && layer){
          for(let a=3;a<w-2;a+=6)for(let b=3;b<h-2;b+=7)rect(x+a,y+b,2,3,trim);
        }
        x+=w-1;
      }
    }
    // A distant water tower, chimney stacks and a chapel give the city its skyline.
    const mauve='#c99fa9';
    rect(30,76,2,25,mauve);rect(43,76,2,25,mauve);
    line([31,78],[43,95],mauve);line([44,78],[31,95],mauve);
    rect(28,66,19,13,mauve);poly([[25,66],[37,60],[49,66]],mauve);
    rect(495,70,9,37,mauve);poly([[493,71],[500,53],[506,71]],mauve);
    rect(500,49,1,8,mauve);rect(514,84,3,22,'#cba4ac');
    for(const [x,y] of [[82,56],[88,54],[372,42],[377,40],[472,76]]) {
      line([x-2,y-1],[x,y+1],'#ad8b90');line([x,y+1],[x+3,y-1],'#ad8b90');
    }
    // Haze below the horizon, with a few river ripples behind the diorama.
    rect(0,128,W,232,'#ebc0b4');rect(0,134,W,226,'#efc6b7');
    rect(0,148,W,212,'#f3cebb');rect(0,166,W,194,'#f5d5bf');
    rect(0,195,W,165,'#f7d9be');
    const haze=rng(2044);
    for(let i=0;i<115;i++){
      const y=128+haze()*200,x=haze()*W;
      rect(x,y,4+haze()*20,1,y<156?'#e8bcb1':'#f1cbb6');
    }
  }
  function slab(){
    // A tapered shadow anchors the miniature model just above the warm ground.
    poly([[26,217],[270,107],[527,221],[286,348],[260,348]],'#edc7b4');
    poly([[33,218],[272,112],[518,220],[278,342]],'#e5beae');
    const a=-.61,b=2.61;
    box(a,a,b,b,-12,12,'#bbaba3','#bc8c7c','#a9807c','#a87e72');
    for(let k=0;k<36;k++) {
      const t=a+(b-a)*k/36;
      line(proj(t,b,-3),proj(t,b,-9),'#af8377');
      line(proj(b,t,-3),proj(b,t,-9),'#967c79');
      if(k%3===0){line(proj(t,b,-8),proj(t+.055,b,-8),'#d9a18a');}
    }
    ring(quad(a,a,b,b,0),'#e9c8a7');
    // Small square paving stones along the four paths.
    const random=rng(412);
    for(let i=0;i<210;i++){
      const x=a+random()*(b-a),y=a+random()*(b-a);
      if(Math.abs(x-Math.round(x))>.38 || Math.abs(y-Math.round(y))>.38){
        const p=proj(x,y);rect(p[0],p[1],2,1,i%2?'#cbbaac':'#b1a09e');
      }
    }
    for(let x=0;x<3;x++)for(let y=0;y<3;y++){
      box(x-.438,y-.438,x+.438,y+.438,0,2,'#dec0a0','#c9a98e','#ad9290');
      line(proj(x-.43,y+.43,2),proj(x+.43,y+.43,2),'#e5c8aa');
    }
    // Crosswalks at the central intersections.
    for(const [x,y] of [[.51,.51],[1.51,1.51],[.51,1.51],[1.51,.51]]) {
      for(let k=-2;k<=2;k++)deck(x+k*.035-.012,y-.068,x+k*.035+.007,y+.068,0,'#e7ccb0');
    }
  }
  function buildingHeight(p){return Number.isFinite(p.height)?Math.max(27,Math.min(61,p.height)):heights[p.y*3+p.x];}
  function wallAt(plot,side,t,z,offset=0) {
    const h=.377;
    return side==='left'?proj(plot.x+t,plot.y+h+offset,z):proj(plot.x+h+offset,plot.y+t,z);
  }
  function panel(plot,face,t0,t1,z0,z1,color,out=0) {
    poly([wallAt(plot,face,t0,z0,out),wallAt(plot,face,t1,z0,out),
      wallAt(plot,face,t1,z1,out),wallAt(plot,face,t0,z1,out)],color);
  }
  function facade(p,face,h,pal,seed) {
    const side=face==='right', frame=side?'#796476':'#966c68';
    for(const altitude of [4,Math.round(h/2)+1,h-5]){
      panel(p,face,-.376,.376,altitude,altitude+1,side?pal.ledge:pal.light,.002);
    }
    const random=rng(seed);
    for(let k=0;k<16;k++){
      const t=-.34+random()*.65,z=4+random()*(h-10);
      panel(p,face,t,t+.035,z,z+.6,side?pal.ledge:pal.light,.003);
    }
    const cols=3, upper=h>42?[h-15,h-28]:[h-16];
    upper.forEach((floor,fi)=>{
      for(let i=0;i<cols;i++){
        const t=-.27+i*.219;
        panel(p,face,t-.022,t+.121,floor-2,floor+9,frame,.008);
        panel(p,face,t,t+.099,floor,floor+7,random()>.42?'#806c79':'#5f636e',.01);
        panel(p,face,t+.007,t+.037,floor+1,floor+6,i===1&&!fi?'#f1c38d':'#a5aaa5',.013);
        panel(p,face,t+.055,t+.087,floor+1,floor+6,i===1&&!fi?'#e8af77':'#8c9e9c',.013);
        panel(p,face,t-.024,t+.119,floor-2,floor-1,side?pal.ledge:pal.light,.015);
        if(!side && seed%3!==1){
          panel(p,face,t-.045,t-.027,floor,floor+7,pal.shutter,.015);
          panel(p,face,t+.109,t+.128,floor,floor+7,pal.shutter,.015);
        }
        if((i+seed+fi)%4===0){
          panel(p,face,t-.03,t+.13,floor-4,floor-1,'#935f58',.035);
          panel(p,face,t-.023,t+.12,floor-1,floor+1,'#70865d',.034);
          const q=wallAt(p,face,t+.02,floor+1,.032);rect(q[0],q[1]-1,2,2,'#f3af7d');
        }
      }
    });
    if(side){
      for(const t of [-.18,.05,.23]){
        panel(p,face,t-.038,t+.062,2,12,frame,.01);
        panel(p,face,t-.024,t+.046,3,10,'#787986',.012);
      }
      const t=-.322;
      panel(p,face,t,t+.018,2,h-2,'#7d777e',.012);
      return;
    }
    // Ground-floor stores have separate panes and cloth awnings with a scalloped edge.
    panel(p,face,-.27,.26,3,13,frame,.01);
    for(const t of [-.25,-.12,.055,.16]){
      panel(p,face,t,t+.085,4,11,'#a4b4a6',.014);
      panel(p,face,t+.009,t+.024,5,10,'#d1d1af',.016);
    }
    panel(p,face,-.043,.043,2,13,'#73636a',.018);
    const awning=seed%3===1?'#779a8b':seed%3===2?'#c77d6b':'#aa8583';
    for(let i=0;i<8;i++){
      const x0=-.31+i*.076,x1=x0+.076;
      poly([wallAt(p,face,x0,15,.008),wallAt(p,face,x1,15,.008),wallAt(p,face,x1,13,.073),wallAt(p,face,x0,13,.073)],i%2?cream:awning);
      panel(p,face,x0,x1,11,13,i%2?'#e6c7a4':awning,.074);
    }
  }
  function chimney(x,y,h){
    box(x-.025,y-.028,x+.025,y+.028,h,7,'#c69583','#a06f6e','#886471');
    box(x-.033,y-.038,x+.034,y+.038,h+6,2,'#edb994','#b38377','#966e70');
    deck(x-.015,y-.017,x+.018,y+.018,h+8,'#785d69');
  }
  function waterTank(x,y,h){
    const [u,v]=proj(x,y,h);
    // Barrel hoops, timber legs and a conical copper cap.
    rect(u-5,v-6,2,7,'#846a65');rect(u+4,v-7,2,8,'#7c6061');
    line([u-4,v-5],[u+5,v],'#917267');
    rect(u-7,v-17,15,10,'#ab7566');rect(u-6,v-18,12,13,'#c6886d');
    rect(u-5,v-17,3,11,'#dfa684');rect(u+5,v-17,2,10,'#94676b');
    for(const band of [8,14]){rect(u-7,v-band,14,1,'#806966');rect(u-5,v-band,5,1,'#c69882');}
    poly([[u-9,v-18],[u,v-23],[u+9,v-18],[u+6,v-16],[u-5,v-16]],'#7c8d83');
    line([u-8,v-18],[u,v-22],'#b4bd9d');rect(u,v-24,1,2,'#836c69');
  }
  function greenhouse(x,y,h){
    const t=quad(x-.085,y-.064,x+.085,y+.064,h);
    const e=quad(x-.085,y-.064,x+.085,y+.064,h+4);
    const ridge0=proj(x-.085,y,h+9),ridge1=proj(x+.085,y,h+9);
    poly([t[3],t[2],e[2],e[3]],'#86a9a0');
    poly([t[2],t[1],e[1],ridge1,e[2]],'#71948e');
    poly([e[0],e[1],ridge1,ridge0],'#c6d2b6');
    poly([ridge0,ridge1,e[2],e[3]],'#acc7b2');
    for(const n of [-.085,0,.085])line(proj(x+n,y,h+9),proj(x+n,y+.064,h+4),'#ede2b9');
    line(e[3],e[2],'#e3d9af');line(ridge0,ridge1,'#e2dfb8');
    line(e[2],t[2],'#e3d9af');line(e[1],ridge1,'#b9c5a7');
  }
  function vine(p,face,t,h){
    const q=wallAt(p,face,t,h-2,.024);
    for(let k=0;k<12;k++){
      const x=q[0]+Math.round(Math.sin(k*.8)*2),y=q[1]+k;
      rect(x,y,1,2,'#698069');
      if(k%2===0)rect(x+(k%4?-2:1),y,2,2,k%4?'#85966a':'#90a476');
      if(k===4||k===8)rect(x+1,y-1,1,1,'#e8b08b');
    }
  }
  function clothesline(x,y,h){
    const a=proj(x-.28,y+.20,h+6),b=proj(x-.28,y-.14,h+6);
    line([a[0],a[1]+4],[a[0],a[1]-2],'#977b6c');
    line([b[0],b[1]+4],[b[0],b[1]-2],'#977b6c');
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2+1];
    line(a,m,'#ad9181');line(m,b,'#ad9181');
    for(let i=0;i<4;i++){
      const f=(i+.65)/5,u=a[0]+(b[0]-a[0])*f,v=a[1]+(b[1]-a[1])*f+1;
      rect(u-1,v,3,i%2?3:4,i%2?'#f7e3bd':'#8faeaa');
    }
  }
  function leaf(x,y,c1,c2){
    rect(x,y-3,1,4,'#596a50');rect(x-2,y-4,2,2,c1);rect(x+1,y-5,2,2,c2);
  }
  function drawBed(p,h,watered,seed) {
    const x=p.x,y=p.y;
    box(x-.179,y-.18,x+.209,y+.173,h+.4,3,'#d4a27b','#ac745c','#8c6058');
    deck(x-.155,y-.152,x+.184,y+.149,h+3.6,watered?'#6f7854':'#926b5e');
    const blooms=['#f88c72','#f7cb76','#f8ada3','#efa8c0','#e48882','#f7e2a0'];
    const random=rng(501+seed);
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const q=proj(x-.105+i*.075,y-.105+j*.07,h+4);
      q[0]+=Math.floor(random()*3)-1;q[1]+=Math.floor(random()*2);
      if(watered){
        leaf(q[0],q[1], '#829766','#9cb171');
        if((i+j)%4!==1){
          const bloom=blooms[Math.floor(random()*blooms.length)];
          rect(q[0]-1,q[1]-7,3,2,bloom);
          rect(q[0],q[1]-8,1,4,bloom);rect(q[0],q[1]-6,1,1,'#ffe1a0');
        }
      } else if((i+j+seed)%3!==0){
        rect(q[0],q[1]-2,1,3,'#6e7456');rect(q[0]-1,q[1]-2,1,1,'#b1b07b');
        rect(q[0]+1,q[1]-3,1,2,'#8b975d');
      }else rect(q[0],q[1],2,1,'#ba8e69');
    }
  }
  function sprinkler(p,h){
    const [u,v]=proj(p.x+.25,p.y-.015,h+1);
    // A turquoise tank and a brass nozzle identify the roof that supplied the water.
    rect(u-4,v-1,9,2,'#9e8a78');rect(u-4,v-6,8,6,'#477d7a');
    rect(u-3,v-7,6,1,'#426b6a');rect(u-3,v-5,2,4,'#8ac1ae');
    rect(u+2,v-5,1,4,'#5c9489');rect(u-1,v-10,2,4,'#6a746b');
    rect(u-5,v-11,9,2,'#c99866');rect(u-5,v-11,3,1,'#f6d293');
    for(const [dx,dy] of [[-7,-12],[-10,-13],[-14,-12],[6,-12],[9,-12]]){
      rect(u+dx,v+dy,2,1,'#7fbeb5');
    }
  }
  function badgePos(p){const q=proj(p.x+.245,p.y+.23,buildingHeight(p)+4);return [Math.round(q[0]),Math.round(q[1])];}
  function badge(p,watered,hover){
    const [x,y]=badgePos(p), color=hover?'#477e78':watered?'#526d55':'#604752';
    rect(x-7,y-11,15,15,'#ad8b7b');rect(x-7,y-12,15,14,cream);rect(x-8,y-11,17,12,cream);
    rect(x-6,y-11,13,12,color);rect(x-7,y-10,15,10,color);
    const g=glyphs[p.id];
    if(g)g.forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')rect(x-3+i*2,y-10+j*2,2,2,cream);}));
  }
  function building(p,state){
    const x=p.x,y=p.y,n=y*3+x,h=buildingHeight(p),pal=palettes[n];
    const b=.377, roof=.397;
    deck(x-b+.05,y-b+.075,x+b+.07,y+b+.09,2,'#ac9890');
    box(x-b,y-b,x+b,y+b,2,h-2,pal.roof,pal.wall,pal.side);
    facade(p,'left',h,pal,n+7);facade(p,'right',h,pal,n+16);
    box(x-roof,y-roof,x+roof,y+roof,h-3,4,pal.roof,pal.ledge,pal.ledge);
    const top=quad(x-roof,y-roof,x+roof,y+roof,h+1);
    ring(top,pal.rim);
    const inner=quad(x-roof+.032,y-roof+.032,x+roof-.032,y+roof-.032,h+1);
    line(inner[0],inner[1],'#a8887b');line(inner[0],inner[3],'#b39785');
    // Roof seams, chimneys and a tiny metal service hatch.
    for(const t of [-.22,.04,.23]){
      line(proj(x+t,y-.335,h+1),proj(x+t,y+.34,h+1),pal.rim);
    }
    chimney(x-.255,y-.25,h+1);
    if(n%2===0)chimney(x-.27,y-.13,h+1);
    if(n%3===1){
      const a=proj(x+.23,y-.24,h+1);
      line(a,[a[0],a[1]-13],'#756973');line([a[0]-4,a[1]-10],[a[0]+5,a[1]-12],'#8c7e83');
      line([a[0]-3,a[1]-7],[a[0]+4,a[1]-8],'#8c7e83');
    }else{
      box(x+.18,y-.30,x+.29,y-.19,h+1,3,'#b7ada1','#9c9990','#8d8887');
      line(proj(x+.19,y-.24,h+4),proj(x+.27,y-.24,h+4),'#8f8985');
    }
    if(n===0 || n===8)waterTank(x-.22,y-.22,h+1);
    if(n===3 || n===5)greenhouse(x-.23,y+.19,h+1);
    if(n===4 || n===7)clothesline(x,y,h+1);
    if(n===2 || n===5 || n===7)vine(p,'right',.22,h);
    if(n===1 || n===4)vine(p,'left',-.30,h);
    const watered=state.watered.includes(p.id), preview=state.preview.includes(p.id), hover=state.hover===p.id;
    if(preview || hover){
      const border=quad(x-.342,y-.342,x+.342,y+.342,h+2);
      ring(border,hover?'#fff7d1':'#95e7cf');
      if(hover)ring(quad(x-.326,y-.326,x+.326,y+.326,h+2),'#6d9d8c');
    }
    drawBed(p,h+1,watered,n);
    if(state.used.includes(p.id))sprinkler(p,h);
    badge(p,watered,hover);
  }
  function tree(x,y,size,shade) {
    const [u,v]=proj(x,y,2),s=size;
    const leaves=shade?['#638373','#7c9980','#9dad83','#bcc193']:['#717c63','#8a9969','#a4af73','#c5c384'];
    poly([[u-5,v],[u+2,v-3],[u+9,v],[u+3,v+3]],'#ad9d86');
    rect(u-1,v-s,3,s,'#94735d');rect(u-1,v-s,1,s,'#c29570');
    line([u+1,v-s*.65],[u+5,v-s], '#957861');
    const crown=(dx,dy,r,color)=>{
      const a=u+dx,b=v-s+dy;
      poly([[a-r+2,b-r+2],[a-2,b-r-1],[a+3,b-r],[a+r,b-3],[a+r,b+3],[a+2,b+r],[a-3,b+r],[a-r,b+3]],color);
    };
    crown(1,-1,s*.62,leaves[0]);crown(-2,-4,s*.52,leaves[1]);crown(-3,-6,s*.38,leaves[2]);
    rect(u-5,v-s-8,3,2,leaves[3]);rect(u+2,v-s-4,3,2,leaves[2]);rect(u-4,v-s,2,2,leaves[1]);
  }
  function fountain(x,y){
    box(x-.19,y-.19,x+.19,y+.19,3,3,'#c9beac','#b6aa95','#9d9490');
    box(x-.167,y-.167,x+.167,y+.167,6,2,'#d8d1b5','#bcb8a5','#aba895');
    deck(x-.137,y-.137,x+.137,y+.137,8,'#8ab6ac');
    ring(quad(x-.126,y-.126,x+.126,y+.126,8),'#a9cabc');
    const [u,v]=proj(x,y,8);
    rect(u-2,v-5,4,6,'#aaa998');rect(u-4,v-6,8,2,'#c9c6ab');
    rect(u-1,v-13,2,8,'#b5d6c7');rect(u,v-15,1,7,'#f3eabc');
    line([u-1,v-12],[u-4,v-9],'#dce6c9');line([u-4,v-9],[u-6,v-2],'#aacac1');
    line([u+1,v-11],[u+4,v-9],'#e2e6c8');line([u+4,v-9],[u+7,v-2],'#b7d2c1');
    rect(u-8,v-1,5,1,'#cce1c8');rect(u+5,v-1,5,1,'#cce1c8');
  }
  function grass(x,y,n){
    const b=.37;
    box(x-b,y-b,x+b,y+b,2,2,'#b1ae82','#ae9d7f','#988d7c');
    const seed=rng(n+219);
    for(let i=0;i<70;i++){
      const u=x-b+seed()*b*2,v=y-b+seed()*b*2,p=proj(u,v,4);
      rect(p[0],p[1],1+(i%2),1,i%3===0?'#c8bd94':'#98a082');
    }
    deck(x-.36,y-.065,x+.36,y+.058,4,'#dcc6a0');
    deck(x-.05,y-.35,x+.04,y+.35,4,'#dfc6a1');
    if(n===8 || n===4){
      tree(x-.24,y-.20,15,true);bench(x+.19,y-.22);
      fountain(x,y);bench(x-.13,y+.26);tree(x+.29,y+.26,10,true);
      return;
    }
    for(const [u,v] of [[-.22,-.2],[.18,-.24],[-.23,.19]]){
      tree(x+u,y+v,14+(n+Math.round(u*23))%4,n%2===0);
    }
    // Beds beside a wooden bench make even the smallest garden read as a park.
    box(x+.13,y+.12,x+.32,y+.24,4,3,'#839772','#b18a70','#967565');
    const pos=proj(x+.19,y+.17,7);
    for(let i=0;i<7;i++)rect(pos[0]-5+i*2,pos[1]+(i%3)-2,2,2,['#edb489','#d78d8a','#edce89'][i%3]);
    bench(x+.16,y-.04);
  }
  function bench(x,y){
    box(x-.072,y-.021,x+.072,y+.018,2,2,'#b58267','#99745d','#80675e');
    const a=proj(x-.074,y-.019,7),b=proj(x+.074,y-.019,7);
    line(a,b,'#987560');line([a[0],a[1]+1],[b[0],b[1]+1],'#d5a078');
    for(const k of [-.057,.057])line(proj(x+k,y-.012,6),proj(x+k,y-.012,1),'#856c61');
  }
  function lamppost(x,y){
    const [u,v]=proj(x,y,2);
    rect(u-2,v,5,2,'#a39281');rect(u,v-15,2,15,'#6c7270');rect(u-2,v-18,6,4,'#827c71');
    rect(u-1,v-17,4,2,'#ffe1a3');rect(u-2,v-19,6,1,'#687574');rect(u,v-20,2,1,'#687574');
  }
  function bike(x,y){
    const [u,v]=proj(x,y,2);
    for(const a of [-4,4]){
      rect(u+a-2,v-2,5,1,'#71746d');rect(u+a-2,v+2,5,1,'#71746d');
      rect(u+a-2,v-1,1,3,'#71746d');rect(u+a+2,v-1,1,3,'#71746d');
    }
    line([u-4,v],[u-1,v-4],'#ab6d64');line([u-1,v-4],[u+1,v],'#ab6d64');
    line([u-4,v],[u+1,v],'#ab6d64');line([u+1,v],[u+4,v-4],'#ab6d64');
    rect(u+3,v-5,3,1,'#6a6d66');rect(u-3,v-5,3,1,'#75675f');
  }
  function cat(x,y){
    const [u,v]=proj(x,y,3);
    rect(u-3,v-3,5,3,'#785c59');rect(u+1,v-5,3,4,'#755b56');
    rect(u+1,v-6,1,1,'#755b56');rect(u+3,v-6,1,1,'#755b56');
    rect(u-5,v-5,1,3,'#785c59');rect(u-4,v-3,2,1,'#785c59');rect(u+3,v-4,1,1,'#edb77c');
  }
  function person(x,y,coat,head){
    const [u,v]=proj(x,y,1);
    rect(u-1,v-3,1,3,'#5f6267');rect(u+1,v-3,1,3,'#5f6267');rect(u-2,v-7,5,5,coat);
    rect(u-1,v-10,3,3,head);rect(u-1,v-11,3,1,'#7f6659');rect(u+2,v-6,1,2,head);
  }
  function compose(level,state){
    cityBack();slab();
    const grid=new Map(level.plots.map(p=>[p.x+','+p.y,p]));
    const props=[];
    function add(x,y,f){props.push({depth:x+y, paint:f});}
    for(let y=0;y<3;y++)for(let x=0;x<3;x++){
      const p=grid.get(x+','+y);add(x,y,()=>p?building(p,state):grass(x,y,y*3+x));
    }
    for(const [x,y] of [[-.48,.52],[-.49,1.54],[1.45,-.46],[2.48,.52],[.5,2.48],[2.48,1.53],[1.52,2.5]])
      add(x,y,()=>lamppost(x,y));
    for(const [x,y,s] of [[-.42,2.4,10],[.42,2.45,11],[1.46,2.44,11],[2.44,1.47,10],[2.43,-.46,11],[2.47,2.37,9]])
      add(x,y,()=>tree(x,y,s,true));
    for(const [x,y] of [[.55,2.27],[2.27,2.47]])add(x,y,()=>bench(x,y));
    add(2.51,1.76,()=>bike(2.51,1.76));add(1.74,2.46,()=>cat(1.74,2.46));
    add(.15,2.51,()=>person(.15,2.51,'#bc786b','#c48e76'));
    add(1.5,.45,()=>person(1.5,.45,'#768c89','#a77968'));
    add(2.43,.88,()=>person(2.43,.88,'#c0a46e','#d8a98a'));
    props.sort((a,b)=>a.depth-b.depth).forEach(o=>o.paint());
  }
  function isOnRoof(x,y,p){
    const center=proj(p.x,p.y,buildingHeight(p)+1);
    return Math.abs(x-center[0])/(DX*.806)+Math.abs(y-center[1])/(DY*.806)<=1.03;
  }
  function hitTest(canvas,clientX,clientY,level){
    const bounds=canvas.getBoundingClientRect();
    if(!bounds.width || !bounds.height)return null;
    const x=(clientX-bounds.left)*W/bounds.width,y=(clientY-bounds.top)*H/bounds.height;
    const backToFront=level.plots.slice().sort((a,b)=>b.x+b.y-a.x-a.y);
    for(const p of backToFront){
      const [u,v]=badgePos(p);
      if((Math.abs(x-u)<=9 && y>=v-13 && y<=v+3)||isOnRoof(x,y,p))return p.id;
    }
    return null;
  }
  function transient(level,state,time){
    if(!Number.isFinite(time))return;
    for(const p of level.plots){
      if(!state.watered.includes(p.id))continue;
      const n=p.x+3*p.y, t=time*.0014+n*1.7;
      const q=proj(p.x-.10,p.y-.04,buildingHeight(p)+11);
      const a=Math.round(q[0]+Math.cos(t)*12),b=Math.round(q[1]+Math.sin(t*1.7)*4);
      rect(a,b,2,1,'#e3a55c');rect(a-1,b-(Math.sin(t*8)>0?1:0),1,2,'#fff2ae');
      if(state.complete){
        rect(a+5,b+4,1,1,'#fff8c7');rect(a+7,b+4,1,1,'#fff8c7');
      }
    }
  }
  function render(canvas,level,state,time=0){
    if(canvas.width!==W)canvas.width=W;
    if(canvas.height!==H)canvas.height=H;
    let saved=cache.get(canvas);
    if(!saved){
      const off=canvas.ownerDocument.createElement('canvas');
      off.width=W;off.height=H;saved={off,key:null};cache.set(canvas,saved);
    }
    const key=JSON.stringify([level.plots,state.watered,state.preview,state.used,state.hover]);
    if(saved.key!==key){
      ctx=saved.off.getContext('2d');compose(level,state);saved.key=key;
    }
    ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.drawImage(saved.off,0,0);transient(level,state,time);
  }
  window.CityView=Object.freeze({render,hitTest});
})();

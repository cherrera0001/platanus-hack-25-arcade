// Herdshift: Quantum Corral — Phaser 3 • Cyber-corral Tetris con joystick (L/R/D) y botones A (rotar) / B (hard drop) / START (pausa-reinicio).

const ARCADE_CONTROLS={
  P1L:['A','ArrowLeft'],
  P1R:['D','ArrowRight'],
  P1U:['W','ArrowUp'],
  P1D:['S','ArrowDown'],
  P1DL:['Q'],
  P1DR:['E'],
  P1A:['U','Z'],
  P1B:['I','Space'],
  P1C:['O'],
  P1X:['J'],
  P1Y:['K'],
  P1Z:['L'],
  START1:['Enter'],
  P2L:['J','Numpad4'],
  P2R:['L','Numpad6'],
  P2U:['I','Numpad8'],
  P2D:['K','Numpad5'],
  P2DL:['Numpad1'],
  P2DR:['Numpad3'],
  P2A:['R'],
  P2B:['T'],
  P2C:['Y'],
  P2X:['F'],
  P2Y:['G'],
  P2Z:['H'],
  START2:['Shift']
};

const GRID_W=10,GRID_H=20;
const DROP_MS_START=720,SOFT_MS=40,LEVEL_ACCEL=65,MIN_DROP=120;

const SPECIES=[
  {id:0,name:'cow',body:0x8d5935,glow:0xffc280,accent:0x32170a},
  {id:1,name:'sheep',body:0xdfe8f8,glow:0xffffd6,accent:0x58636c},
  {id:2,name:'horse',body:0x513120,glow:0xff9bff,accent:0x14080a}
];

const SHAPES=[
  [[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
  [[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]]],
  [[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,1]],[[0,1],[1,1],[2,1],[1,2]],[[0,1],[1,0],[1,1],[1,2]]],
  [[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
  [[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,0]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
  [[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
  [[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]]
];

const SCORE_TABLE=[0,100,320,520,840];

const game=new Phaser.Game({
  type:Phaser.CANVAS,
  width:960,
  height:600,
  pixelArt:true,
  backgroundColor:'#04000a',
  scale:{
    mode:Phaser.Scale.RESIZE,
    autoCenter:Phaser.Scale.CENTER_BOTH
  },
  scene:{preload,create,update}
});

function preload(){}

function create(){
  const s=this;
  s.board=new Array(GRID_W*GRID_H).fill(-1);
  s.flash=[];
  s.keys=bindKeys(s);
  s.drop=DROP_MS_START;
  s.acc=0;
  s.sideDelay=0;
  s.score=0;
  s.lines=0;
  s.level=1;
  s.gameOver=false;
  s.paused=false;
  s.tipTimer=9000;
  s.bonusText=null;
  s.osc=s.sound.context;
  buildBackground(s);
  buildPanels(s);
  applyLayout(s);
  s.scale.on('resize',()=>applyLayout(s));
  s.previewShape=null;
  s.nextPiece=makePiece();
  spawnPiece(s);
}

function update(_,dt){
  const s=this;
  animateBackground(s,dt);
  if(justPressed(s,'START1')){
    if(s.gameOver){ resetGame(s); return; }
    s.paused=!s.paused;
    setMessage(s,s.paused?'PAUSA\nSTART PARA CONTINUAR':'',s.paused);
    beep(s,230,0.05);
  }
  if(s.gameOver||s.paused){
    drawScene(s);
    return;
  }
  if(s.tipTimer>0){
    s.tipTimer-=dt;
    if(s.tipTimer<=0) s.tip.setVisible(false);
  }
  if(justPressed(s,'P1A')) rotatePiece(s);
  if(justPressed(s,'P1B')) hardDrop(s);
  if(justPressed(s,'P1D')) tryMove(s,0,1);
  handleSideways(s,dt);
  s.acc+=dt;
  const step=isHeld(s,'P1D')?SOFT_MS:s.drop;
  if(s.acc>=step){
    s.acc-=step;
    if(!tryMove(s,0,1)) lockPiece(s);
  }
  if(s.bonusText){
    s.bonusText.alpha-=dt*0.0025;
    s.bonusText.y-=dt*0.03;
    if(s.bonusText.alpha<=0) { s.bonusText.destroy(); s.bonusText=null; }
  }
  drawScene(s);
}

function buildBackground(s){
  s.bg=s.add.graphics().setDepth(0);
  s.holo=s.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
  s.gGrid=s.add.graphics().setDepth(2);
  s.boardLayer=s.add.graphics().setDepth(3);
  s.overlay=s.add.graphics().setDepth(4);
  s.frame=s.add.graphics().setDepth(5);
  s.scanlines=s.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.MULTIPLY);
  s.vignette=s.add.graphics().setDepth(11);
}

function buildPanels(s){
  s.hudTitle=s.add.text(0,0,'HERDSHIFT',{
    fontFamily:'monospace',
    fontSize:26,
    color:'#85f6ff'
  });
  s.hudText=s.add.text(0,0,'',{
    fontFamily:'monospace',
    fontSize:18,
    lineSpacing:8,
    color:'#f8ecff'
  });
  s.tip=s.add.text(0,0,'A = ROTAR\nB = DROP\nJOYSTICK PARA MOVER\n\n🐄 VACA: ASIENTA FILAS\n🐑 OVEJA: x1.5 SI 8\n🐎 CABALLO: MICRO-SALTO',{
    fontFamily:'monospace',
    fontSize:16,
    color:'#d6fffa'
  });
  s.tip.setWordWrapWidth(210);
  s.nextLabel=s.add.text(0,0,'PRÓXIMA MANADA',{
    fontFamily:'monospace',
    fontSize:18,
    color:'#8ef7ff'
  });
  s.nextPreview=s.add.graphics().setDepth(6);
  s.nextName=s.add.text(0,0,'',{
    fontFamily:'monospace',
    fontSize:16,
    color:'#ffe4ff'
  }).setWordWrapWidth(200);
  s.msg=s.add.text(0,0,'',{
    fontFamily:'monospace',
    fontSize:32,
    align:'center',
    color:'#fef9ff',
    stroke:'#ff3dfd',
    strokeThickness:4
  }).setOrigin(0.5).setDepth(8).setVisible(false);
}

function applyLayout(s){
  const W=s.scale.gameSize.width;
  const H=s.scale.gameSize.height;
  const PAD=Math.floor(Math.min(W,H)*0.03);
  const cell=Math.max(6,Math.floor(Math.min((W-2*PAD)/GRID_W,(H-2*PAD)/GRID_H)));
  s.CELL=cell;
  s.BW=cell*GRID_W;
  s.BH=cell*GRID_H;
  s.BX=Math.floor((W-s.BW)/2);
  s.BY=Math.floor((H-s.BH)/2);
  s.previewCell=Math.max(6,Math.floor(cell*0.6));
  s.cameras.main.setRoundPixels(true);

  // background fills
  s.bg.clear();
  s.bg.fillStyle(0x050014,1);
  s.bg.fillRect(0,0,W,H);
  const strip=Math.max(12,Math.floor(cell*0.6));
  for(let i=0;i<18;i++){
    const alpha=0.28-i*0.01;
    s.bg.fillStyle(0x2b0a3f,alpha);
    s.bg.fillRect(0,H-(i+1)*strip,W,strip);
  }

  // overlay + frame
  const boardPad=Math.max(4,Math.floor(cell*0.4));
  s.overlay.clear();
  s.overlay.fillStyle(0x120030,0.25);
  s.overlay.fillRect(s.BX-boardPad,s.BY-boardPad,s.BW+boardPad*2,s.BH+boardPad*2);

  s.frame.clear();
  const border=Math.max(6,Math.floor(cell*0.7));
  s.frame.lineStyle(Math.max(2,Math.floor(cell*0.18)),0x8225ff,0.6);
  s.frame.strokeRect(s.BX-border,s.BY-border,s.BW+border*2,s.BH+border*2);
  s.frame.lineStyle(Math.max(1,Math.floor(cell*0.12)),0x0af1ff,0.4);
  const sideW=Math.max(cell*6.5,180);
  const sideH=s.BH+Math.max(cell*1.5,80);
  const leftX=s.BX-Math.max(cell*6.2,200);
  const sideY=s.BY-Math.max(cell*0.8,cell);
  const rightX=s.BX+s.BW+Math.max(cell*0.8,24);
  s.frame.strokeRect(leftX,sideY,sideW,sideH);
  s.frame.strokeRect(rightX,sideY,sideW,sideH);

  // HUD positions
  const hudSize=Math.max(14,Math.floor(cell*0.9));
  s.hudTitle.setFontSize(hudSize).setPosition(leftX+Math.max(cell*0.4,6),s.BY);
  s.hudText.setFontSize(Math.max(10,Math.floor(cell*0.65))).setPosition(leftX+Math.max(cell*0.4,6),s.BY+Math.max(cell*1.2,30));
  s.tip.setFontSize(Math.max(10,Math.floor(cell*0.55)));
  s.tip.setWordWrapWidth(Math.max(cell*6,160));
  s.tip.setPosition(leftX+Math.max(cell*0.4,6),s.BY+Math.max(cell*4,120));

  const rightBase=rightX+Math.max(cell*0.6,10);
  s.nextLabel.setFontSize(Math.max(10,Math.floor(cell*0.6))).setPosition(rightBase,s.BY);
  s.nextPreview.setPosition(rightBase+Math.max(cell*2.4,60),s.BY+Math.max(cell*3,90));
  s.nextName.setFontSize(Math.max(10,Math.floor(cell*0.55))).setPosition(rightBase,s.BY+Math.max(cell*5.6,170)).setWordWrapWidth(Math.max(cell*6,160));

  s.msg.setFontSize(Math.max(18,Math.floor(cell*1.1))).setPosition(s.BX+s.BW/2,s.BY+s.BH/2);
  if(s.bonusText){
    s.bonusText.setFontSize(Math.max(14,Math.floor(cell*0.85)));
    s.bonusText.setPosition(s.BX+s.BW/2,s.BY+Math.max(cell*3,100));
  }

  // scanlines + vignette
  drawScanlines(s);
  drawVignette(s);

  if(s.nextPiece) updatePreview(s);
}

function animateBackground(s,dt){
  const holo=s.holo;
  holo.clear();
  const t=s.time.now*0.0004;
  for(let i=0;i<6;i++){
    const radius=90+i*60;
    holo.lineStyle(1.5,0x30a3ff,0.2-i*0.02);
    const cx=s.BX+s.BW/2, cy=s.BY+s.BH*0.65;
    holo.strokeCircle(cx,cy,radius+(Math.sin(t+i)*8));
  }
  const g=s.gGrid;
  g.clear();
  const W=s.scale.gameSize.width,H=s.scale.gameSize.height;
  const baseY=s.BY+s.BH*0.55;
  g.lineStyle(1,0x0d3661,0.45);
  for(let x=-8;x<=8;x++){
    const sx=s.BX+s.BW/2+x*s.CELL*1.4;
    g.lineBetween(sx,baseY,sx+x*s.CELL*0.9,H);
  }
  g.lineStyle(1,0x36139a,0.35);
  for(let i=0;i<18;i++){
    const y=baseY+i*s.CELL*0.9;
    g.lineBetween(s.BX-s.CELL*6,y,s.BX+s.BW+s.CELL*6,y+Math.sin(t+i)*10);
  }
  s.overlay.clear();
  s.overlay.fillStyle(0x120030,0.25);
  const pad=Math.max(4,Math.floor(s.CELL*0.4));
  s.overlay.fillRect(s.BX-pad,s.BY-pad,s.BW+pad*2,s.BH+pad*2);
}

function bindKeys(scene){
  const map={};
  for(const code in ARCADE_CONTROLS){
    map[code]=ARCADE_CONTROLS[code].map(k=>scene.input.keyboard.addKey(k));
  }
  return map;
}

function isHeld(scene,code){
  const keys=scene.keys[code];
  if(!keys) return false;
  for(let i=0;i<keys.length;i++) if(keys[i].isDown) return true;
  return false;
}

function justPressed(scene,code){
  const keys=scene.keys[code];
  if(!keys) return false;
  for(let i=0;i<keys.length;i++) if(Phaser.Input.Keyboard.JustDown(keys[i])) return true;
  return false;
}

function makePiece(){
  return {
    shape:Phaser.Math.Between(0,SHAPES.length-1),
    rot:0,
    x:3,
    y:-2,
    species:Phaser.Math.Between(0,SPECIES.length-1),
    jumped:false
  };
}

function spawnPiece(scene){
  scene.cur=scene.nextPiece;
  scene.cur.x=3;
  scene.cur.y=-2;
  scene.cur.rot=0;
  scene.cur.jumped=false;
  scene.nextPiece=makePiece();
  updatePreview(scene);
  if(collides(scene,scene.cur.x,scene.cur.y,scene.cur.rot)){
    endGame(scene);
  }
}

function updatePreview(scene){
  const g=scene.nextPreview;
  g.clear();
  g.setDepth(6);
  const spec=SPECIES[scene.nextPiece.species];
  const shape=SHAPES[scene.nextPiece.shape][0];
  const u=scene.previewCell;
  for(let i=0;i<4;i++){
    const x=shape[i][0],y=shape[i][1];
    drawAnimalCellPreview(scene,g,(x-1)*u,(y-1)*u,u,spec,false);
  }
  scene.nextName.setText(`ESPECIE: ${spec.name.toUpperCase()}`);
}

function rotatePiece(scene){
  const next=(scene.cur.rot+1)&3;
  if(!collides(scene,scene.cur.x,scene.cur.y,next)){
    scene.cur.rot=next;
    beep(scene,720,0.04);
    return;
  }
  if(!collides(scene,scene.cur.x-1,scene.cur.y,next)){
    scene.cur.x--; scene.cur.rot=next; beep(scene,720,0.04); return;
  }
  if(!collides(scene,scene.cur.x+1,scene.cur.y,next)){
    scene.cur.x++; scene.cur.rot=next; beep(scene,720,0.04);
  }
}

function hardDrop(scene){
  let steps=0;
  while(!collides(scene,scene.cur.x,scene.cur.y+1,scene.cur.rot)){
    scene.cur.y++; steps++;
  }
  if(steps>0) beep(scene,860,0.05);
  scene.score+=steps;
  lockPiece(scene);
}

function handleSideways(scene,dt){
  if(justPressed(scene,'P1L')){ tryMove(scene,-1,0); scene.sideDelay=160; }
  else if(justPressed(scene,'P1R')){ tryMove(scene,1,0); scene.sideDelay=160; }
  scene.sideDelay=Math.max(0,scene.sideDelay-dt);
  const left=isHeld(scene,'P1L'),right=isHeld(scene,'P1R');
  const dir=right&&!left?1:left&&!right?-1:0;
  if(dir && scene.sideDelay<=0){
    if(tryMove(scene,dir,0)) scene.sideDelay=75;
  }
}

function tryMove(scene,dx,dy){
  if(!collides(scene,scene.cur.x+dx,scene.cur.y+dy,scene.cur.rot)){
    scene.cur.x+=dx;
    scene.cur.y+=dy;
    return true;
  }
  return false;
}

function collides(scene,x,y,rot){
  const pts=SHAPES[scene.cur.shape][rot];
  for(let i=0;i<4;i++){
    const px=x+pts[i][0],py=y+pts[i][1];
    if(px<0||px>=GRID_W||py>=GRID_H) return true;
    if(py>=0 && scene.board[py*GRID_W+px]>=0) return true;
  }
  return false;
}

function lockPiece(scene){
  const pts=SHAPES[scene.cur.shape][scene.cur.rot];
  const sp=scene.cur.species;
  for(let i=0;i<4;i++){
    const px=scene.cur.x+pts[i][0],py=scene.cur.y+pts[i][1];
    if(py<0){ endGame(scene); return; }
    scene.board[py*GRID_W+px]=sp;
  }
  playSpeciesCue(scene,sp);
  if(SPECIES[sp].name==='horse') horseMicroStep(scene,pts);
  if(SPECIES[sp].name==='cow') settleCow(scene);
  const cleared=clearRows(scene);
  if(cleared.length){
    const base=SCORE_TABLE[cleared.length]||0;
    let mult=0;
    let text='';
    for(let i=0;i<cleared.length;i++){
      const {counts}=cleared[i];
      let dom=0;
      if(counts[1]>counts[dom]) dom=1;
      if(counts[2]>counts[dom]) dom=2;
      let factor=1;
      if(dom===0) factor+=0.25;
      if(dom===2) factor+=0.1;
      if(dom===1){
        factor=counts[1]>=8?1.5:1.05;
        text='REBAÑO PERFECTO x1.5';
      }
      mult+=factor;
    }
    const gain=Math.floor(base*(1+(scene.level-1)*0.16)*(mult/cleared.length));
    scene.score+=gain;
    scene.lines+=cleared.length;
    if(text) flashBonus(scene,text);
    scene.level=1+Math.floor(scene.lines/10);
    scene.drop=Math.max(MIN_DROP,DROP_MS_START-(scene.level-1)*LEVEL_ACCEL);
    beep(scene,420,0.08);
  }
  spawnPiece(scene);
}

function playSpeciesCue(scene,sp){
  if(sp===0) beep(scene,180,0.1);
  else if(sp===1){ beep(scene,520,0.03); beep(scene,760,0.04); }
  else beep(scene,260,0.06);
}

function horseMicroStep(scene,pts){
  let canJump=true;
  for(let i=0;i<4;i++){
    const px=scene.cur.x+pts[i][0],py=scene.cur.y+pts[i][1]+1;
    if(py>=GRID_H || (py>=0 && scene.board[py*GRID_W+px]>=0)){ canJump=false; break; }
  }
  if(canJump){
    for(let i=GRID_H-2;i>=0;i--){
      for(let x=0;x<GRID_W;x++){
        const id=i*GRID_W+x;
        if(scene.board[id]===scene.cur.species && scene.board[(i+1)*GRID_W+x]<0){
          scene.board[(i+1)*GRID_W+x]=scene.board[id];
          scene.board[id]=-1;
        }
      }
    }
  }
}

function settleCow(scene){
  for(let y=GRID_H-2;y>=0;y--){
    for(let x=0;x<GRID_W;x++){
      const id=y*GRID_W+x;
      if(scene.board[id]===0 && scene.board[id+GRID_W]<0){
        scene.board[id+GRID_W]=scene.board[id];
        scene.board[id]=-1;
      }
    }
  }
}

function clearRows(scene){
  const cleared=[];
  for(let y=GRID_H-1;y>=0;y--){
    let full=true;
    const counts=[0,0,0];
    for(let x=0;x<GRID_W;x++){
      const v=scene.board[y*GRID_W+x];
      if(v<0){ full=false; break; }
      counts[v]++;
    }
    if(full){
      cleared.push({y,counts});
      for(let yy=y;yy>0;yy--){
        for(let x=0;x<GRID_W;x++){
          scene.board[yy*GRID_W+x]=scene.board[(yy-1)*GRID_W+x];
        }
      }
      for(let x=0;x<GRID_W;x++) scene.board[x]=-1;
      y++;
    }
  }
  return cleared;
}

function flashBonus(scene,text){
  if(scene.bonusText) scene.bonusText.destroy();
  scene.bonusText=scene.add.text(scene.BX+scene.BW/2,scene.BY+Math.max(scene.CELL*2.5,100),text,{
    fontFamily:'monospace',
    fontSize:22,
    color:'#fff2ff',
    stroke:'#ff94ff',
    strokeThickness:3
  }).setOrigin(0.5).setDepth(9);
}

function drawScene(scene){
  const g=scene.boardLayer;
  g.clear();
  drawBoard(scene,g);
  drawCurrent(scene,g);
  updateHUD(scene);
}

function drawBoard(scene,g){
  for(let y=0;y<GRID_H;y++){
    for(let x=0;x<GRID_W;x++){
      const v=scene.board[y*GRID_W+x];
      if(v>=0) drawBlock(scene,g,x,y,SPECIES[v],false);
    }
  }
}

function drawCurrent(scene,g){
  if(scene.gameOver) return;
  const pts=SHAPES[scene.cur.shape][scene.cur.rot];
  let dropY=scene.cur.y;
  while(!collides(scene,scene.cur.x,dropY+1,scene.cur.rot)) dropY++;
  for(let i=0;i<4;i++){
    const gx=scene.cur.x+pts[i][0],gy=dropY+pts[i][1];
    if(gy>=0) drawBlock(scene,g,gx,gy,SPECIES[scene.cur.species],true,0.18);
  }
  for(let i=0;i<4;i++){
    const gx=scene.cur.x+pts[i][0],gy=scene.cur.y+pts[i][1];
    if(gy>=0) drawBlock(scene,g,gx,gy,SPECIES[scene.cur.species],false);
  }
}

function drawBlock(scene,g,gx,gy,spec,ghost,ghostAlpha){
  const px=scene.BX+gx*scene.CELL;
  const py=scene.BY+gy*scene.CELL;
  const alpha=ghost?(ghostAlpha||0.15):0.85;
  drawAnimalCell(scene,g,px,py,scene.CELL,spec,ghost,alpha);
}

function drawAnimalCell(scene,g,px,py,size,spec,ghost,alpha){
  const pad=ghost?Math.max(2,Math.floor(size*0.1)):Math.max(1,Math.floor(size*0.08));
  g.fillStyle(0x000000,0.18*alpha);
  g.fillRoundedRect(px+pad,py+pad,size-pad*2,size-pad*2,Math.max(2,size*0.18));
  g.fillStyle(spec.body,alpha);
  g.fillRoundedRect(px+pad-1,py+pad-1,size-pad*2-1,size-pad*2-1,Math.max(2,size*0.2));
  g.lineStyle(1,0xffffff,0.35*alpha);
  g.strokeRect(px+0.5,py+0.5,size-1,size-1);
  g.lineStyle(1,spec.glow,ghost?0.45:0.85);
  g.strokeRoundedRect(px+pad-1,py+pad-1,size-pad*2+2,size-pad*2+2,Math.max(2,size*0.22));
  const headSize=size*0.32;
  if(spec.name==='cow'){
    g.fillStyle(spec.accent,ghost?0.25:0.6);
    g.fillEllipse(px+size*0.35,py+size*0.3,headSize,headSize*0.9);
    g.fillEllipse(px+size*0.65,py+size*0.45,headSize*0.9,headSize*0.7);
    g.fillRect(px+size*0.28,py+size*0.12,headSize*0.6,headSize*0.4);
    g.lineStyle(2,spec.glow,ghost?0.3:0.8);
    g.strokeLineShape(new Phaser.Geom.Line(px+size*0.25,py+size*0.15,px+size*0.2,py+size*0.02));
    g.strokeLineShape(new Phaser.Geom.Line(px+size*0.75,py+size*0.18,px+size*0.82,py+size*0.05));
  }else if(spec.name==='sheep'){
    g.fillStyle(0xffffff,ghost?0.18:0.8);
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3;
      g.fillCircle(px+size*0.5+Math.cos(angle)*size*0.18,py+size*0.45+Math.sin(angle)*size*0.18,size*0.16);
    }
    g.fillStyle(spec.accent,ghost?0.25:0.8);
    g.fillEllipse(px+size*0.52,py+size*0.35,headSize*1.3,headSize);
    g.fillEllipse(px+size*0.34,py+size*0.3,headSize*0.8,headSize*0.5);
    g.fillEllipse(px+size*0.72,py+size*0.4,headSize*0.7,headSize*0.43);
  }else{
    g.fillStyle(spec.accent,ghost?0.22:0.7);
    g.fillEllipse(px+size*0.55,py+size*0.38,headSize*1.4,headSize);
    g.fillRect(px+size*0.72,py+size*0.26,headSize*0.6,headSize*1.5);
    g.fillTriangle(px+size*0.36,py+size*0.2,px+size*0.6,py+size*0.1,px+size*0.52,py+size*0.36);
    g.lineStyle(2,spec.glow,ghost?0.25:0.9);
    g.strokeLineShape(new Phaser.Geom.Line(px+size*0.5,py+size*0.65,px+size*0.5,py+size*0.9));
  }
}

function drawAnimalCellPreview(scene,g,px,py,size,spec,ghost){
  const alpha=ghost?0.4:1;
  drawAnimalCell(scene,g,px,py,size,spec,ghost,alpha);
}

function updateHUD(scene){
  scene.hudText.setText(
    `SCORE ${scene.score}\nLINEAS ${scene.lines}\nNIVEL ${scene.level}\nDROP ${Math.floor(scene.drop)}ms`
  );
  if(scene.gameOver) setMessage(scene,'GAME OVER\nSTART PARA REINTENTAR',true);
}

function setMessage(scene,text,visible){
  scene.msg.setText(text);
  scene.msg.setVisible(visible);
}

function endGame(scene){
  if(scene.gameOver) return;
  scene.gameOver=true;
  setMessage(scene,'GAME OVER\nSTART PARA REINTENTAR',true);
  beep(scene,150,0.35);
}

function resetGame(scene){
  scene.scene.restart();
}

function drawScanlines(scene){
  scene.scanlines.clear();
  const W=scene.scale.gameSize.width,H=scene.scale.gameSize.height;
  for(let y=0;y<H;y+=2){
    scene.scanlines.fillStyle(0x000000,0.12);
    scene.scanlines.fillRect(0,y,W,1);
  }
}

function drawVignette(scene){
  const g=scene.vignette;
  g.clear();
  const W=scene.scale.gameSize.width,H=scene.scale.gameSize.height;
  const band=Math.max(40,Math.floor(scene.CELL*2.5));
  g.fillStyle(0x000000,0.35);
  g.fillRect(0,0,W,band);
  g.fillRect(0,H-band,W,band);
  g.fillRect(0,0,band,H);
  g.fillRect(W-band,0,band,H);
}

function beep(scene,freq,dur){
  try{
    const ctx=scene.osc;
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.frequency.value=freq;
    osc.type='square';
    gain.gain.setValueAtTime(0.08,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.004,ctx.currentTime+dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime+dur);
  }catch(_e){}
}


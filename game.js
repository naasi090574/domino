const KEY = "domino_images_7";

/* Твои ассеты */
const TILE_BASE_URL = "https://img.genially.com/66f849d0f7b39c0016fdd814/bbb0b340-2104-497a-9bd5-960837acefb8.png";
const BOARD_BG_URL  = "https://img.genially.com/66f849d0f7b39c0016fdd814/2360023a-edc6-4446-b475-4c7e337f9276.png";

/* DOM */
const btnNew = document.getElementById("btnNew");
const btnDraw = document.getElementById("btnDraw");
const dealSelect = document.getElementById("dealSelect");
const statusEl = document.getElementById("status");

const boardWrap = document.getElementById("boardWrap");
const board = document.getElementById("board");
const layer = document.getElementById("layer");

const panel1 = document.getElementById("panel1");
const panel2 = document.getElementById("panel2");
const row1 = document.getElementById("row1");
const row2 = document.getElementById("row2");
const p1Count = document.getElementById("p1Count");
const p2Count = document.getElementById("p2Count");

const leftGlow = document.getElementById("leftGlow");
const rightGlow = document.getElementById("rightGlow");

const btnCenter = document.getElementById("btnCenter");
const btnZoomIn = document.getElementById("btnZoomIn");
const btnZoomOut = document.getElementById("btnZoomOut");

/* Размеры (должны совпадать с style.css) */
const TILE_W = 170;          // длинная сторона домино
const TILE_H = 86;
const GAP = 14;
const STEP = TILE_W + GAP;   // шаг цепочки всегда по длинной стороне

/* Пан/зум */
let view = { x: 0, y: 0, scale: 1.0 };
const SCALE_MIN = 0.80;
const SCALE_MAX = 1.30;

/* Состояние */
let images = [];
let pile = [];
let p1 = [];
let p2 = [];

let started = false;
let choosingStart = false;
let turn = 1; // 1 педагог, 2 ребёнок

// цепочка (строго 2 конца)
let chain = []; // tiles on board: {id,a,b,swap,rot,x,y}
let ends = {
  L: null, // { value, cx, cy, dir }
  R: null
};

board.style.backgroundImage = `url("${BOARD_BG_URL}")`;
applyTransform();
loadImages();

/* ---------- helpers ---------- */
function setStatus(msg){ statusEl.textContent = msg; }

function decodeSetFromUrl(){
  const url = new URL(window.location.href);
  const set = url.searchParams.get("set");
  if(!set) return null;

  const b64 = set.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "===".slice((b64.length + 3) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array([...bin].map(ch => ch.charCodeAt(0)));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

function loadImages(){
  // 1) пытаемся взять set= из URL (для Genially это главное)
  try{
    const fromUrl = decodeSetFromUrl();
    if(Array.isArray(fromUrl) && fromUrl.length === 7){
      images = fromUrl;
      // на всякий случай сохраняем и в localStorage
      localStorage.setItem(KEY, JSON.stringify(images));
      return;
    }
  }catch(e){}

  // 2) fallback: localStorage
  try{
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if(Array.isArray(arr) && arr.length === 7){
      images = arr;
      return;
    }
  }catch(e){}

  // 3) если ничего нет — заглушки
  images = Array.from({length:7}, (_,i)=>makePlaceholder(i+1));
}

function makePlaceholder(n){
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" rx="36" fill="#1a1a1a"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
      font-size="96" fill="#ffffff" font-family="Arial">${n}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function gen28(){
  const tiles=[]; let id=0;
  for(let a=0;a<7;a++){
    for(let b=a;b<7;b++){
      tiles.push({ id:"t"+(id++), a,b, rot:0, swap:false });
    }
  }
  return tiles;
}

function getLR(tile){
  return tile.swap ? {left: tile.b, right: tile.a} : {left: tile.a, right: tile.b};
}

function updateCounts(){
  p1Count.textContent = p1.length;
  p2Count.textContent = p2.length;
}

function setTurn(t){
  turn = t;
  panel1.classList.toggle("active", turn===1);
  panel2.classList.toggle("active", turn===2);

  if(!started || choosingStart){
    btnDraw.disabled = true;
    return;
  }
  btnDraw.disabled = hasMoveForCurrentPlayer();
  if(!btnDraw.disabled) btnDraw.disabled = false;
}

function currentHand(){ return (turn===1) ? p1 : p2; }

function hasMoveForCurrentPlayer(){
  if(chain.length===0) return true;
  const hand = currentHand();
  const L = ends.L?.value;
  const R = ends.R?.value;
  return hand.some(t => t.a===L || t.b===L || t.a===R || t.b===R);
}

function dirVec(dir){
  if(dir==="E") return {x:1,y:0};
  if(dir==="W") return {x:-1,y:0};
  if(dir==="N") return {x:0,y:-1};
  return {x:0,y:1}; // S
}

function glowPos(end){
  const v = dirVec(end.dir);
  return { x: end.cx + v.x*(STEP/2), y: end.cy + v.y*(STEP/2) };
}

/* ---------- pan/zoom: двигаем ТОЛЬКО layer, фон не трогаем ---------- */
function applyTransform(){
  layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  computeEndGlows();
}

function worldToScreen(wx, wy){
  return { x: wx*view.scale + view.x, y: wy*view.scale + view.y };
}
function screenToWorld(sx, sy){
  return { x: (sx - view.x)/view.scale, y: (sy - view.y)/view.scale };
}

function centerView(){
  const rect = boardWrap.getBoundingClientRect();
  if(chain.length===0){
    view.x = rect.width/2;
    view.y = rect.height/2;
  } else {
    const first = chain[0];
    view.x = rect.width/2 - first.x*view.scale;
    view.y = rect.height/2 - first.y*view.scale;
  }
  applyTransform();
}

/* ---------- glows ---------- */
function computeEndGlows(){
  if(chain.length===0 || !ends.L || !ends.R){
    leftGlow.style.display="none";
    rightGlow.style.display="none";
    return;
  }
  leftGlow.style.display="block";
  rightGlow.style.display="block";

  const lp = glowPos(ends.L);
  const rp = glowPos(ends.R);

  const l = worldToScreen(lp.x, lp.y);
  const r = worldToScreen(rp.x, rp.y);

  leftGlow.style.left = l.x + "px";
  leftGlow.style.top  = l.y + "px";
  rightGlow.style.left = r.x + "px";
  rightGlow.style.top  = r.y + "px";
}

/* ---------- render ---------- */
function renderPanels(){
  row1.innerHTML="";
  row2.innerHTML="";
  for(const t of p1) row1.appendChild(renderTileInPanel(t,1));
  for(const t of p2) row2.appendChild(renderTileInPanel(t,2));
  updateCounts();
}

function renderChain(){
  layer.innerHTML="";
  for(const t of chain) layer.appendChild(renderTileOnBoard(t));
  computeEndGlows();
}

function renderTileInPanel(tile, owner){
  const el = document.createElement("div");
  el.className = "tile" + (tile.rot===90 ? " rot90":"");
  el.innerHTML = `
    <div class="base"></div>
    <div class="half left"><img/></div>
    <div class="half right"><img/></div>
    <div class="rotBtn" title="Повернуть 90°">⟳</div>
  `;
  el.querySelector(".base").style.backgroundImage = `url("${TILE_BASE_URL}")`;

  const {left,right}=getLR(tile);
  el.querySelector(".left img").src = images[left];
  el.querySelector(".right img").src = images[right];

  el.querySelector(".rotBtn").addEventListener("click",(e)=>{
    e.stopPropagation();
    tile.rot = (tile.rot===0)?90:0;
    renderPanels();
  });

  // drag
  el.addEventListener("pointerdown",(e)=>{
    if(!started) return;

    if(choosingStart){
      if(owner===turn) chooseStart(tile, owner);
      return;
    }
    if(owner!==turn) return;

    startDrag(tile, owner, e);
  });

  el.addEventListener("click",()=>{
    if(choosingStart && owner===turn) chooseStart(tile, owner);
  });

  return el;
}

function renderTileOnBoard(tile){
  const el=document.createElement("div");
  el.className = "tile" + (tile.rot===90 ? " rot90":"");
  el.style.position="absolute";
  el.style.left = (tile.x - TILE_W/2) + "px";
  el.style.top  = (tile.y - TILE_H/2) + "px";
  el.innerHTML = `
    <div class="base"></div>
    <div class="half left"><img/></div>
    <div class="half right"><img/></div>
  `;
  el.querySelector(".base").style.backgroundImage = `url("${TILE_BASE_URL}")`;

  const {left,right}=getLR(tile);
  el.querySelector(".left img").src = images[left];
  el.querySelector(".right img").src = images[right];

  return el;
}

/* ---------- game flow ---------- */
function newGame(){
  started=true;
  choosingStart=true;
  chain=[];
  ends.L=null;
  ends.R=null;

  const deal=Number(dealSelect.value);

  pile = shuffle(gen28());
  p1 = pile.splice(0,deal);
  p2 = pile.splice(0,deal);
  [...p1,...p2].forEach(t=>{t.rot=0;t.swap=false;});

  setTurn(1);
  renderPanels();
  renderChain();
  centerView();
  setStatus("Выберите стартовую костяшку (клик по костяшке активного игрока).");
}

function chooseStart(tile, owner){
  // ставим в центр
  const placed = {...tile, x:0, y:0};
  removeFromOwner(tile.id, owner);
  chain.push(placed);

  const {left,right} = getLR(placed);

  // два конца: левый смотрит влево, правый вправо
  ends.L = { value:left,  cx: placed.x, cy: placed.y, dir:"W" };
  ends.R = { value:right, cx: placed.x, cy: placed.y, dir:"E" };

  choosingStart=false;
  renderPanels();
  renderChain();
  centerView();

  // ход переходит ребёнку
  setTurn(2);
  setStatus("Сделайте ход: перетащите костяшку к одному из концов цепочки.");
  if(!hasMoveForCurrentPlayer()){
    setStatus("Ходов нет — нажмите «Добрать».");
    btnDraw.disabled = false;
  }
}

function removeFromOwner(id, owner){
  const hand = owner===1 ? p1 : p2;
  const idx = hand.findIndex(t=>t.id===id);
  if(idx>=0) hand.splice(idx,1);
}

function drawTile(){
  if(!started || choosingStart) return;
  if(hasMoveForCurrentPlayer()) return;

  if(pile.length===0){
    setStatus("Ходов нет. Базар пуст. Игра завершена.");
    btnDraw.disabled=true;
    return;
  }

  const t = pile.pop();
  t.rot=0; t.swap=false;
  if(turn===1) p1.push(t); else p2.push(t);
  renderPanels();

  if(hasMoveForCurrentPlayer()){
    setStatus("Добрали костяшку. Теперь можно сделать ход.");
    btnDraw.disabled = true;
  } else {
    setStatus("Добрали костяшку, но ходов всё ещё нет — можно добрать ещё.");
    btnDraw.disabled = false;
  }
}

/* ---------- drag / magnet ----------️ ---------- */
let drag=null;

function startDrag(tile, owner, e){
  const ghost = renderTileInPanel({...tile}, owner);
  ghost.style.position="absolute";
  ghost.style.pointerEvents="none";
  ghost.style.zIndex=9999;
  document.body.appendChild(ghost);

  drag = { tileId: tile.id, owner, ghost };

  moveGhost(e.clientX, e.clientY);

  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragUp, {once:true});
}

function onDragMove(e){
  if(!drag) return;
  moveGhost(e.clientX, e.clientY);
}
function moveGhost(cx,cy){
  drag.ghost.style.left = (cx - TILE_W/2) + "px";
  drag.ghost.style.top  = (cy - TILE_H/2) + "px";
}

function onDragUp(e){
  window.removeEventListener("pointermove", onDragMove);
  if(!drag) return;

  const ok = tryPlace(e.clientX, e.clientY, drag.tileId, drag.owner);
  drag.ghost.remove();
  drag=null;

  if(!ok) setStatus("Не подходит. Поднесите костяшку к зелёному кружку конца цепочки.");
}

/* Выбор направления зависит от того, ПОВЕРНУЛА ли ты костяшку:
   rot=0 => только E/W, rot=90 => только N/S  */
function pickDirByTileRotation(end, worldPoint, tileRot){
  const lp = glowPos(end);
  const dx = worldPoint.x - lp.x;
  const dy = worldPoint.y - lp.y;

  if(tileRot===0){
    return dx >= 0 ? "E" : "W";
  }
  return dy >= 0 ? "S" : "N";
}

function tryPlace(clientX, clientY, tileId, owner){
  if(!ends.L || !ends.R) return false;

  const rect = boardWrap.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const wp = screenToWorld(sx, sy);

  const lGlow = glowPos(ends.L);
  const rGlow = glowPos(ends.R);

  const lS = worldToScreen(lGlow.x, lGlow.y);
  const rS = worldToScreen(rGlow.x, rGlow.y);

  const distL = Math.hypot(sx - lS.x, sy - lS.y);
  const distR = Math.hypot(sx - rS.x, sy - rS.y);

  const TH = 65; // порог магнита
  let side = null;
  if(distL < TH) side = "L";
  if(distR < TH && (side===null || distR < distL)) side = "R";
  if(!side) return false;

  const end = side==="L" ? ends.L : ends.R;

  const hand = owner===1 ? p1 : p2;
  const idx = hand.findIndex(t=>t.id===tileId);
  if(idx<0) return false;
  const tile = hand[idx];

  // совпадение по значению
  if(tile.a!==end.value && tile.b!==end.value) return false;

  // направление (зависит от rot костяшки)
  const dir = pickDirByTileRotation(end, wp, tile.rot);

  // позиция новой кости (цепочка растёт шагом STEP)
  const v = dirVec(dir);
  const nx = end.cx + v.x*STEP;
  const ny = end.cy + v.y*STEP;

  // ориентация кости: rot определяет, но фиксируем логично под dir
  // (если rot=0, dir будет E/W; если rot=90, dir будет N/S)
  const placed = { ...tile, x:nx, y:ny };

  // swap: совпадающая должна оказаться "со стороны стыка"
  const match = end.value;
  const other = (tile.a===match) ? tile.b : tile.a;

  // Если цепь идёт в dir, стык у новой костяшки со стороны, противоположной dir
  // Для нашей разметки: у rot=0 стык слева при dir=E и справа при dir=W
  // Для rot=90 (после поворота): стык сверху при dir=S и снизу при dir=N
  // Это корректно работает через left/right до поворота.
  if(dir==="E" || dir==="S"){
    // стык слева/сверху => match должен стать "left"
    placed.swap = !(placed.a===match);
  }else{
    // стык справа/снизу => match должен стать "right"
    placed.swap = (placed.a===match);
  }

  // удаляем из руки и кладём на поле
  hand.splice(idx,1);
  chain.push(placed);

  // обновляем конец: теперь конец на новой костяшке
  // новый dir = dir (куда продолжаем)
  const newEnd = { value: other, cx: nx, cy: ny, dir: dir };

  if(side==="L") ends.L = newEnd;
  else ends.R = newEnd;

  renderPanels();
  renderChain();

  if(p1.length===0 && p2.length===0){
    setStatus("Отличная работа! Мы собрали всё домино.");
    btnDraw.disabled=true;
    return true;
  }

  // следующий ход
  setTurn(turn===1 ? 2 : 1);

  if(!hasMoveForCurrentPlayer()){
    setStatus("Ходов нет — нажмите «Добрать».");
    btnDraw.disabled=false;
  }else{
    setStatus("Сделайте ход: перетащите костяшку к одному из концов цепочки.");
  }

  return true;
}

/* ---------- pan/zoom events ---------- */
let panning=false;
let panStart=null;

boardWrap.addEventListener("pointerdown",(e)=>{
  if(e.target !== boardWrap && e.target !== board && e.target !== layer) return;
  panning=true;
  panStart={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};
  boardWrap.setPointerCapture(e.pointerId);
});

boardWrap.addEventListener("pointermove",(e)=>{
  if(!panning) return;
  view.x = panStart.vx + (e.clientX - panStart.x);
  view.y = panStart.vy + (e.clientY - panStart.y);
  applyTransform();
});
boardWrap.addEventListener("pointerup",()=>{
  panning=false; panStart=null;
});

btnCenter.addEventListener("click", centerView);
btnZoomIn.addEventListener("click", ()=>{
  view.scale = Math.min(SCALE_MAX, +(view.scale + 0.05).toFixed(2));
  applyTransform();
});
btnZoomOut.addEventListener("click", ()=>{
  view.scale = Math.max(SCALE_MIN, +(view.scale - 0.05).toFixed(2));
  applyTransform();
});

/* ---------- buttons ---------- */
btnNew.addEventListener("click", newGame);
btnDraw.addEventListener("click", drawTile);

/* ---------- init text ---------- */
setStatus("Нажмите «Новая игра». Картинки берутся из set= (из редактора через кнопку «Код для Genially»).");
centerView();

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

/* Состояние */
let images = []; // 7 dataURL или placeholder
let pile = [];
let p1 = [];
let p2 = [];

let started = false;
let choosingStart = false;
let turn = 1; // 1 педагог, 2 ребёнок

// цепочка без ветвлений
let chain = []; // выложенные tiles с x,y,rot,swap
let leftEnd = null;  // { value, x, y }
let rightEnd = null; // { value, x, y }

// пан/зум
let view = { x: 0, y: 0, scale: 1.0 };
const SCALE_MIN = 0.80;
const SCALE_MAX = 1.30;

/* Размеры костяшки (должны соответствовать CSS) */
const TILE_W = 170;
const TILE_H = 86;
const GAP = 14;

/* ИНИЦ */
board.style.backgroundImage = `url("${BOARD_BG_URL}")`;

loadImages();
applyTransform();

/* --- helpers --- */
function setStatus(msg){ statusEl.textContent = msg; }

function loadImages(){
  // если в редакторе сохранили dataURL — берём их
  try{
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if(Array.isArray(arr) && arr.length === 7 && arr.every(v => typeof v === "string" || v === null)){
      images = arr;
    } else {
      images = Array(7).fill(null);
    }
  }catch(e){
    images = Array(7).fill(null);
  }
  // если чего-то нет — ставим простые заглушки (чтобы игра не ломалась)
  for(let i=0;i<7;i++){
    if(!images[i]){
      images[i] = makePlaceholder(i+1);
    }
  }
}

function makePlaceholder(n){
  // простая картинка-плейсхолдер через SVG dataURL
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
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function gen28(){
  const tiles = [];
  let id = 0;
  for(let a=0;a<7;a++){
    for(let b=a;b<7;b++){
      tiles.push({
        id: "t"+(id++),
        a, b,
        rot: 0,     // 0 или 90 (для выкладки)
        swap: false // меняем половинки местами, но не переворачиваем вверх ногами
      });
    }
  }
  return tiles;
}

function updateCounts(){
  p1Count.textContent = p1.length;
  p2Count.textContent = p2.length;
}

function setTurn(t){
  turn = t;
  panel1.classList.toggle("active", turn===1);
  panel2.classList.toggle("active", turn===2);
  btnDraw.disabled = !started || choosingStart || hasMoveForCurrentPlayer();
}

function currentHand(){
  return (turn===1) ? p1 : p2;
}

function hasMoveForCurrentPlayer(){
  // если цепочка ещё не началась — “ход есть” условно
  if(chain.length === 0) return true;
  const hand = currentHand();
  if(!leftEnd || !rightEnd) return false;
  return hand.some(tile => tile.a===leftEnd.value || tile.b===leftEnd.value || tile.a===rightEnd.value || tile.b===rightEnd.value);
}

function computeEndGlows(){
  if(chain.length === 0 || !leftEnd || !rightEnd){
    leftGlow.style.display = "none";
    rightGlow.style.display = "none";
    return;
  }
  leftGlow.style.display = "block";
  rightGlow.style.display = "block";

  const l = worldToScreen(leftEnd.x, leftEnd.y);
  const r = worldToScreen(rightEnd.x, rightEnd.y);

  leftGlow.style.left = l.x + "px";
  leftGlow.style.top  = l.y + "px";

  rightGlow.style.left = r.x + "px";
  rightGlow.style.top  = r.y + "px";
}

function worldToScreen(wx, wy){
  return {
    x: wx*view.scale + view.x,
    y: wy*view.scale + view.y
  };
}
function screenToWorld(sx, sy){
  return {
    x: (sx - view.x)/view.scale,
    y: (sy - view.y)/view.scale
  };
}

function applyTransform(){
  board.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  computeEndGlows();
}

function centerView(){
  // центрируем по середине wrap
  const rect = boardWrap.getBoundingClientRect();
  // если цепочки нет — просто центр
  if(chain.length === 0){
    view.x = rect.width/2;
    view.y = rect.height/2;
  }else{
    // центр на первой костяшке
    const first = chain[0];
    view.x = rect.width/2 - first.x*view.scale;
    view.y = rect.height/2 - first.y*view.scale;
  }
  applyTransform();
}

/* ---- рендер ---- */
function renderPanels(){
  row1.innerHTML = "";
  row2.innerHTML = "";
  for(const t of p1) row1.appendChild(renderTileInPanel(t, 1));
  for(const t of p2) row2.appendChild(renderTileInPanel(t, 2));
  updateCounts();
}

function renderChain(){
  // очищаем и рисуем заново (для MVP нормально)
  layer.innerHTML = "";
  for(const t of chain){
    const el = renderTileOnBoard(t);
    layer.appendChild(el);
  }
  computeEndGlows();
}

function renderTileInPanel(tile, owner){
  const el = document.createElement("div");
  el.className = "tile" + (tile.rot===90 ? " rot90" : "");
  el.dataset.id = tile.id;
  el.dataset.owner = owner;

  el.innerHTML = `
    <div class="base"></div>
    <div class="half left"><img/></div>
    <div class="half right"><img/></div>
    <div class="rotBtn" title="Повернуть 90°">⟳</div>
  `;
  el.querySelector(".base").style.backgroundImage = `url("${TILE_BASE_URL}")`;

  const {left, right} = getLR(tile);
  el.querySelector(".left img").src = images[left];
  el.querySelector(".right img").src = images[right];

  // вращение
  el.querySelector(".rotBtn").addEventListener("click", (e)=>{
    e.stopPropagation();
    tile.rot = (tile.rot===0) ? 90 : 0;
    renderPanels();
  });

  // перетаскивание (педагог мышкой управляет всегда)
  el.addEventListener("pointerdown", (e)=>{
    if(!started) return;
    if(choosingStart){
      // на этапе выбора старта разрешаем клик: поставить в центр
      handleChooseStart(tile, owner);
      return;
    }
    // строгая очередь: можно брать только из активной панели
    if(owner !== turn) return;

    startDrag(tile, owner, e);
  });

  // клик для старта (если не тач)
  el.addEventListener("click", ()=>{
    if(choosingStart){
      handleChooseStart(tile, owner);
    }
  });

  return el;
}

function renderTileOnBoard(tile){
  const el = document.createElement("div");
  el.className = "tile" + (tile.rot===90 ? " rot90" : "");
  el.style.position = "absolute";
  el.style.left = (tile.x - TILE_W/2) + "px";
  el.style.top  = (tile.y - TILE_H/2) + "px";
  el.innerHTML = `
    <div class="base"></div>
    <div class="half left"><img/></div>
    <div class="half right"><img/></div>
  `;
  el.querySelector(".base").style.backgroundImage = `url("${TILE_BASE_URL}")`;

  const {left, right} = getLR(tile);
  el.querySelector(".left img").src = images[left];
  el.querySelector(".right img").src = images[right];
  return el;
}

function getLR(tile){
  // swap меняет местами половинки визуально (мы не переворачиваем картинку!)
  if(!tile.swap) return { left: tile.a, right: tile.b };
  return { left: tile.b, right: tile.a };
}

/* ---- старт/раздача ---- */
function newGame(){
  started = true;
  choosingStart = true;
  chain = [];
  leftEnd = null;
  rightEnd = null;

  const deal = Number(dealSelect.value);

  pile = shuffle(gen28());
  p1 = pile.splice(0, deal);
  p2 = pile.splice(0, deal);

  // сбрасываем повороты/свапы в руках
  [...p1, ...p2].forEach(t => { t.rot=0; t.swap=false; });

  renderPanels();
  renderChain();

  setTurn(1); // первым ходом всегда педагог (ты так хотела — проще)
  setStatus("Выберите стартовую костяшку (клик по костяшке активного игрока).");
  btnDraw.disabled = true;

  centerView();
}

function handleChooseStart(tile, owner){
  if(owner !== turn) return;

  // ставим в центр (0,0)
  const placed = {...tile, x: 0, y: 0};
  // убираем из руки
  removeFromOwner(tile.id, owner);
  chain.push(placed);

  // концы: слева значение left, справа right
  const {left, right} = getLR(placed);
  leftEnd = { value: left, x: placed.x - (TILE_W/2 + GAP), y: placed.y };
  rightEnd = { value: right, x: placed.x + (TILE_W/2 + GAP), y: placed.y };

  choosingStart = false;
  setStatus("Игра началась. Перетащите костяшку к одному из концов цепочки.");
  renderPanels();
  renderChain();

  // ход переходит ребёнку (строгая очередь)
  setTurn(2);
  btnDraw.disabled = hasMoveForCurrentPlayer();
}

/* ---- добор ---- */
function drawTile(){
  if(!started || choosingStart) return;
  if(hasMoveForCurrentPlayer()) return; // есть ход — добор запрещён
  if(pile.length === 0){
    setStatus("Ходов нет. Базар пуст. Игра завершена.");
    btnDraw.disabled = true;
    return;
  }
  const t = pile.pop();
  t.rot=0; t.swap=false;

  if(turn===1) p1.push(t);
  else p2.push(t);

  renderPanels();
  btnDraw.disabled = hasMoveForCurrentPlayer();
  if(hasMoveForCurrentPlayer()){
    setStatus("Добрали костяшку. Теперь можно сделать ход.");
  }else{
    setStatus("Добрали костяшку, но ходов всё ещё нет — можно добрать ещё.");
    btnDraw.disabled = false; // можно добирать дальше
  }
  updateCounts();
}

/* ---- drag & drop с магнитом ---- */
let drag = null;

function startDrag(tile, owner, e){
  // создаём "призрак" на boardWrap (в screen coords), чтобы было красиво
  const ghost = renderTileInPanel({...tile}, owner);
  ghost.style.position = "absolute";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = 999;
  ghost.style.transform = (tile.rot===90) ? "rotate(90deg)" : "none";

  document.body.appendChild(ghost);

  drag = {
    tileId: tile.id,
    owner,
    ghost,
    startRot: tile.rot,
    startSwap: tile.swap
  };

  moveGhost(e.clientX, e.clientY);

  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragUp, { once:true });
}

function onDragMove(e){
  if(!drag) return;
  moveGhost(e.clientX, e.clientY);
}

function moveGhost(cx, cy){
  const g = drag.ghost;
  g.style.left = (cx - TILE_W/2) + "px";
  g.style.top  = (cy - TILE_H/2) + "px";
}

function onDragUp(e){
  window.removeEventListener("pointermove", onDragMove);
  if(!drag) return;

  const drop = tryPlaceAtEnds(e.clientX, e.clientY, drag.tileId, drag.owner);
  drag.ghost.remove();
  drag = null;

  if(!drop){
    setStatus("Не подходит. Попробуйте к другому концу цепочки.");
  }
}

/* вычисляем в какую сторону пользователь “поднес” к концу */
function pickDirection(end, worldPoint){
  const dx = worldPoint.x - end.x;
  const dy = worldPoint.y - end.y;
  if(Math.abs(dx) >= Math.abs(dy)){
    return dx >= 0 ? "E" : "W";
  }else{
    return dy >= 0 ? "S" : "N";
  }
}

function tryPlaceAtEnds(clientX, clientY, tileId, owner){
  if(!leftEnd || !rightEnd) return false;

  // точка в мире
  const rect = boardWrap.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const wp = screenToWorld(sx, sy);

  // проверяем близость к левому/правому концу (в screen пикселях)
  const lS = worldToScreen(leftEnd.x, leftEnd.y);
  const rS = worldToScreen(rightEnd.x, rightEnd.y);

  const distL = Math.hypot((sx - lS.x), (sy - lS.y));
  const distR = Math.hypot((sx - rS.x), (sy - rS.y));

  const TH = 70; // порог “магнита” в screen px

  let target = null;
  if(distL < TH) target = "L";
  if(distR < TH && (target===null || distR < distL)) target = "R";

  if(!target) return false;

  const hand = (owner===1) ? p1 : p2;
  const idx = hand.findIndex(t => t.id === tileId);
  if(idx < 0) return false;

  const tile = hand[idx];

  const end = (target==="L") ? leftEnd : rightEnd;
  const dir = pickDirection(end, wp); // N/E/S/W — куда поднесли относительно конца

  // проверяем совпадение с концом (end.value)
  if(tile.a !== end.value && tile.b !== end.value) return false;

  // ставим swap так, чтобы совпадение было со стороны стыка
  // стык — это сторона, обращённая к концу.
  // Для простоты: мы решаем визуально по направлению dir:
  // если мы кладём на E — значит стык будет слева у новой костяшки
  // на W — стык справа
  // на S — стык сверху (но у нас визуально всё равно left/right; мы используем swap только для “какая картинка у стыка”)
  // на N — стык снизу
  // Для MVP: у вертикальной костяшки swap = "какая картинка ближе к стыку", всё равно выглядит правильно.

  const match = end.value;
  const other = (tile.a === match) ? tile.b : tile.a;

  // Логика swap:
  // Если кладём вправо/вниз, оставим совпадающую на "лево" (стык ближе к концу).
  // Если кладём влево/вверх, совпадающую на "право".
  if(dir==="E" || dir==="S"){
    // совпадение должно стать "слева"
    tile.swap = !(tile.a === match); // если a==match, swap=false => left=a, ок
  }else{
    // совпадение должно стать "справа"
    tile.swap = (tile.a === match); // если a==match, надо swap, чтобы match ушёл вправо
  }

  // ориентация:
  // dir N/S => вертикально (90), E/W => горизонтально (0)
  tile.rot = (dir==="N" || dir==="S") ? 90 : 0;

  // координаты новой кости — от конца в выбранном направлении
  const dx = (dir==="E") ? (TILE_W + GAP) : (dir==="W") ? -(TILE_W + GAP) : 0;
  const dy = (dir==="S") ? (TILE_H + GAP) : (dir==="N") ? -(TILE_H + GAP) : 0;

  const placed = {...tile, x: end.x + dx, y: end.y + dy};

  // убираем из руки
  hand.splice(idx, 1);
  chain.push(placed);

  // обновляем конец цепочки, к которому добавили
  // новый конец должен стать “снаружи” от поставленной кости:
  // у этого конца значение = other (не совпадающее)
  const newEnd = {
    value: other,
    x: placed.x + dx/2,
    y: placed.y + dy/2
  };

  if(target==="L"){
    leftEnd = newEnd;
  }else{
    rightEnd = newEnd;
  }

  // обновляем UI
  renderPanels();
  renderChain();

  // проверяем завершение
  if(p1.length===0 && p2.length===0){
    setStatus("Отличная работа! Мы собрали всё домино.");
    btnDraw.disabled = true;
    return true;
  }

  // переключаем ход
  setTurn(turn===1 ? 2 : 1);

  // кнопка добора
  btnDraw.disabled = hasMoveForCurrentPlayer();

  if(!hasMoveForCurrentPlayer()){
    setStatus("Ходов нет — нажмите «Добрать».");
    btnDraw.disabled = false;
  }else{
    setStatus("Сделайте ход: перетащите костяшку к одному из концов цепочки.");
  }

  return true;
}

function removeFromOwner(tileId, owner){
  const hand = (owner===1) ? p1 : p2;
  const idx = hand.findIndex(t => t.id === tileId);
  if(idx>=0) hand.splice(idx, 1);
}

/* ---- пан/зум ---- */
let panning = false;
let panStart = null;

boardWrap.addEventListener("pointerdown", (e)=>{
  // если начали тянуть именно поле (не костяшку) — панорамируем
  // простое правило: если клик по пустому месту
  if(e.target !== boardWrap && e.target !== board && e.target !== layer) return;

  panning = true;
  panStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  boardWrap.setPointerCapture(e.pointerId);
});

boardWrap.addEventListener("pointermove", (e)=>{
  if(!panning) return;
  const dx = e.clientX - panStart.x;
  const dy = e.clientY - panStart.y;
  view.x = panStart.vx + dx;
  view.y = panStart.vy + dy;
  applyTransform();
});

boardWrap.addEventListener("pointerup", ()=>{
  panning = false;
  panStart = null;
});

btnCenter.addEventListener("click", ()=> centerView());

btnZoomIn.addEventListener("click", ()=>{
  view.scale = Math.min(SCALE_MAX, +(view.scale + 0.05).toFixed(2));
  applyTransform();
});
btnZoomOut.addEventListener("click", ()=>{
  view.scale = Math.max(SCALE_MIN, +(view.scale - 0.05).toFixed(2));
  applyTransform();
});

/* ---- кнопки ---- */
btnNew.addEventListener("click", newGame);
btnDraw.addEventListener("click", drawTile);

/* стартовое */
setStatus("Откройте редактор и загрузите 7 картинок. Потом нажмите «Новая игра».");

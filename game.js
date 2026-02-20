const KEY="domino_imgs";
const imgs=JSON.parse(localStorage.getItem(KEY)||"[]");
const board=document.getElementById("board");

if(!imgs.length){
  board.innerHTML="Сначала загрузите картинки.";
  throw "";
}

// создаём домино 28 костей
let tiles=[];
for(let i=0;i<7;i++){
  for(let j=i;j<7;j++){
    tiles.push({a:i,b:j});
  }
}

tiles.sort(()=>Math.random()-0.5);

let chain=[];

// первая костяшка
chain.push(tiles.pop());
render();

function canAttach(tile,end){
  return tile.a===end||tile.b===end;
}

function attach(tile){
  const left=chain[0].a;
  const right=chain[chain.length-1].b;

  if(canAttach(tile,left)){
    if(tile.b===left){
      chain.unshift(tile);
    }else{
      chain.unshift({a:tile.b,b:tile.a});
    }
    return true;
  }

  if(canAttach(tile,right)){
    if(tile.a===right){
      chain.push(tile);
    }else{
      chain.push({a:tile.b,b:tile.a});
    }
    return true;
  }

  return false;
}

function render(){
  board.innerHTML="";

  chain.forEach(t=>{
    const d=document.createElement("div");
    d.className="tile";

    const i1=document.createElement("img");
    const i2=document.createElement("img");

    i1.src=imgs[t.a];
    i2.src=imgs[t.b];

    d.append(i1,i2);
    board.append(d);
  });

  // остальные костяшки
  tiles.forEach(t=>{
    const d=document.createElement("div");
    d.className="tile hand";

    const i1=document.createElement("img");
    const i2=document.createElement("img");

    i1.src=imgs[t.a];
    i2.src=imgs[t.b];

    d.append(i1,i2);

    d.onclick=()=>{
      if(attach(t)){
        tiles=tiles.filter(x=>x!==t);
        render();
      }else{
        alert("Не подходит");
      }
    };

    board.append(d);
  });
}

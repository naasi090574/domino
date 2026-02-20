const KEY="domino_imgs";
const slots=document.getElementById("slots");
let imgs=JSON.parse(localStorage.getItem(KEY)||"[]");

function render(){
  slots.innerHTML="";
  for(let i=0;i<7;i++){
    const div=document.createElement("div");
    const inp=document.createElement("input");
    inp.type="file";
    inp.accept="image/*";

    inp.onchange=e=>{
      const r=new FileReader();
      r.onload=()=>{
        imgs[i]=r.result;
        localStorage.setItem(KEY,JSON.stringify(imgs));
        render();
      };
      r.readAsDataURL(e.target.files[0]);
    };

    div.append(inp);

    if(imgs[i]){
      const im=document.createElement("img");
      im.src=imgs[i];
      im.height=60;
      div.append(im);
    }

    slots.append(div);
  }
}

render();

document.getElementById("save").onclick=()=>{
  localStorage.setItem(KEY,JSON.stringify(imgs));
  alert("Сохранено");
};

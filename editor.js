const KEY = "domino_images_7";

const slotsEl = document.getElementById("slots");
const btnClear = document.getElementById("btnClear");
const btnSave = document.getElementById("btnSave");

// для Genially-кода
const btnEmbed = document.getElementById("btnEmbed");
const embedModal = document.getElementById("embedModal");
const btnEmbedClose = document.getElementById("btnEmbedClose");
const btnEmbedCopy = document.getElementById("btnEmbedCopy");
const embedCode = document.getElementById("embedCode");
const embedHint = document.getElementById("embedHint");

let images = Array(7).fill(null); // dataURL (уже уменьшенные)

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length === 7) images = arr;
  } catch (e) {}
}

function saveToStorage() {
  localStorage.setItem(KEY, JSON.stringify(images));
}

function render() {
  slotsEl.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.id = "file_" + i;

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      // ВАЖНО: уменьшаем до 256px, чтобы влезало в ссылку для Genially
      const dataUrl = await fileToSmallDataURL(file, 256);
      images[i] = dataUrl;
      render();
    });

    if (images[i]) {
      const img = document.createElement("img");
      img.src = images[i];
      slot.appendChild(img);
    }

    const overlay = document.createElement("div");
    overlay.className = "slotOverlay";
    overlay.innerHTML = `
      <div style="font-weight:700">Картинка ${i + 1}</div>
      <label class="miniBtn" for="${input.id}">${images[i] ? "Заменить" : "Загрузить"}</label>
      ${images[i] ? `<div class="miniBtn" data-del="${i}">Удалить</div>` : ""}
    `;
    slot.appendChild(overlay);
    slot.appendChild(input);

    overlay.addEventListener("click", (e) => {
      const del = e.target?.getAttribute?.("data-del");
      if (del !== null) {
        images[Number(del)] = null;
        render();
      }
    });

    slotsEl.appendChild(slot);
  }
}

async function fileToSmallDataURL(file, maxSize = 256) {
  const img = await fileToImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  // webp сильно меньше, чем png/jpg
  return canvas.toDataURL("image/webp", 0.85);
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

btnClear.addEventListener("click", () => {
  images = Array(7).fill(null);
  saveToStorage();
  render();
});

btnSave.addEventListener("click", () => {
  saveToStorage();
  alert("Набор сохранён. Можно переходить в игру.");
});

loadFromStorage();
render();

/* ================================
   КОД ДЛЯ GENIALLY (главное!)
   Передаём картинки в ссылке set=
   ================================ */

function base64FromJson(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function makeEmbedIframe() {
  // ссылка на игру
  const gameUrl = new URL("game.html", window.location.href);

  // set = набор картинок (уменьшенные webp)
  const set = base64FromJson(images);
  gameUrl.searchParams.set("set", set);

  return `<div style="width:100%;height:720px;">
  <iframe
    src="${gameUrl.toString()}"
    style="width:100%;height:100%;border:0;border-radius:16px;overflow:hidden;"
    allow="fullscreen"
    loading="lazy"
  ></iframe>
</div>`;
}

btnEmbed?.addEventListener("click", () => {
  if (embedHint) embedHint.textContent = "";
  if (embedCode) embedCode.value = makeEmbedIframe();
  if (embedModal) embedModal.style.display = "block";
});

btnEmbedClose?.addEventListener("click", () => {
  if (embedModal) embedModal.style.display = "none";
});

embedModal?.addEventListener("click", (e) => {
  if (e.target === embedModal) embedModal.style.display = "none";
});

btnEmbedCopy?.addEventListener("click", async () => {
  if (!embedCode) return;
  try {
    await navigator.clipboard.writeText(embedCode.value);
    if (embedHint) embedHint.textContent = "Скопировано ✅";
  } catch (e) {
    embedCode.focus();
    embedCode.select();
    document.execCommand("copy");
    if (embedHint) embedHint.textContent = "Скопировано ✅";
  }
});

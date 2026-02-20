const KEY = "domino_images_7";

const slotsEl = document.getElementById("slots");
const btnClear = document.getElementById("btnClear");
const btnSave = document.getElementById("btnSave");

let images = Array(7).fill(null); // dataURL

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length === 7) {
      images = arr;
    }
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
      const dataUrl = await fileToDataURL(file);
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
        const idx = Number(del);
        images[idx] = null;
        render();
      }
    });

    slotsEl.appendChild(slot);
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
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

/* =========================================================
   КОД ДЛЯ GENIALLY (кнопка + окно + копирование)
   ========================================================= */

const btnEmbed = document.getElementById("btnEmbed");
const embedModal = document.getElementById("embedModal");
const btnEmbedClose = document.getElementById("btnEmbedClose");
const btnEmbedCopy = document.getElementById("btnEmbedCopy");
const embedCode = document.getElementById("embedCode");
const embedHint = document.getElementById("embedHint");

// Надёжно собираем ссылку на game.html в любом варианте URL
function makeEmbedIframe() {
  const gameUrl = new URL("game.html", window.location.href).toString();

  return `<div style="width:100%;height:720px;">
  <iframe
    src="${gameUrl}"
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

// клик по затемнению закрывает
embedModal?.addEventListener("click", (e) => {
  if (e.target === embedModal) embedModal.style.display = "none";
});

btnEmbedCopy?.addEventListener("click", async () => {
  if (!embedCode) return;

  try {
    await navigator.clipboard.writeText(embedCode.value);
    if (embedHint) embedHint.textContent = "Скопировано ✅";
  } catch (e) {
    // запасной способ (если clipboard запрещён)
    embedCode.focus();
    embedCode.select();
    document.execCommand("copy");
    if (embedHint) embedHint.textContent = "Скопировано ✅";
  }
});

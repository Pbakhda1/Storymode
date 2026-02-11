// Storymode — story to storyboard "video" preview (client-side)

const fileInput = document.getElementById("fileInput");
const storyText = document.getElementById("storyText");
const loadDemoBtn = document.getElementById("loadDemoBtn");
const clearBtn = document.getElementById("clearBtn");
const inputStatus = document.getElementById("inputStatus");

const styleSelect = document.getElementById("styleSelect");
const pacing = document.getElementById("pacing");
const pacingVal = document.getElementById("pacingVal");
const sceneLen = document.getElementById("sceneLen");
const voiceSelect = document.getElementById("voiceSelect");
const generateBtn = document.getElementById("generateBtn");
const resetScenesBtn = document.getElementById("resetScenesBtn");
const genStatus = document.getElementById("genStatus");

const frame = document.getElementById("frame");
const frameStyleTag = document.getElementById("frameStyleTag");
const frameTitle = document.getElementById("frameTitle");
const frameDesc = document.getElementById("frameDesc");
const captionText = document.getElementById("captionText");
const scenesList = document.getElementById("scenesList");
const playerMeta = document.getElementById("playerMeta");

const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const speakBtn = document.getElementById("speakBtn");

const shotList = document.getElementById("shotList");
const downloadShotListBtn = document.getElementById("downloadShotListBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");

let scenes = [];
let currentIndex = 0;
let timer = null;
let isPaused = false;

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function setStatus(el, msg){
  el.innerHTML = `<strong>Status:</strong> ${msg}`;
}

pacing.addEventListener("input", () => {
  pacingVal.textContent = pacing.value;
});

function loadVoices(){
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  voiceSelect.innerHTML = "";
  const usable = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
  const list = usable.length ? usable : voices;

  for(const v of list){
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    voiceSelect.appendChild(opt);
  }
}
if ("speechSynthesis" in window){
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
} else {
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "No TTS available in this browser";
  voiceSelect.appendChild(opt);
}

fileInput.addEventListener("change", async () => {
  const f = fileInput.files && fileInput.files[0];
  if(!f) return;
  const text = await f.text();
  storyText.value = text;
  setStatus(inputStatus, `Loaded file: <strong>${escapeHtml(f.name)}</strong>`);
});

loadDemoBtn.addEventListener("click", () => {
  storyText.value =
`Chapter 1: The Door in the Alley

Rain painted the street in silver. Mira pulled her hood tighter and stepped into the alley behind the old cinema.
A faint glow leaked from a door that wasn't there yesterday.

She touched the handle. Warm. Like it had been waiting.
The door opened into a hallway lined with movie posters—except the posters moved, alive with scenes from stories she’d never read.

A voice whispered: “Pick your story… and watch it become real.”

Mira chose a poster titled STORYMODE.

The hallway flickered. The world rewrote itself.

Chapter 2: The First Scene

A kitchen. A toaster on the counter. A note: “Begin.”
Mira realized the stories weren’t just playing—they were responding to her choices.`;
  setStatus(inputStatus, `Demo story loaded.`);
});

clearBtn.addEventListener("click", () => {
  storyText.value = "";
  fileInput.value = "";
  setStatus(inputStatus, "Cleared.");
});

function splitIntoScenes(text, lenMode){
  const clean = text.replace(/\r/g, "").trim();
  if(!clean) return [];

  // Split on blank lines or chapter headings
  let parts = clean
    .split(/\n\s*\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  // If too few parts, split by sentences into chunks
  if(parts.length < 4){
    const sentences = clean.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const chunkSize = lenMode === "short" ? 3 : lenMode === "medium" ? 5 : 8;
    parts = [];
    for(let i=0;i<sentences.length;i+=chunkSize){
      parts.push(sentences.slice(i, i+chunkSize).join(" "));
    }
  }

  // Build scene objects
  const sceneObjs = parts.map((p, i) => {
    const title = p.split("\n")[0].slice(0, 48);
    const summary = p.length > 220 ? p.slice(0, 220) + "…" : p;
    const caption = guessCaption(p);
    const visual = guessVisualPrompt(p);
    return {
      index: i+1,
      title: title || `Scene ${i+1}`,
      text: p,
      summary,
      caption,
      visual
    };
  });

  return sceneObjs;
}

function guessCaption(text){
  // Simple "caption" = first strong sentence or a trimmed line
  const line = text.split("\n").map(s=>s.trim()).find(Boolean) || "";
  const sent = line.split(/(?<=[.!?])\s+/)[0] || line;
  return sent.length > 110 ? sent.slice(0, 110) + "…" : sent;
}

function guessVisualPrompt(text){
  // Very simple keyword-based prompt builder
  const lower = text.toLowerCase();
  const picks = [];
  if(lower.includes("rain") || lower.includes("storm")) picks.push("rainy atmosphere");
  if(lower.includes("alley")) picks.push("narrow alley");
  if(lower.includes("door")) picks.push("mysterious door");
  if(lower.includes("cinema") || lower.includes("movie")) picks.push("cinematic lighting");
  if(lower.includes("kitchen")) picks.push("kitchen interior");
  if(lower.includes("toaster")) picks.push("toaster on counter");
  if(lower.includes("whisper") || lower.includes("voice")) picks.push("whispering presence");

  if(!picks.length) picks.push("story-driven scene");
  return picks.join(", ");
}

function styleTag(s){
  return String(s || "").toUpperCase();
}

function renderScenesList(){
  scenesList.innerHTML = "";
  scenes.forEach((sc, idx) => {
    const div = document.createElement("div");
    div.className = "scene-card";
    div.innerHTML = `
      <div class="scene-top">
        <div class="scene-name">Scene ${sc.index}: ${escapeHtml(sc.title)}</div>
        <div class="scene-meta">${escapeHtml(sc.visual)}</div>
      </div>
      <div class="scene-body">${escapeHtml(sc.summary)}</div>
    `;
    div.addEventListener("click", () => {
      stopPlayback();
      goTo(idx);
    });
    scenesList.appendChild(div);
  });
}

function updateFrame(){
  if(!scenes.length){
    frameStyleTag.textContent = styleTag(styleSelect.value);
    frameTitle.textContent = "No storyboard yet";
    frameDesc.textContent = "Generate scenes to preview your story.";
    captionText.textContent = "—";
    playerMeta.textContent = "Scene 0 / 0";
    return;
  }

  const sc = scenes[currentIndex];
  frameStyleTag.textContent = styleTag(styleSelect.value);
  frameTitle.textContent = `Scene ${sc.index}: ${sc.title}`;
  frameDesc.textContent = sc.visual;
  captionText.textContent = sc.caption;
  playerMeta.textContent = `Scene ${currentIndex+1} / ${scenes.length}`;
}

function goTo(idx){
  currentIndex = Math.max(0, Math.min(idx, scenes.length - 1));
  updateFrame();
  enablePlayer();
  updateShotList();
}

function enablePlayer(){
  const on = scenes.length > 0;
  playBtn.disabled = !on;
  pauseBtn.disabled = !on;
  stopBtn.disabled = !on;
  speakBtn.disabled = !on;
  resetScenesBtn.disabled = !on;
  downloadShotListBtn.disabled = !on;
  downloadJsonBtn.disabled = !on;
}

function updateShotList(){
  if(!scenes.length){
    shotList.value = "";
    return;
  }
  const style = styleSelect.value;
  shotList.value = scenes.map(sc => {
    return `SCENE ${sc.index}\nTitle: ${sc.title}\nStyle: ${style}\nVisual: ${sc.visual}\nCaption: ${sc.caption}\n---\n`;
  }).join("\n");
}

function stopPlayback(){
  if(timer){
    clearInterval(timer);
    timer = null;
  }
  isPaused = false;
  if("speechSynthesis" in window) speechSynthesis.cancel();
}

function play(){
  if(!scenes.length) return;
  stopPlayback();
  isPaused = false;

  const ms = Number(pacing.value) * 1000;
  timer = setInterval(() => {
    if(isPaused) return;
    currentIndex++;
    if(currentIndex >= scenes.length){
      stopPlayback();
      return;
    }
    updateFrame();
  }, ms);
}

function pause(){
  isPaused = true;
}

function stop(){
  stopPlayback();
  currentIndex = 0;
  updateFrame();
}

function getSelectedVoice(){
  if(!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  const name = voiceSelect.value;
  return voices.find(v => v.name === name) || null;
}

function narrateCurrentScene(){
  if(!("speechSynthesis" in window)) return;
  if(!scenes.length) return;
  speechSynthesis.cancel();

  const sc = scenes[currentIndex];
  const u = new SpeechSynthesisUtterance(sc.text);
  const v = getSelectedVoice();
  if(v) u.voice = v;
  u.rate = styleSelect.value === "kids" ? 1.05 : styleSelect.value === "noir" ? 0.95 : 1.0;
  speechSynthesis.speak(u);
}

generateBtn.addEventListener("click", () => {
  const text = storyText.value.trim();
  if(!text){
    setStatus(genStatus, "Paste or upload a story first.");
    return;
  }
  scenes = splitIntoScenes(text, sceneLen.value);
  currentIndex = 0;
  renderScenesList();
  updateFrame();
  enablePlayer();
  updateShotList();
  setStatus(genStatus, `Generated <strong>${scenes.length}</strong> scenes.`);
});

resetScenesBtn.addEventListener("click", () => {
  stopPlayback();
  scenes = [];
  currentIndex = 0;
  scenesList.innerHTML = "";
  updateFrame();
  enablePlayer();
  shotList.value = "";
  setStatus(genStatus, "Reset.");
});

playBtn.addEventListener("click", play);
pauseBtn.addEventListener("click", pause);
stopBtn.addEventListener("click", stop);
speakBtn.addEventListener("click", narrateCurrentScene);

downloadShotListBtn.addEventListener("click", () => {
  const blob = new Blob([shotList.value], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "storymode_shotlist.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

downloadJsonBtn.addEventListener("click", () => {
  const payload = {
    style: styleSelect.value,
    pacingSeconds: Number(pacing.value),
    sceneLength: sceneLen.value,
    scenes
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "storymode_scenes.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// Init UI
pacingVal.textContent = pacing.value;
updateFrame();
enablePlayer();

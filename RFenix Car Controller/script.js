/* ================================
   🌐 VARIABLES GLOBALES
================================ */
let CAM_IP = "192.168.1.120";
let camConnected = false;
let interval = null;
let recording = false;
let timer, sec = 0;

let recognition;
let voiceActive = false;
let voiceState = false;


/* ================================
   📷 ESTADO DE CÁMARA
================================ */
function setCamStatus(type, text) {
  const box = document.getElementById("camStatusBox");
  const label = document.getElementById("camStatusText");

  if (!box || !label) return;

  box.className = "cam-status " + type;

  let icon = "📷";
  if (type === "connected") icon = "🟢";
  else if (type === "connecting") icon = "🟡";
  else if (type === "error") icon = "🔴";

  label.innerText = icon + " " + text;

  box.style.transform = "scale(1.1)";
  setTimeout(() => (box.style.transform = "scale(1)"), 150);
}


/* ================================
   🎥 CÁMARA
================================ */
function startCamera() {
  const cam = document.getElementById("cam");

  if (window.camInterval) clearInterval(window.camInterval);

  setCamStatus("connecting", "Conectando...");

  function load() {
    cam.src = `http://${CAM_IP}:81/stream`;
  }

  cam.onload = () => {
    camConnected = true;
    setCamStatus("connected", "Conectada");
  };

  cam.onerror = () => {
    camConnected = false;
    setCamStatus("error", "Reconectando...");
    setTimeout(load, 1500);
  };

  load();

  window.camInterval = setInterval(() => {
    cam.src = `http://${CAM_IP}:81/stream?${Date.now()}`;
  }, 15000);
}


/* ================================
   💾 IP CÁMARA
================================ */
function saveCamIP() {
  const input = document.getElementById("camIpInput").value.trim();

  if (!input) {
    alert("❌ Ingresa una IP válida");
    return;
  }

  CAM_IP = input;
  localStorage.setItem("cam_ip", CAM_IP);

  alert("✅ IP guardada: " + CAM_IP);
  startCamera();
}


/* ================================
   🔍 AUTO DETECTAR
================================ */
async function autoDetectCamera() {
  let list = document.getElementById("cameraList");

  if (!list) {
    list = document.createElement("div");
    list.id = "cameraList";
    list.style.cssText = `
      margin-top:10px;
      max-height:150px;
      overflow-y:auto;
      display:flex;
      flex-direction:column;
      gap:6px;
    `;

    document.querySelector("#camIpInput").parentElement.appendChild(list);
  }

  list.innerHTML = "🔍 Buscando cámaras...";

  const baseIP = "192.168.1.";
  const foundList = [];

  setTimeout(() => (list.innerHTML = ""), 500);

  for (let i = 100; i <= 120; i++) {
    const ip = baseIP + i;

    fetch(`http://${ip}:81/stream`, { mode: "no-cors" })
      .then(() => {
        if (foundList.includes(ip)) return;

        foundList.push(ip);

        const btn = document.createElement("button");
        btn.innerText = "📷 " + ip;
        btn.style.height = "45px";
        btn.style.borderRadius = "10px";

        btn.onclick = (e) => {
          e.stopPropagation();

          CAM_IP = ip;
          localStorage.setItem("cam_ip", CAM_IP);

          document.getElementById("camIpInput").value = ip;

          alert("✅ Conectado a " + ip);
          startCamera();
        };

        list.appendChild(btn);
      })
      .catch(() => {});
  }

  setTimeout(() => {
    if (foundList.length === 0) {
      list.innerHTML = "❌ No se encontraron cámaras";
    }
  }, 4000);
}


/* ================================
   🧪 TEST CÁMARA
================================ */
function testCamera() {
  fetch(`http://${CAM_IP}/stream`)
    .then(() => alert("✅ Cámara OK"))
    .catch(() => alert("❌ Error de cámara"));
}


/* ================================
   🔵 BLUETOOTH
================================ */
const btnBT = document.getElementById("connectBtn");
const statusBT = document.getElementById("status");

btnBT.onclick = () => {
  if (!window.bluetoothSerial) {
    alert("Solo APK");
    return;
  }

  statusBT.innerText = "🟡 Conectando...";
  statusBT.className = "bt-connecting";

  bluetoothSerial.list((devices) => {
    const hc = devices.find((d) => d.name?.includes("HC-05"));

    if (!hc) {
      alert("HC-05 no encontrado");
      return;
    }

    bluetoothSerial.connect(
      hc.address,
      () => {
        statusBT.innerText = "🟢 Conectado";
        statusBT.className = "bt-connected";
        btnBT.innerText = "✅ Conectado";
        startCamera();
      },
      () => {
        statusBT.innerText = "🔴 Error";
        statusBT.className = "bt-disconnected";
      }
    );
  });
};


/* ================================
   🎮 CONTROLES
================================ */
function send(cmd) {
  if (window.bluetoothSerial) bluetoothSerial.write(cmd);
}

function press(cmd) {
  send(cmd);
  interval = setInterval(() => send(cmd), 150);
}

function release() {
  clearInterval(interval);
  send("S");
}

function bindButton(id, cmd) {
  const btn = document.getElementById(id);

  const on = () => {
    btn.classList.add("control-active");
    press(cmd);
  };

  const off = () => {
    btn.classList.remove("control-active");
    release();
  };

  btn.addEventListener("touchstart", (e) => { e.preventDefault(); on(); });
  btn.addEventListener("touchend", off);
  btn.addEventListener("mousedown", on);
  btn.addEventListener("mouseup", off);
  btn.addEventListener("mouseleave", off);
}

bindButton("forward", "F");
bindButton("backward", "B");
bindButton("left", "L");
bindButton("right", "R");


/* ================================
   💡 BOTONES (LUZ / AUTO)
================================ */
function toggle(btn, cmdOn, cmdOff) {
  let state = false;

  btn.onclick = () => {
    state = !state;

    send(state ? cmdOn : cmdOff);
    btn.classList.toggle("active-btn", state);

    btn.querySelector("small").innerText = state ? "ON" : "";
  };
}

toggle(lights, "X", "Y");
toggle(auto, "A", "M");


/* ================================
   🎤 VOZ
================================ */
function initVoice() {
  if (!("webkitSpeechRecognition" in window)) {
    alert("❌ No soporta voz");
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.lang = "es-ES";
  recognition.continuous = true;

  recognition.onend = () => {
    if (voiceActive) recognition.start();
  };

  recognition.onresult = (event) => {
    const text = event.results[event.results.length - 1][0].transcript.toLowerCase();

    if (text.includes("avanzar")) send("F");
    else if (text.includes("retroceder")) send("B");
    else if (text.includes("izquierda")) send("L");
    else if (text.includes("derecha")) send("R");
    else if (text.includes("parar") || text.includes("stop")) send("S");
  };
}

voice.onclick = () => {
  voiceState = !voiceState;

  voice.classList.toggle("active-btn", voiceState);
  voice.querySelector("small").innerText = voiceState ? "ON" : "";

  if (voiceState) {
    if (!recognition) initVoice();
    voiceActive = true;
    recognition.start();
  } else {
    voiceActive = false;
    recognition?.stop();
    send("S");
  }
};


/* ================================
   ⚡ VELOCIDAD
================================ */
speedSlider.oninput = () => {
  speedValue.innerText = speedSlider.value;
  send(speedSlider.value);
};


/* ================================
   🔋 BATERÍA
================================ */
function updateBattery(v) {
  batteryLevel.innerText = v + "%";

  if (v <= 15) {
    alert("⚠️ batería baja");
    navigator.vibrate?.([200, 100, 200]);
  }
}


/* ================================
   ⚙️ CONFIG
================================ */
function toggleConfig() {
  configPanel.classList.toggle("active");
  controls.classList.toggle("hidden");
}

function toggleInterface(el) {
  el.classList.toggle("active");
}


/* ================================
   🎥 GRABACIÓN
================================ */
function setupRec() {
  const btn = document.getElementById("recordBtn");

  btn.addEventListener("click", handleRec);
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleRec();
  });
}

function handleRec() {
  const btn = document.getElementById("recordBtn");

  btn.classList.add("control-active");
  setTimeout(() => btn.classList.remove("control-active"), 150);

  if (!camConnected) {
    alert("❌ Cámara Desconectada");
    return;
  }

  if (!recording) {
    fetch(`http://${CAM_IP}/start`);
    recording = true;
    btn.classList.add("recording");
    startTimer();
  } else {
    fetch(`http://${CAM_IP}/stop`);
    recording = false;
    btn.classList.remove("recording");
    stopTimer();
    downloadVideo();
  }
}


/* ================================
   ⏱️ TIMER
================================ */
function startTimer() {
  sec = 0;

  timer = setInterval(() => {
    sec++;

    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");

    document.getElementById("recTime").innerText = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
}


/* ================================
   💾 DESCARGAR VIDEO
================================ */
function downloadVideo() {
  const url = `http://${CAM_IP}/video`;

  if (!window.cordova) {
    alert("⚠️ Solo APK");
    return;
  }

  window.resolveLocalFileSystemURL(
    cordova.file.externalRootDirectory + "Movies/",
    (dir) => {
      dir.getFile(`car_${Date.now()}.mp4`, { create: true }, (file) => {
        file.createWriter((writer) => {
          fetch(url)
            .then((r) => r.blob())
            .then((blob) => {
              writer.write(blob);
              alert("✅ Guardado");
            });
        });
      });
    }
  );
}


/* ================================
   🚀 INIT
================================ */
window.onload = () => {
  setupRec();

  const savedIP = localStorage.getItem("cam_ip");
  if (savedIP) {
    CAM_IP = savedIP;
    const input = document.getElementById("camIpInput");
    if (input) input.value = savedIP;
  }
};
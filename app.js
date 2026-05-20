/* ─────────── RINGELMANN REFERENCE DATA ─────────── */
const RINGELMANN = [
  { scale: 0, opacity: 0, label: "0% Kepekatan", status: "Aman", rgb: [255, 255, 255], hex: "#ffffff", color: "#22c55e" },
  { scale: 1, opacity: 20, label: "20% Kepekatan", status: "Aman", rgb: [204, 204, 204], hex: "#cccccc", color: "#4ade80" },
  { scale: 2, opacity: 40, label: "40% Kepekatan", status: "Normal", rgb: [153, 153, 153], hex: "#999999", color: "#facc15" },
  { scale: 3, opacity: 60, label: "60% Kepekatan", status: "Peringatan", rgb: [102, 102, 102], hex: "#666666", color: "#f97316" },
  { scale: 4, opacity: 80, label: "80% Kepekatan", status: "Bahaya", rgb: [51, 51, 51], hex: "#333333", color: "#ef4444" },
  { scale: 5, opacity: 100, label: "100% Kepekatan", status: "Sangat Bahaya", rgb: [0, 0, 0], hex: "#000000", color: "#dc2626" },
];

/* ─────────── STATE ─────────── */
let videoStream = null;
let videoTrack = null;
let cssZoom = 1;
let videoEl, hiddenCanvas, captureCanvas;

/* ─────────── INIT ─────────── */
window.addEventListener('DOMContentLoaded', async () => {
  videoEl = document.getElementById('videoFeed');
  hiddenCanvas = document.getElementById('hiddenCanvas');
  captureCanvas = document.getElementById('captureCanvas');
  buildLegend();

  document.getElementById('captureBtn').disabled = true;
  document.getElementById('captureBtn').style.opacity = '0.4';
  setStatus('MEMULAI KAMERA...', false, 'loading');

  startCamera();
});

/* ─────────── LEGEND ─────────── */
function buildLegend(highlightScale = -1) {
  const el = document.getElementById('scaleLegend');
  const widths = [5, 20, 40, 55, 75, 100];
  el.innerHTML = `<div class="legend-title">◈ Skala Ringelmann Referensi</div><div class="scale-bars">
      ${RINGELMANN.map((r, i) => `
        <div class="scale-bar-row ${highlightScale >= 0 ? (i === highlightScale ? 'highlighted' : 'dimmed') : ''}">
          <span class="scale-bar-num">${r.scale}</span>
          <div class="scale-bar-swatch" style="background:${r.hex}"></div>
          <div class="scale-bar-fill" style="background:${r.hex}; width:${widths[i]}%; border:1px solid rgba(0,0,0,0.08)"></div>
          <span class="scale-bar-info" style="color:${r.color}; font-size:11px; font-family: var(--font-mono)">${r.opacity}% · ${r.status}</span>
        </div>`).join('')}
    </div>`;
}

/* ─────────── CAMERA ─────────── */
async function startCamera() {
  setStatus('INIT', false);
  try {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      }
    };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = videoStream;
    videoTrack = videoStream.getVideoTracks()[0];
    videoEl.onloadedmetadata = () => {
      const t = videoTrack.getSettings();
      document.getElementById('resTag').textContent = `RES: ${t.width}×${t.height}`;

      setStatus('READY', true);
      document.getElementById('captureBtn').disabled = false;
      document.getElementById('captureBtn').style.opacity = '1';
      setupZoom();
    };
  } catch (err) {
    console.error('Camera error:', err);
    document.getElementById('permError').classList.add('visible');
    document.getElementById('captureBtn').disabled = true;
    document.getElementById('captureBtn').style.opacity = '0.4';
    setStatus('ERROR', false);
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
    videoTrack = null;
  }
}

function setupZoom() {
  const slider = document.getElementById('zoomSlider');
  const valOut = document.getElementById('zoomValOut');

  slider.value = 1;
  valOut.textContent = '1.0x';
  videoEl.style.transform = `scale(1)`;
  cssZoom = 1;

  let capabilities = null;
  if (videoTrack && videoTrack.getCapabilities) {
    capabilities = videoTrack.getCapabilities();
  }

  if (capabilities && capabilities.zoom) {
    slider.min = capabilities.zoom.min || 1;
    slider.max = capabilities.zoom.max || 5;
    slider.step = capabilities.zoom.step || 0.1;
    slider.value = videoTrack.getSettings().zoom || slider.min;
    valOut.textContent = parseFloat(slider.value).toFixed(1) + 'x';

    let zoomTimeout;
    slider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      valOut.textContent = val.toFixed(1) + 'x';
      clearTimeout(zoomTimeout);
      zoomTimeout = setTimeout(() => {
        videoTrack.applyConstraints({ advanced: [{ zoom: val }] }).catch(console.error);
      }, 50);
      cssZoom = 1;
    };
  } else {
    slider.min = 1;
    slider.max = 5;
    slider.step = 0.1;
    slider.value = 1;

    slider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      valOut.textContent = val.toFixed(1) + 'x';
      videoEl.style.transform = `scale(${val})`;
      cssZoom = val;
    };
  }
}

function setStatus(text, ready, customClass) {
  const badge = document.getElementById('statusBadge');
  document.getElementById('statusText').textContent = text;
  badge.className = 'status-badge ' + (customClass || (ready ? 'ready' : 'idle'));
}

/* ─────────── EUCLIDEAN DISTANCE ─────────── */
function euclidean(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

function classifyRGB(rgb) {
  let best = 0, bestDist = Infinity;
  RINGELMANN.forEach((r, i) => {
    const d = euclidean(rgb, r.rgb);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return { index: best, distance: bestDist, ref: RINGELMANN[best] };
}

/* ─────────── CAPTURE ─────────── */
function doCapture() {
  if (!videoStream) return;

  // Show overlay
  document.getElementById('procOverlay').classList.add('visible');

  setTimeout(async () => {
    try {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) { alert('Video belum siap. Coba lagi.'); return; }

      // Determine viewfinder rect in video coords
      const camBox = document.getElementById('camBox');
      const vfBox = document.getElementById('viewfinder');
      const camRect = camBox.getBoundingClientRect();
      const vfRect = vfBox.getBoundingClientRect();

      const coverScale = Math.max(camRect.width / vw, camRect.height / vh);
      const dispW = vw * coverScale;
      const dispH = vh * coverScale;

      const z = cssZoom;
      const vfLeftInVideo = (vfRect.left - camRect.left) - (camRect.width - dispW * z) / 2;
      const vfTopInVideo = (vfRect.top - camRect.top) - (camRect.height - dispH * z) / 2;

      let cropX = Math.round(vfLeftInVideo / (coverScale * z));
      let cropY = Math.round(vfTopInVideo / (coverScale * z));
      let cropW = Math.round(vfRect.width / (coverScale * z));
      let cropH = Math.round(vfRect.height / (coverScale * z));

      // Clamp crop region to video boundaries
      cropX = Math.max(0, Math.min(cropX, vw - 1));
      cropY = Math.max(0, Math.min(cropY, vh - 1));
      cropW = Math.min(cropW, vw - cropX);
      cropH = Math.min(cropH, vh - cropY);

      // Draw full frame to hidden canvas
      hiddenCanvas.width = vw;
      hiddenCanvas.height = vh;
      const hCtx = hiddenCanvas.getContext('2d');
      hCtx.drawImage(videoEl, 0, 0, vw, vh);

      // Extract crop
      const imgData = hCtx.getImageData(cropX, cropY, cropW, cropH);
      const data = imgData.data;
      let rSum = 0, gSum = 0, bSum = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
      }
      const avgRGB = [
        Math.round(rSum / pixels),
        Math.round(gSum / pixels),
        Math.round(bSum / pixels)
      ];

      // Draw cropped image to display canvas
      captureCanvas.width = cropW;
      captureCanvas.height = cropH;
      const dCtx = captureCanvas.getContext('2d');
      dCtx.putImageData(imgData, 0, 0);

      // Classify Ringelmann
      const result = classifyRGB(avgRGB);

      // Stop camera
      stopCamera();

      // Show results
      showResults(avgRGB, result);

    } catch (e) {
      console.error(e);
      alert('Gagal memproses gambar. Pastikan kamera aktif.');
    } finally {
      document.getElementById('procOverlay').classList.remove('visible');
    }
  }, 350);
}

/* ─────────── SHOW RESULTS ─────────── */
function showResults(avgRGB, result) {
  const r = result.ref;

  // Update card accent color
  const card = document.getElementById('resultCard');

  // Timestamp stamp
  const now = new Date();
  document.getElementById('resultStamp').textContent =
    now.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

  card.style.setProperty('--result-accent', r.color);
  document.getElementById('resultScale').textContent =
    `Skala ${r.scale} — ${r.status}`;
  document.getElementById('resultScale').style.fontSize = "32px";
  document.getElementById('resultDesc').textContent =
    `${r.label} · ${r.status.toUpperCase()}`;

  // Meta cells
  document.getElementById('metaRgb').textContent =
    `rgb(${avgRGB[0]}, ${avgRGB[1]}, ${avgRGB[2]})`;
  document.getElementById('metaRef').innerHTML =
    `<span class="color-swatch" style="background:${r.hex}"></span>${r.hex}`;
  document.getElementById('metaDist').textContent =
    result.distance.toFixed(2);
  document.getElementById('metaOpacity').textContent =
    `${r.opacity}%`;

  document.querySelector('.result-meta-row').style.display = 'grid';
  document.getElementById('scaleLegend').style.display = 'block';

  // Rebuild legend with highlight
  buildLegend(result.index);

  // Switch views
  document.getElementById('cameraView').style.display = 'none';
  document.getElementById('instructionStrip').style.display = 'none';
  document.getElementById('resultView').style.display = 'flex';

  setStatus('DONE', false);
}

/* ─────────── RETRY ─────────── */
function doRetry() {
  document.getElementById('resultView').style.display = 'none';
  document.getElementById('cameraView').style.display = 'block';
  document.getElementById('instructionStrip').style.display = 'block';
  document.getElementById('captureBtn').disabled = false;
  document.getElementById('captureBtn').style.opacity = '1';
  document.getElementById('permError').classList.remove('visible');

  // Kembalikan tampilan result info
  document.querySelector('.result-meta-row').style.display = 'grid';
  document.getElementById('scaleLegend').style.display = 'block';
  document.getElementById('resultScale').style.fontSize = "32px";

  buildLegend();
  startCamera();
}

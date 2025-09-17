// ===== Tab Switcher =====
function showTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(div => div.style.display = "none");
  document.getElementById(tabId).style.display = "block";
}

// ===== Photoshop-style Cropper =====
let cropper = null;
let currentPreviewContainer = null;

function startCrop(inputId, previewContainerId) {
  const fileInput = document.getElementById(inputId);
  if (!fileInput.files.length) return alert("Select image first!");
  const file = fileInput.files[0];

  currentPreviewContainer = document.getElementById(previewContainerId);

  const reader = new FileReader();
  reader.onload = e => {
    const img = document.createElement("img");
    img.src = e.target.result;
    img.style.maxWidth = "100%";
    img.style.display = "block";

    currentPreviewContainer.innerHTML = "";
    currentPreviewContainer.appendChild(img);

    if (cropper) cropper.destroy();
    cropper = new Cropper(img, {
      aspectRatio: NaN, // free crop
      viewMode: 1,
      autoCropArea: 0.8,
      movable: true,
      zoomable: true,
      rotatable: true,
      scalable: true
    });
  };
  reader.readAsDataURL(file);
}

function applyCrop(previewContainerId) {
  if (!cropper) return alert("Start cropping first!");
  const canvas = cropper.getCroppedCanvas();
  if (!canvas) return alert("Nothing to crop!");

  const previewContainer = document.getElementById(previewContainerId);
  const previewImg = document.createElement("img");
  previewImg.src = canvas.toDataURL("image/jpeg");
  previewImg.classList.add("preview-img");

  previewContainer.innerHTML = "";
  previewContainer.appendChild(previewImg);

  cropper.destroy();
  cropper = null;
}

// ===== Helper: Compress Image =====
function compressImage(file, quality = 0.9) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.readAsArrayBuffer(blob);
        }, "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ===== JPEG ➝ PDF =====
async function convertJpegToPdf() {
  if (!currentPreviewContainer) return alert("Crop image first!");
  const imgEl = currentPreviewContainer.querySelector("img");
  if (!imgEl) return alert("No cropped image available!");

  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  const dataUrl = imgEl.src;
  const byteString = atob(dataUrl.split(',')[1]);
  const buffer = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i);

  const img = await pdfDoc.embedJpg(buffer);
  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });

  const pdfBytes = await pdfDoc.save();
  const blobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
  document.getElementById("jpegToPdfPreview").src = blobUrl;
  document.getElementById("jpegToPdfDownload").href = blobUrl;
}

// ===== PDF ➝ JPEG =====
async function convertPdfToJpeg() {
  const file = document.getElementById("pdfToJpegInput").files[0];
  if (!file) return alert("Select a PDF file.");

  const pdfData = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport }).promise;

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const preview = document.getElementById("pdfToJpegPreview");
  preview.innerHTML = `<img src="${jpegDataUrl}" class="preview-img">`;
  document.getElementById("pdfToJpegDownload").href = jpegDataUrl;
}

// ===== JPEG Resize =====
function resizeJPEG() {
  if (!currentPreviewContainer) return alert("Crop image first!");
  const imgEl = currentPreviewContainer.querySelector("img");
  if (!imgEl) return alert("No cropped image available!");

  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0);

  let quality = 0.9;
  let result;
  const targetKB = parseInt(document.getElementById("jpegResizeTargetKB").value);
  do {
    result = canvas.toDataURL("image/jpeg", quality);
    quality -= 0.05;
  } while (targetKB && result.length / 1024 > targetKB && quality > 0.1);

  document.getElementById("jpegResizePreview").src = result;
  document.getElementById("jpegResizeDownload").href = result;
}

// ===== PDF Resize (basic copy) =====
async function resizePDF() {
  const file = document.getElementById("pdfResizeInput").files[0];
  if (!file) return alert("Select a PDF file.");

  const pdfBytes = await file.arrayBuffer();
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
  copiedPages.forEach(p => newPdf.addPage(p));

  const newPdfBytes = await newPdf.save();
  const blobUrl = URL.createObjectURL(new Blob([newPdfBytes], { type: "application/pdf" }));
  document.getElementById("pdfResizePreview").src = blobUrl;
  document.getElementById("pdfResizeDownload").href = blobUrl;
}

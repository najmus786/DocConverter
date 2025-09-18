// ======= MAIN SCRIPT (combined, copy-paste ready) =======
// Tab switcher
function switchTab(btn, tabId) {
  document.querySelectorAll('.tab-content').forEach(d => d.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
  document.querySelectorAll('.tab-buttons button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Shared state for image previews
let selectedImages = []; // {id, file, imgEl, cropper, container, downloadEl}
let uniqueId = 0;

// Utility: create preview card
function createPreviewCard(dataUrl, file, targetContainer, allowActions = true) {
  const id = uniqueId++;
  const div = document.createElement('div');
  div.className = 'preview-card';
  div.draggable = true;
  div.dataset.id = id;

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = file.name || ('image-' + id);

  // Buttons: remove, crop, download (download appears after resize), apply
  const removeBtn = document.createElement('button'); removeBtn.innerText = '✖'; removeBtn.className='btn-right';
  removeBtn.onclick = () => { removePreview(id); };

  const cropBtn = document.createElement('button'); cropBtn.innerText = 'Crop'; cropBtn.className='btn-right2';
  cropBtn.onclick = () => startCrop(id);

  const resizeBtn = document.createElement('button'); resizeBtn.innerText = 'Resize'; resizeBtn.className='btn-right3';
  resizeBtn.onclick = () => resizeSingle(id);

  const downloadBtn = document.createElement('a');
  downloadBtn.innerText = 'Download';
  downloadBtn.style.display='none';
  downloadBtn.className='btn-left download-btn';
  downloadBtn.download = file.name || ('resized-' + id + '.jpg');

  div.appendChild(img);
  if(allowActions){ div.appendChild(removeBtn); div.appendChild(cropBtn); div.appendChild(resizeBtn); div.appendChild(downloadBtn); }

  // small controls area for quality/size info
  const controls = document.createElement('div'); controls.className='controls';
  const info = document.createElement('span'); info.className='small'; info.innerText = file.name || '';
  controls.appendChild(info);
  div.appendChild(controls);

  targetContainer.appendChild(div);

  const obj = { id, file, imgEl: img, cropper: null, container: div, downloadEl: downloadBtn };
  selectedImages.push(obj);

  // drag handlers
  div.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', id); div.classList.add('dragging'); });
  div.addEventListener('dragend', () => div.classList.remove('dragging'));

  return obj;
}

function removePreview(id){
  const idx = selectedImages.findIndex(s=>s.id==id);
  if(idx>-1){
    const obj=selectedImages[idx];
    if(obj.cropper){ obj.cropper.destroy(); }
    if(obj.downloadEl && obj.downloadEl.href) URL.revokeObjectURL(obj.downloadEl.href);
    obj.container.remove();
    selectedImages.splice(idx,1);
  }
}

// Drag & drop & file input wiring for both JPEG->PDF and Resize tabs
function wireFileInputs(inputId, dropZoneId, previewContainerId){
  const input = document.getElementById(inputId);
  const dropZone = document.getElementById(dropZoneId);
  const previewContainer = document.getElementById(previewContainerId);

  input.addEventListener('change', function(){
    handleFiles(this.files, previewContainer); this.value='';
  });

  dropZone.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()=> dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e=>{
    e.preventDefault(); dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files, previewContainer);
  });

  // reorder in the preview container
  previewContainer.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    if(!dragging) return;
    const afterElement = [...previewContainer.querySelectorAll('.preview-card:not(.dragging)')].find(el => {
      const box = el.getBoundingClientRect();
      return e.clientY < box.top + box.height/2;
    });
    if(afterElement) previewContainer.insertBefore(dragging, afterElement);
    else previewContainer.appendChild(dragging);
  });
}

// handle files -> create previews
function handleFiles(files, previewContainer){
  Array.from(files).forEach(file => {
    if(!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => createPreviewCard(ev.target.result, file, previewContainer);
    reader.readAsDataURL(file);
  });
}

// Wire inputs
wireFileInputs('jpegToPdfInput','jpegToPdfDropZone','jpegToPdfCropPreview');
wireFileInputs('jpegResizeInput','jpegResizeDropZone','jpegResizeCropPreview');

// Crop actions
function startCrop(id){
  // destroy other croppers
  selectedImages.forEach(o=>{ if(o.cropper){ o.cropper.destroy(); o.cropper=null; } });
  const obj = selectedImages.find(s=>s.id==id); if(!obj) return;
  obj.cropper = new Cropper(obj.imgEl, { viewMode:1, autoCropArea:0.85, movable:true, zoomable:true });
  // add apply button if not present
  if(!obj.container.querySelector('.apply-btn')){
    const btn = document.createElement('button'); btn.innerText='Apply'; btn.className='btn-right'; btn.style.right='160px';
    btn.onclick = ()=> applyCrop(obj.id); obj.container.appendChild(btn);
  }
}

function applyCrop(id){
  const obj = selectedImages.find(s=>s.id==id); if(!obj || !obj.cropper) return;
  const canvas = obj.cropper.getCroppedCanvas();
  obj.imgEl.src = canvas.toDataURL('image/jpeg');
  obj.cropper.destroy(); obj.cropper = null;
  const btn = obj.container.querySelector('.apply-btn'); if(btn) btn.remove();
}

// Resize single image to targetKB by reducing JPEG quality
async function resizeSingle(id){
  const obj = selectedImages.find(s=>s.id==id); if(!obj) return alert('Image not found');
  const targetKB = parseInt(document.getElementById('jpegResizeTargetKB').value) || null;
  const resultDataUrl = await compressImageToTarget(obj.imgEl, targetKB);
  if(!resultDataUrl) return alert('Could not compress to target size — try a higher KB.');
  obj.imgEl.src = resultDataUrl; // show compressed preview
  // prepare download link
  const blob = dataURLToBlob(resultDataUrl);
  if(obj.downloadEl.href) URL.revokeObjectURL(obj.downloadEl.href); // revoke old Blob if exists
  obj.downloadEl.href = URL.createObjectURL(blob);
  obj.downloadEl.style.display='inline-block';
}

// Resize all previews (applies target to each image)
async function resizeAllPreviews(){
  const targetKB = parseInt(document.getElementById('jpegResizeTargetKB').value) || null;
  for(const obj of selectedImages){
    const result = await compressImageToTarget(obj.imgEl, targetKB);
    if(result){
      obj.imgEl.src = result;
      const blob = dataURLToBlob(result);
      if(obj.downloadEl.href) URL.revokeObjectURL(obj.downloadEl.href); // revoke old Blob
      obj.downloadEl.href = URL.createObjectURL(blob);
      obj.downloadEl.style.display='inline-block';
    }
  }
}

// Compress helper: attempt qualities from 0.95 downwards
async function compressImageToTarget(imgEl, targetKB){
  const canvas = document.createElement('canvas');
  const MAX_W = imgEl.naturalWidth;
  const MAX_H = imgEl.naturalHeight;
  canvas.width = MAX_W; canvas.height = MAX_H; const ctx = canvas.getContext('2d'); ctx.drawImage(imgEl,0,0);
  let quality = 0.95; let dataUrl = null;
  while(quality > 0.05){
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    const sizeKB = dataUrl.length * (3/4) / 1024; // approximate
    if(!targetKB || sizeKB <= targetKB) return dataUrl;
    quality -= 0.05;
  }
  // final attempt: if still too big return null
  return null;
}

function dataURLToBlob(dataurl){
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while(n--) u8[n]=bstr.charCodeAt(n);
  return new Blob([u8],{type:mime});
}

// ===== JPEG -> PDF with target KB option =====
async function convertJpegToPdf(){
  const imgs = Array.from(document.getElementById('jpegToPdfCropPreview').querySelectorAll('.preview-card img'));
  if(imgs.length===0) return alert('Select images!');
  const targetKB = parseInt(document.getElementById('jpegToPdfTargetKB').value) || null;

  // Progressive attempt: start with quality 0.95 and reduce if pdf too big
  let quality = 0.95; let pdfBlob = null; let attempts = 0;
  while(attempts++ < 16){
    const pdfBytes = await buildPdfFromImages(imgs, quality);
    pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const sizeKB = pdfBlob.size/1024;
    if(!targetKB || sizeKB <= targetKB) break; // good
    quality -= 0.05; if(quality < 0.05) break;
  }

  const blobUrl = URL.createObjectURL(pdfBlob);
  document.getElementById('jpegToPdfPreview').src = blobUrl;
  document.getElementById('jpegToPdfDownload').href = blobUrl;
}

async function buildPdfFromImages(imgEls, quality){
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  for(const imgEl of imgEls){
    // convert image (possibly resized) to JPEG blob at given quality
    const canvas = document.createElement('canvas'); canvas.width = imgEl.naturalWidth; canvas.height = imgEl.naturalHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(imgEl,0,0);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const byteString = atob(dataUrl.split(',')[1]); const buffer = new Uint8Array(byteString.length);
    for(let i=0;i<byteString.length;i++) buffer[i]=byteString.charCodeAt(i);
    const img = await pdfDoc.embedJpg(buffer);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img,{x:0,y:0,width:img.width,height:img.height});
  }
  return await pdfDoc.save();
}

// ===== PDF -> JPEG (single page preview) =====
async function convertPdfToJpeg(){
  const file = document.getElementById('pdfToJpegInput').files[0]; if(!file) return alert('Select a PDF file.');
  const pdfData = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height; const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const preview = document.getElementById('pdfToJpegPreview'); preview.innerHTML = `<img src="${jpegDataUrl}" class="preview-img">`;
  const dl = document.getElementById('pdfToJpegDownload');
  dl.href = jpegDataUrl; dl.style.display='inline-block';
}

// ===== Resize PDF (basic re-save; better approaches require server-side) =====
async function resizePDF() {
  const file = document.getElementById('pdfResizeInput').files[0];
  if (!file) return;

  const targetKB = parseInt(document.getElementById('pdfResizeTargetKB').value) || 50;
  const arrayBuffer = await file.arrayBuffer();
  const pdfOriginal = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  async function buildPDF(scaleFactor = 0.8, quality = 0.85) {
    const pdfNew = await PDFLib.PDFDocument.create();

    for (let i = 1; i <= pdfOriginal.numPages; i++) {
      const page = await pdfOriginal.getPage(i);

      // scale the viewport instead of context
      const viewport = page.getViewport({ scale: scaleFactor });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
      const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());
      const img = await pdfNew.embedJpg(imgBytes);

      const pageNew = pdfNew.addPage([viewport.width, viewport.height]);
      pageNew.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }

    return pdfNew.save();
  }

  let scale = 0.8;
  let jpegQuality = 0.85;
  let pdfBytes = await buildPDF(scale, jpegQuality);

  // Reduce scale if still bigger than target
  while ((pdfBytes.byteLength / 1024) > targetKB && scale > 0.3) {
    scale -= 0.05;
    pdfBytes = await buildPDF(scale, jpegQuality);
  }

  const blobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
  document.getElementById('pdfResizePreview').src = blobUrl;
  document.getElementById('pdfResizeDownload').href = blobUrl;
}


// ===== Initialization message (keeps UI intact) =====
console.log('DocConverter script loaded');

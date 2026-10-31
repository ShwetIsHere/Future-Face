/**
 * Future-Face Web Application Client Logic
 * Theme matching Shwet Patel's Portfolio (heyshwet.me)
 * Features:
 * - Dark & Light Theme toggle with localStorage persistence
 * - Mobile-first responsive WebRTC Camera with Front/Rear flip support
 * - Dynamic target age bounding strictly between 8 and 90 years
 * - Responsive Before & After split slider with pointer/touch support
 * - In-Memory processing (Zero disk saving)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Target age boundary constants
  const MIN_TARGET_AGE = 8;
  const MAX_TARGET_AGE = 90;

  // Global State
  let currentSessionId = null;
  let currentEstimatedAge = null;
  let currentShift = 10;
  let webcamStream = null;
  let currentFacingMode = 'user'; // 'user' (front) or 'environment' (rear)
  let selectedFile = null;

  // Safe DOM Helper Functions (Guarantees zero null pointer exceptions)
  function safeSetText(elOrId, text) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.textContent = text;
  }

  function safeSetHTML(elOrId, html) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.innerHTML = html;
  }

  // ============================================================
  // THEME MANAGEMENT (Dark & Light matching heyshwet.me)
  // ============================================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('futureface-theme') || 'dark';

  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('futureface-theme', isDark ? 'dark' : 'light');
    });
  }

  // DOM Elements - Navigation & Header
  const statusDevice = document.getElementById('statusDevice');
  const errorToast = document.getElementById('errorToast');
  const toastMessage = document.getElementById('toastMessage');
  const toastClose = document.getElementById('toastClose');

  // DOM Elements - Step Cards
  const stepInput = document.getElementById('stepInput');
  const stepAgeEstimate = document.getElementById('stepAgeEstimate');
  const stepResult = document.getElementById('stepResult');
  const progressOverlay = document.getElementById('progressOverlay');

  // DOM Elements - Step 1: Input
  const tabCameraBtn = document.getElementById('tabCameraBtn');
  const tabUploadBtn = document.getElementById('tabUploadBtn');
  const tabCamera = document.getElementById('tabCamera');
  const tabUpload = document.getElementById('tabUpload');

  // Camera Elements
  const cameraViewport = document.getElementById('cameraViewport');
  const webcamVideo = document.getElementById('webcamVideo');
  const snapshotCanvas = document.getElementById('snapshotCanvas');
  const cameraSnapshotPreview = document.getElementById('cameraSnapshotPreview');
  const cameraActiveControls = document.getElementById('cameraActiveControls');
  const snapshotActions = document.getElementById('snapshotActions');
  const btnStartCamera = document.getElementById('btnStartCamera');
  const btnCapturePhoto = document.getElementById('btnCapturePhoto');
  const btnStopCamera = document.getElementById('btnStopCamera');
  const btnRetakePhoto = document.getElementById('btnRetakePhoto');
  const btnConfirmSnapshot = document.getElementById('btnConfirmSnapshot');
  const btnFlipCamera = document.getElementById('btnFlipCamera');

  // Upload Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const dropzoneContent = document.getElementById('dropzoneContent');
  const dropzonePreview = document.getElementById('dropzonePreview');
  const uploadPreviewImg = document.getElementById('uploadPreviewImg');
  const btnChangeUpload = document.getElementById('btnChangeUpload');
  const uploadActionContainer = document.getElementById('uploadActionContainer');
  const btnProcessUpload = document.getElementById('btnProcessUpload');
  const samplesGrid = document.getElementById('samplesGrid');

  // DOM Elements - Step 2: Estimate & Shift
  const croppedFaceImg = document.getElementById('croppedFaceImg');
  const displayEstimatedAge = document.getElementById('displayEstimatedAge');
  const yearsSlider = document.getElementById('yearsSlider');
  const yearsNumberInput = document.getElementById('yearsNumberInput');
  const sliderTickMin = document.getElementById('sliderTickMin');
  const sliderTickCenter = document.getElementById('sliderTickCenter');
  const sliderTickMax = document.getElementById('sliderTickMax');
  const presetChipsContainer = document.getElementById('presetChipsContainer');
  const bannerDirectionIcon = document.getElementById('bannerDirectionIcon');
  const bannerSummaryText = document.getElementById('bannerSummaryText');
  const bannerEstAge = document.getElementById('bannerEstAge');
  const bannerShift = document.getElementById('bannerShift');
  const bannerTargetAge = document.getElementById('bannerTargetAge');
  const btnBackToInput = document.getElementById('btnBackToInput');
  const btnExecuteTransform = document.getElementById('btnExecuteTransform');

  // DOM Elements - Step 3: Results
  const btnViewSplit = document.getElementById('btnViewSplit');
  const btnViewSide = document.getElementById('btnViewSide');
  const viewSplitPanel = document.getElementById('viewSplitPanel');
  const viewSidePanel = document.getElementById('viewSidePanel');
  const splitSliderContainer = document.getElementById('splitSliderContainer');
  const imgSplitTransformed = document.getElementById('imgSplitTransformed');
  const imgSplitOriginal = document.getElementById('imgSplitOriginal');
  const imgComparisonPoster = document.getElementById('imgComparisonPoster');
  const sliderBadgeOrig = document.getElementById('sliderBadgeOrig');
  const sliderBadgeTrans = document.getElementById('sliderBadgeTrans');
  const statOrigAge = document.getElementById('statOrigAge');
  const statShift = document.getElementById('statShift');
  const statTargetAge = document.getElementById('statTargetAge');
  const btnTryAnotherAge = document.getElementById('btnTryAnotherAge');
  const btnRestartAll = document.getElementById('btnRestartAll');
  const btnDownloadPoster = document.getElementById('btnDownloadPoster');

  // ============================================================
  // SYSTEM HEALTH CHECK
  // ============================================================
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.gpu && data.gpu !== 'None') {
          safeSetText(statusDevice, `${data.gpu} Ready`);
        } else {
          safeSetText(statusDevice, `CPU Mode Ready`);
        }
      }
    } catch {
      safeSetText(statusDevice, 'System Online');
    }
  }
  checkHealth();

  // ============================================================
  // ERROR TOAST UTILITY
  // ============================================================
  function showError(msg) {
    safeSetText(toastMessage, msg);
    if (errorToast) {
      errorToast.classList.remove('hidden');
      setTimeout(() => {
        errorToast.classList.add('hidden');
      }, 6500);
    }
  }

  if (toastClose) {
    toastClose.addEventListener('click', () => {
      if (errorToast) errorToast.classList.add('hidden');
    });
  }

  // ============================================================
  // STEP NAVIGATION HELPERS
  // ============================================================
  function showStep(stepId) {
    [stepInput, stepAgeEstimate, stepResult].forEach(step => {
      if (step) {
        step.classList.remove('active');
        step.classList.add('hidden');
      }
    });

    const target = document.getElementById(stepId);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
      window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
    }
  }

  // ============================================================
  // TAB CONTROLS (Camera vs Upload)
  // ============================================================
  if (tabCameraBtn && tabUploadBtn) {
    tabCameraBtn.addEventListener('click', () => {
      tabCameraBtn.classList.add('active');
      tabUploadBtn.classList.remove('active');
      if (tabCamera) tabCamera.classList.add('active');
      if (tabUpload) tabUpload.classList.remove('active');
    });

    tabUploadBtn.addEventListener('click', () => {
      tabUploadBtn.classList.add('active');
      tabCameraBtn.classList.remove('active');
      if (tabUpload) tabUpload.classList.add('active');
      if (tabCamera) tabCamera.classList.remove('active');
      stopWebcam();
    });
  }

  // ============================================================
  // CAMERA STRICT STATE CONTROLLER
  // ============================================================
  function setCameraState(state) {
    // state: 'off' | 'streaming' | 'captured'
    if (!cameraViewport) return;

    cameraViewport.classList.remove('state-off', 'state-streaming', 'state-captured');
    cameraViewport.classList.add(`state-${state}`);

    if (state === 'off') {
      if (cameraActiveControls) cameraActiveControls.classList.add('hidden');
      if (snapshotActions) snapshotActions.classList.add('hidden');
    } else if (state === 'streaming') {
      if (cameraActiveControls) cameraActiveControls.classList.remove('hidden');
      if (snapshotActions) snapshotActions.classList.add('hidden');
    } else if (state === 'captured') {
      if (cameraActiveControls) cameraActiveControls.classList.add('hidden');
      if (snapshotActions) snapshotActions.classList.remove('hidden');
    }
  }

  // Initialize camera state as OFF
  setCameraState('off');

  // Detect multiple cameras for mobile flip support
  async function checkCameraDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      if (videoDevices.length > 1 && btnFlipCamera) {
        btnFlipCamera.classList.remove('hidden');
      }
    } catch (_) {}
  }
  checkCameraDevices();

  // ============================================================
  // WEBRTC LIVE CAMERA IMPLEMENTATION
  // ============================================================
  async function startWebcam() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser. Please use the Upload tab.');
      }

      // Stop any existing stream first
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (e1) {
        // Fallback to basic constraint if resolution query fails
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: false
          });
        } catch (e2) {
          // Final fallback to any video
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      webcamStream = stream;
      if (webcamVideo) {
        webcamVideo.srcObject = webcamStream;
        webcamVideo.setAttribute('playsinline', '');
        webcamVideo.setAttribute('autoplay', '');
        webcamVideo.muted = true;
        await webcamVideo.play();
      }

      setCameraState('streaming');
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraState('off');
      showError('Could not access camera. Please allow camera permissions in your browser or switch to the Upload tab.');
    }
  }

  function stopWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    if (webcamVideo) webcamVideo.srcObject = null;
    setCameraState('off');
  }

  function captureSnapshot() {
    if (!webcamVideo || !webcamVideo.videoWidth || !snapshotCanvas) return;

    snapshotCanvas.width = webcamVideo.videoWidth;
    snapshotCanvas.height = webcamVideo.videoHeight;
    const ctx = snapshotCanvas.getContext('2d');

    // If using user (selfie) camera, mirror horizontally
    if (currentFacingMode === 'user') {
      ctx.translate(snapshotCanvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(webcamVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);

    const snapshotDataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.95);
    if (cameraSnapshotPreview) {
      cameraSnapshotPreview.src = snapshotDataUrl;
    }

    setCameraState('captured');
  }

  function retakeSnapshot() {
    setCameraState('streaming');
  }

  if (btnStartCamera) btnStartCamera.addEventListener('click', startWebcam);
  if (btnCapturePhoto) btnCapturePhoto.addEventListener('click', captureSnapshot);
  if (btnStopCamera) btnStopCamera.addEventListener('click', stopWebcam);
  if (btnRetakePhoto) btnRetakePhoto.addEventListener('click', retakeSnapshot);

  // Mobile camera flip button
  if (btnFlipCamera) {
    btnFlipCamera.addEventListener('click', async () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      if (webcamVideo) {
        webcamVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
      }
      await startWebcam();
    });
  }

  if (btnConfirmSnapshot) {
    btnConfirmSnapshot.addEventListener('click', async () => {
      if (!cameraSnapshotPreview) return;
      const dataUrl = cameraSnapshotPreview.src;
      if (!dataUrl) return;

      if (progressOverlay) progressOverlay.classList.remove('hidden');
      try {
        const response = await fetch('/api/estimate-age', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to detect face or estimate age.');
        }

        handleAgeEstimated(result);
      } catch (err) {
        showError(err.message);
      } finally {
        if (progressOverlay) progressOverlay.classList.add('hidden');
      }
    });
  }

  // ============================================================
  // IMAGE UPLOAD IMPLEMENTATION
  // ============================================================
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnChangeUpload) {
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(event => {
      dropzone.addEventListener(event, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(event => {
      dropzone.addEventListener(event, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleSelectedFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleSelectedFile(e.target.files[0]);
      }
    });
  }

  if (btnChangeUpload) {
    btnChangeUpload.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFile = null;
      if (fileInput) fileInput.value = '';
      if (dropzonePreview) dropzonePreview.classList.add('hidden');
      if (dropzoneContent) dropzoneContent.classList.remove('hidden');
      if (uploadActionContainer) uploadActionContainer.classList.add('hidden');
    });
  }

  function handleSelectedFile(file) {
    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (uploadPreviewImg) uploadPreviewImg.src = e.target.result;
      if (dropzoneContent) dropzoneContent.classList.add('hidden');
      if (dropzonePreview) dropzonePreview.classList.remove('hidden');
      if (uploadActionContainer) uploadActionContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  if (btnProcessUpload) {
    btnProcessUpload.addEventListener('click', async () => {
      if (!selectedFile) return;

      const formData = new FormData();
      formData.append('image', selectedFile);

      if (progressOverlay) progressOverlay.classList.remove('hidden');
      try {
        const response = await fetch('/api/estimate-age', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to detect face or estimate age.');
        }

        handleAgeEstimated(result);
      } catch (err) {
        showError(err.message);
      } finally {
        if (progressOverlay) progressOverlay.classList.add('hidden');
      }
    });
  }

  // Sample portraits loader
  async function loadSamples() {
    if (!samplesGrid) return;
    try {
      const res = await fetch('/api/sample-images');
      if (res.ok) {
        const samples = await res.json();
        samplesGrid.innerHTML = '';
        samples.forEach(sample => {
          const chip = document.createElement('div');
          chip.className = 'sample-chip';
          chip.title = `Test with ${sample.name}`;
          chip.innerHTML = `<img src="${sample.url}" alt="${sample.name}">`;
          chip.addEventListener('click', async () => {
            if (progressOverlay) progressOverlay.classList.remove('hidden');
            try {
              const imgRes = await fetch(sample.url);
              const blob = await imgRes.blob();
              selectedFile = new File([blob], sample.name, { type: blob.type });

              const formData = new FormData();
              formData.append('image', selectedFile);

              const response = await fetch('/api/estimate-age', {
                method: 'POST',
                body: formData
              });
              const result = await response.json();
              if (!result.success) {
                throw new Error(result.error);
              }
              handleAgeEstimated(result);
            } catch (err) {
              showError(err.message);
            } finally {
              if (progressOverlay) progressOverlay.classList.add('hidden');
            }
          });
          samplesGrid.appendChild(chip);
        });
      }
    } catch (err) {
      console.warn('Samples loading skipped:', err);
    }
  }
  loadSamples();

  // ============================================================
  // STEP 2: DYNAMIC AGE RANGE BOUNDING (8 to 90 years)
  // ============================================================
  function handleAgeEstimated(data) {
    currentSessionId = data.session_id;
    currentEstimatedAge = parseFloat(data.estimated_age);

    if (croppedFaceImg) croppedFaceImg.src = data.cropped_url;
    safeSetText(displayEstimatedAge, currentEstimatedAge.toFixed(1));

    const estRounded = Math.round(currentEstimatedAge);
    const minShift = MIN_TARGET_AGE - estRounded;
    const maxShift = MAX_TARGET_AGE - estRounded;

    // Set slider & number input bounds to guarantee transformed age stays strictly between 8 and 90
    if (yearsSlider) {
      yearsSlider.min = minShift;
      yearsSlider.max = maxShift;
    }
    if (yearsNumberInput) {
      yearsNumberInput.min = minShift;
      yearsNumberInput.max = maxShift;
    }

    // Sensible default shift within bounds
    if (estRounded < 70) {
      currentShift = Math.max(minShift, Math.min(maxShift, 10));
    } else {
      currentShift = Math.max(minShift, Math.min(maxShift, -10));
    }

    if (yearsSlider) yearsSlider.value = currentShift;
    if (yearsNumberInput) yearsNumberInput.value = currentShift;

    // Dynamic slider tick labels
    safeSetText(sliderTickMin, `${minShift > 0 ? '+' : ''}${minShift} (${MIN_TARGET_AGE} yrs)`);
    safeSetText(sliderTickCenter, `0 (${estRounded} yrs)`);
    safeSetText(sliderTickMax, `+${maxShift} (${MAX_TARGET_AGE} yrs)`);

    // Dynamically generate preset buttons that fit within [minShift, maxShift]
    updatePresetChips(estRounded, minShift, maxShift);

    updateTargetAgeBanner();
    showStep('stepAgeEstimate');
  }

  function updatePresetChips(estRounded, minShift, maxShift) {
    if (!presetChipsContainer) return;
    presetChipsContainer.innerHTML = '';
    const presets = [
      { label: `Min (${MIN_TARGET_AGE} yrs)`, shift: minShift },
      { label: '-20 yrs (Past)', shift: -20 },
      { label: '-10 yrs (Past)', shift: -10 },
      { label: '+10 yrs (Future)', shift: 10 },
      { label: '+20 yrs (Future)', shift: 20 },
      { label: '+30 yrs (Future)', shift: 30 },
      { label: '+50 yrs (Future)', shift: 50 },
      { label: `Max (${MAX_TARGET_AGE} yrs)`, shift: maxShift }
    ];

    const seenShifts = new Set();
    presets.forEach(item => {
      if (item.shift >= minShift && item.shift <= maxShift && !seenShifts.has(item.shift)) {
        seenShifts.add(item.shift);
        const btn = document.createElement('button');
        btn.className = 'chip-btn' + (item.shift === currentShift ? ' active' : '');
        btn.textContent = item.label;
        btn.setAttribute('data-shift', item.shift);
        btn.addEventListener('click', () => {
          currentShift = item.shift;
          if (yearsSlider) yearsSlider.value = currentShift;
          if (yearsNumberInput) yearsNumberInput.value = currentShift;
          updateTargetAgeBanner();
        });
        presetChipsContainer.appendChild(btn);
      }
    });
  }

  function updateTargetAgeBanner() {
    if (currentEstimatedAge === null) return;

    const roundedEst = Math.round(currentEstimatedAge);
    const targetAge = Math.max(MIN_TARGET_AGE, Math.min(MAX_TARGET_AGE, roundedEst + currentShift));

    safeSetText(bannerEstAge, currentEstimatedAge.toFixed(1));
    safeSetText(bannerShift, (currentShift >= 0 ? `+${currentShift}` : `${currentShift}`) + ' yrs');
    safeSetText(bannerTargetAge, targetAge);

    if (bannerSummaryText) {
      if (currentShift > 0) {
        bannerSummaryText.innerHTML = `Transforming <span class="highlight-val">+${currentShift} years</span> into the future`;
      } else if (currentShift < 0) {
        bannerSummaryText.innerHTML = `Transforming <span class="highlight-val">${currentShift} years</span> into the past (younger)`;
      } else {
        bannerSummaryText.innerHTML = `No age transformation requested (<span class="highlight-val">Current Age</span>)`;
      }
    }

    if (bannerDirectionIcon) {
      if (currentShift > 0) {
        bannerDirectionIcon.className = 'banner-icon';
        bannerDirectionIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 4 15 12 5 20 5 4"></polygon>
            <line x1="19" y1="5" x2="19" y2="19"></line>
          </svg>
        `;
      } else if (currentShift < 0) {
        bannerDirectionIcon.className = 'banner-icon past';
        bannerDirectionIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="19 20 9 12 19 4 19 20"></polygon>
            <line x1="5" y1="19" x2="5" y2="5"></line>
          </svg>
        `;
      } else {
        bannerDirectionIcon.className = 'banner-icon';
        bannerDirectionIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="10" y1="15" x2="10" y2="9"></line>
            <line x1="14" y1="15" x2="14" y2="9"></line>
          </svg>
        `;
      }
    }

    if (presetChipsContainer) {
      const chipBtns = presetChipsContainer.querySelectorAll('.chip-btn');
      chipBtns.forEach(btn => {
        const shiftVal = parseInt(btn.getAttribute('data-shift'), 10);
        btn.classList.toggle('active', shiftVal === currentShift);
      });
    }
  }

  if (yearsSlider) {
    yearsSlider.addEventListener('input', (e) => {
      currentShift = parseInt(e.target.value, 10);
      if (yearsNumberInput) yearsNumberInput.value = currentShift;
      updateTargetAgeBanner();
    });
  }

  if (yearsNumberInput) {
    yearsNumberInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      const minVal = parseInt(yearsSlider ? yearsSlider.min : -80, 10);
      const maxVal = parseInt(yearsSlider ? yearsSlider.max : 80, 10);
      val = Math.max(minVal, Math.min(maxVal, val));
      currentShift = val;
      if (yearsSlider) yearsSlider.value = val;
      updateTargetAgeBanner();
    });
  }

  if (btnBackToInput) {
    btnBackToInput.addEventListener('click', () => {
      showStep('stepInput');
    });
  }

  // ============================================================
  // STEP 3: EXECUTE TRANSFORMATION & DISPLAY RESULTS
  // ============================================================
  if (btnExecuteTransform) {
    btnExecuteTransform.addEventListener('click', async () => {
      if (!currentSessionId) {
        showError('Session expired. Please select or capture a photo again.');
        showStep('stepInput');
        return;
      }

      if (progressOverlay) progressOverlay.classList.remove('hidden');

      try {
        const response = await fetch('/api/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: currentSessionId,
            years: currentShift
          })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Transformation process failed.');
        }

        displayResults(result);
      } catch (err) {
        showError(err.message);
      } finally {
        if (progressOverlay) progressOverlay.classList.add('hidden');
      }
    });
  }

  function displayResults(data) {
    if (imgSplitTransformed) imgSplitTransformed.src = data.transformed_url;
    if (imgSplitOriginal) imgSplitOriginal.src = data.cropped_url;

    safeSetText(sliderBadgeOrig, `Original (${data.estimated_age.toFixed(1)} yrs)`);
    safeSetText(sliderBadgeTrans, `Transformed (${data.target_age} yrs)`);

    if (imgComparisonPoster) imgComparisonPoster.src = data.comparison_url;
    if (btnDownloadPoster) btnDownloadPoster.href = data.comparison_url;

    safeSetText(statOrigAge, `${data.estimated_age.toFixed(1)} yrs`);
    safeSetText(statShift, (data.years >= 0 ? `+${data.years}` : `${data.years}`) + ' yrs');
    safeSetText(statTargetAge, `${data.target_age} yrs`);

    setSplitPosition(50);
    showStep('stepResult');
  }

  // ============================================================
  // INTERACTIVE CLIP-PATH BEFORE / AFTER SPLIT SLIDER
  // ============================================================
  let isDraggingSplit = false;

  function setSplitPosition(percentage) {
    const clamped = Math.max(0, Math.min(100, percentage));
    if (splitSliderContainer) {
      splitSliderContainer.style.setProperty('--split-pos', `${clamped}%`);
    }
  }

  function handleSplitMove(clientX) {
    if (!splitSliderContainer) return;
    const rect = splitSliderContainer.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = (offsetX / rect.width) * 100;
    setSplitPosition(percentage);
  }

  if (splitSliderContainer) {
    splitSliderContainer.addEventListener('pointerdown', (e) => {
      isDraggingSplit = true;
      try { splitSliderContainer.setPointerCapture(e.pointerId); } catch (_) {}
      handleSplitMove(e.clientX);
    });

    splitSliderContainer.addEventListener('pointermove', (e) => {
      if (!isDraggingSplit) return;
      handleSplitMove(e.clientX);
    });

    splitSliderContainer.addEventListener('pointerup', (e) => {
      isDraggingSplit = false;
      try { splitSliderContainer.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    splitSliderContainer.addEventListener('pointercancel', (e) => {
      isDraggingSplit = false;
      try { splitSliderContainer.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  }

  // View Mode Tabs (Slider vs Poster)
  if (btnViewSplit && btnViewSide) {
    btnViewSplit.addEventListener('click', () => {
      btnViewSplit.classList.add('active');
      btnViewSide.classList.remove('active');
      if (viewSplitPanel) viewSplitPanel.classList.add('active');
      if (viewSidePanel) viewSidePanel.classList.remove('active');
    });

    btnViewSide.addEventListener('click', () => {
      btnViewSide.classList.add('active');
      btnViewSplit.classList.remove('active');
      if (viewSidePanel) viewSidePanel.classList.add('active');
      if (viewSplitPanel) viewSplitPanel.classList.remove('active');
    });
  }

  // Post-Result Action Buttons
  if (btnTryAnotherAge) {
    btnTryAnotherAge.addEventListener('click', () => {
      showStep('stepAgeEstimate');
    });
  }

  if (btnRestartAll) {
    btnRestartAll.addEventListener('click', () => {
      currentSessionId = null;
      currentEstimatedAge = null;
      selectedFile = null;
      if (dropzonePreview) dropzonePreview.classList.add('hidden');
      if (dropzoneContent) dropzoneContent.classList.remove('hidden');
      if (uploadActionContainer) uploadActionContainer.classList.add('hidden');
      retakeSnapshot();
      showStep('stepInput');
    });
  }
});

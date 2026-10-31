/**
 * FutureFace — AI Powered Face Age Progression Client Logic
 * Multi-Page Application (Home, Try Now, About, Feedback)
 * Developed by Shwet Patel (heyshwet.me)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Target age boundary constraints
  const MIN_TARGET_AGE = 8;
  const MAX_TARGET_AGE = 90;

  // Safe DOM Helper Functions (Guarantees zero null pointer exceptions)
  function safeSetText(elOrId, text) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.textContent = text;
  }

  function safeSetHTML(elOrId, html) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el.innerHTML = html;
  }

  function showToast(message, isError = true) {
    const errorToast = document.getElementById('errorToast');
    const toastMessage = document.getElementById('toastMessage');
    if (errorToast && toastMessage) {
      toastMessage.textContent = message;
      errorToast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
      errorToast.classList.remove('hidden');
      setTimeout(() => {
        errorToast.classList.add('hidden');
      }, 5000);
    }
  }

  const toastClose = document.getElementById('toastClose');
  if (toastClose) {
    toastClose.addEventListener('click', () => {
      const errorToast = document.getElementById('errorToast');
      if (errorToast) errorToast.classList.add('hidden');
    });
  }

  // ============================================================
  // 1. THEME MANAGEMENT (Light & Dark Mode)
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

  // ============================================================
  // 2. MOBILE NAVIGATION MENU DRAWER
  // ============================================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      document.body.classList.toggle('mobile-menu-active', isOpen);
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        document.body.classList.remove('mobile-menu-active');
      });
    });

    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && e.target !== mobileMenuBtn) {
        navMenu.classList.remove('open');
        document.body.classList.remove('mobile-menu-active');
      }
    });
  }

  // ============================================================
  // 3. GPU HARDWARE HEALTH CHECK
  // ============================================================
  const statusDevice = document.getElementById('statusDevice');
  async function checkSystemHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (statusDevice) {
          if (data.gpu && data.gpu !== 'None') {
            statusDevice.textContent = data.gpu.replace('NVIDIA GeForce ', '') + ' (Ready)';
          } else {
            statusDevice.textContent = 'CPU Mode';
          }
        }
      }
    } catch (err) {
      if (statusDevice) statusDevice.textContent = 'Online';
    }
  }
  checkSystemHealth();

  // ============================================================
  // 4. SPLIT SLIDER INITIALIZER FUNCTION (Mouse & Touch)
  // ============================================================
  function initSplitSlider(container, beforeWrap, handle, defaultPct = 50) {
    if (!container || !beforeWrap || !handle) return;

    let isDragging = false;

    function updatePosition(clientX) {
      const rect = container.getBoundingClientRect();
      let x = clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const pct = (x / rect.width) * 100;
      beforeWrap.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
      handle.style.left = `${pct}%`;
    }

    beforeWrap.style.clipPath = `polygon(0 0, ${defaultPct}% 0, ${defaultPct}% 100%, 0 100%)`;
    handle.style.left = `${defaultPct}%`;

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      updatePosition(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        updatePosition(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length === 0) return;
      updatePosition(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  // Initialize Home Hero Split Slider if present
  const heroSplitSlider = document.getElementById('heroSplitSlider');
  const heroBeforeWrap = document.getElementById('heroBeforeWrap');
  const heroSplitHandle = document.getElementById('heroSplitHandle');
  if (heroSplitSlider && heroBeforeWrap && heroSplitHandle) {
    initSplitSlider(heroSplitSlider, heroBeforeWrap, heroSplitHandle, 50);
  }

  // ============================================================
  // 5. GALLERY CATEGORY FILTERING (Home Page)
  // ============================================================
  const filterBtns = document.querySelectorAll('.gallery-filters .filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-grid .gallery-item');

  if (filterBtns.length > 0 && galleryItems.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        galleryItems.forEach(item => {
          const cat = item.dataset.category;
          if (filter === 'all' || cat === filter || (filter === 'sequence' && (cat === 'male' || cat === 'female'))) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  // ============================================================
  // 6. STANDALONE FEEDBACK PAGE FORM
  // ============================================================
  const standaloneFeedbackForm = document.getElementById('standaloneFeedbackForm');
  const feedbackStarRating = document.getElementById('feedbackStarRating');
  const ratingLabelHint = document.getElementById('ratingLabelHint');
  const feedbackSuccessState = document.getElementById('feedbackSuccessState');
  let userFeedbackRating = 5;

  const ratingHints = {
    1: '1 star — Poor experience',
    2: '2 stars — Fair experience',
    3: '3 stars — Average experience',
    4: '4 stars — Good experience',
    5: '5 stars — Excellent experience!'
  };

  if (feedbackStarRating) {
    const stars = feedbackStarRating.querySelectorAll('.star');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        userFeedbackRating = parseInt(star.dataset.rating, 10);
        stars.forEach(s => {
          const r = parseInt(s.dataset.rating, 10);
          if (r <= userFeedbackRating) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
        if (ratingLabelHint) {
          ratingLabelHint.textContent = ratingHints[userFeedbackRating] || `${userFeedbackRating} stars`;
        }
      });
    });
  }

  if (standaloneFeedbackForm) {
    standaloneFeedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('feedbackName');
      const emailInput = document.getElementById('feedbackEmail');
      const messageInput = document.getElementById('feedbackMessage');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const feedback = messageInput ? messageInput.value.trim() : '';

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            email: email,
            rating: userFeedbackRating,
            feedback: feedback
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          standaloneFeedbackForm.classList.add('hidden');
          if (feedbackSuccessState) feedbackSuccessState.classList.remove('hidden');
          showToast('Thank you for your feedback!', false);
        } else {
          showToast(data.error || 'Failed to submit feedback.');
        }
      } catch (err) {
        standaloneFeedbackForm.classList.add('hidden');
        if (feedbackSuccessState) feedbackSuccessState.classList.remove('hidden');
        showToast('Feedback submitted. Thank you!', false);
      }
    });
  }

  // ============================================================
  // 7. TRY NOW TRANSFORMATION WORKSPACE LOGIC
  // ============================================================
  const tryNowRoot = document.getElementById('try-now');
  if (tryNowRoot) {
    let currentSessionId = null;
    let currentEstimatedAge = null;
    let targetAge = 50;
    let webcamStream = null;
    let selectedFile = null;
    let capturedDataUrl = null;

    // Step Progress Nodes
    function updateStepProgress(stepNum) {
      const stepNodes = [
        document.getElementById('stepNode1'),
        document.getElementById('stepNode2'),
        document.getElementById('stepNode3'),
        document.getElementById('stepNode4')
      ];
      const stepLines = [
        document.getElementById('stepLine1'),
        document.getElementById('stepLine2'),
        document.getElementById('stepLine3')
      ];

      stepNodes.forEach((node, idx) => {
        if (!node) return;
        if (idx + 1 <= stepNum) {
          node.classList.add('active');
        } else {
          node.classList.remove('active');
        }
      });

      stepLines.forEach((line, idx) => {
        if (!line) return;
        if (idx + 1 < stepNum) {
          line.classList.add('completed');
        } else {
          line.classList.remove('completed');
        }
      });
    }

    // Tabs: Upload vs Camera
    const tabUploadBtn = document.getElementById('tabUploadBtn');
    const tabCameraBtn = document.getElementById('tabCameraBtn');
    const tabUpload = document.getElementById('tabUpload');
    const tabCamera = document.getElementById('tabCamera');

    if (tabUploadBtn && tabCameraBtn && tabUpload && tabCamera) {
      tabUploadBtn.addEventListener('click', () => {
        tabUploadBtn.classList.add('active');
        tabCameraBtn.classList.remove('active');
        tabUpload.classList.add('active');
        tabCamera.classList.remove('active');
        stopWebcam();
      });

      tabCameraBtn.addEventListener('click', () => {
        tabCameraBtn.classList.add('active');
        tabUploadBtn.classList.remove('active');
        tabCamera.classList.add('active');
        tabUpload.classList.remove('active');
        startWebcam();
      });
    }

    // Dropzone logic
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const dropzonePreview = document.getElementById('dropzonePreview');
    const uploadPreviewImg = document.getElementById('uploadPreviewImg');
    const btnChangeUpload = document.getElementById('btnChangeUpload');

    function handleFileSelection(file) {
      if (!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPG, PNG, WEBP).');
        return;
      }
      selectedFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        if (uploadPreviewImg) uploadPreviewImg.src = dataUrl;
        if (dropzoneContent) dropzoneContent.classList.add('hidden');
        if (dropzonePreview) dropzonePreview.classList.remove('hidden');

        estimateAgeFromDataUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelection(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelection(e.target.files[0]);
        }
      });

      if (btnChangeUpload) {
        btnChangeUpload.addEventListener('click', (e) => {
          e.stopPropagation();
          fileInput.value = '';
          if (dropzoneContent) dropzoneContent.classList.remove('hidden');
          if (dropzonePreview) dropzonePreview.classList.add('hidden');
        });
      }
    }

    // Camera logic
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

    async function startWebcam() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera access is not supported by your browser or environment.');
        return;
      }
      try {
        if (webcamStream) stopWebcam();
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
        if (webcamVideo) {
          webcamVideo.srcObject = webcamStream;
          await webcamVideo.play();
        }
        if (cameraViewport) cameraViewport.className = 'camera-viewport state-streaming';
        if (cameraActiveControls) cameraActiveControls.classList.remove('hidden');
        if (snapshotActions) snapshotActions.classList.add('hidden');
      } catch (err) {
        console.error('Camera error:', err);
        showToast('Could not access camera. Please check permissions.');
        stopWebcam();
      }
    }

    function stopWebcam() {
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
      }
      if (webcamVideo) webcamVideo.srcObject = null;
      if (cameraViewport) cameraViewport.className = 'camera-viewport state-off';
      if (cameraActiveControls) cameraActiveControls.classList.add('hidden');
      if (snapshotActions) snapshotActions.classList.add('hidden');
    }

    if (btnStartCamera) btnStartCamera.addEventListener('click', startWebcam);
    if (btnStopCamera) btnStopCamera.addEventListener('click', stopWebcam);

    if (btnCapturePhoto && webcamVideo && snapshotCanvas) {
      btnCapturePhoto.addEventListener('click', () => {
        const w = webcamVideo.videoWidth || 640;
        const h = webcamVideo.videoHeight || 480;
        snapshotCanvas.width = w;
        snapshotCanvas.height = h;

        const ctx = snapshotCanvas.getContext('2d');
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(webcamVideo, 0, 0, w, h);

        capturedDataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.95);
        if (cameraSnapshotPreview) cameraSnapshotPreview.src = capturedDataUrl;

        if (cameraViewport) cameraViewport.className = 'camera-viewport state-captured';
        if (cameraActiveControls) cameraActiveControls.classList.add('hidden');
        if (snapshotActions) snapshotActions.classList.remove('hidden');
      });
    }

    if (btnRetakePhoto) {
      btnRetakePhoto.addEventListener('click', () => {
        capturedDataUrl = null;
        if (cameraViewport) cameraViewport.className = 'camera-viewport state-streaming';
        if (cameraActiveControls) cameraActiveControls.classList.remove('hidden');
        if (snapshotActions) snapshotActions.classList.add('hidden');
      });
    }

    if (btnConfirmSnapshot) {
      btnConfirmSnapshot.addEventListener('click', () => {
        if (capturedDataUrl) {
          estimateAgeFromDataUrl(capturedDataUrl);
        }
      });
    }

    // Demo samples picker strictly from demo folder
    const samplesGrid = document.getElementById('samplesGrid');
    const demoSamples = [
      { name: 'person1.jpg', label: 'Person 1', type: 'image/jpeg' },
      { name: 'person2.webp', label: 'Person 2', type: 'image/webp' },
      { name: 'person3.jpg', label: 'Person 3', type: 'image/jpeg' },
      { name: 'person4.webp', label: 'Person 4', type: 'image/webp' },
      { name: 'person5.png', label: 'Person 5', type: 'image/png' },
      { name: 'person6.png', label: 'Person 6', type: 'image/png' }
    ];

    if (samplesGrid) {
      samplesGrid.innerHTML = '';
      demoSamples.forEach(sample => {
        const img = document.createElement('img');
        img.src = `/demo/${sample.name}`;
        img.alt = sample.label;
        img.title = `Click to test demo portrait: ${sample.label}`;
        img.className = 'demo-sample-thumb';
        img.addEventListener('click', async () => {
          try {
            const res = await fetch(`/demo/${sample.name}`);
            const blob = await res.blob();
            const file = new File([blob], sample.name, { type: sample.type || blob.type || 'image/jpeg' });
            handleFileSelection(file);
          } catch (err) {
            showToast(`Could not load ${sample.name}`);
          }
        });
        samplesGrid.appendChild(img);
      });
    }

    // Estimate Age API Call
    const progressOverlay = document.getElementById('progressOverlay');
    const progressTitle = document.getElementById('progressTitle');
    const progressSubtitle = document.getElementById('progressSubtitle');
    const croppedFaceImg = document.getElementById('croppedFaceImg');
    const thumbPlaceholder = document.getElementById('thumbPlaceholder');
    const displayEstimatedAge = document.getElementById('displayEstimatedAge');

    async function estimateAgeFromDataUrl(dataUrl) {
      if (progressOverlay) {
        if (progressTitle) progressTitle.textContent = 'Detecting Face & Estimating Age...';
        if (progressSubtitle) progressSubtitle.textContent = 'YuNet Face Detection & ResNet-50 Age Regression running in-memory.';
        progressOverlay.classList.remove('hidden');
      }

      try {
        const res = await fetch('/api/estimate-age', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: dataUrl })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to detect face or estimate age.');
        }

        currentSessionId = data.session_id;
        currentEstimatedAge = parseFloat(data.estimated_age);

        safeSetText(displayEstimatedAge, Math.round(currentEstimatedAge));
        const currentAgeHint = document.getElementById('currentAgeHint');
        safeSetText(currentAgeHint, '(AI Estimated via ResNet-50)');

        if (yearsSlider) {
          yearsSlider.removeAttribute('disabled');
        }

        const faceDataUrl = data.cropped_image || data.cropped_url;
        if (croppedFaceImg && faceDataUrl) {
          croppedFaceImg.src = faceDataUrl;
          croppedFaceImg.classList.remove('hidden');
        }
        if (thumbPlaceholder) thumbPlaceholder.classList.add('hidden');

        setupTargetAgeControls(currentEstimatedAge);
        updateStepProgress(2);

      } catch (err) {
        console.error(err);
        showToast(err.message || 'Error estimating age. Please choose another photo.');
      } finally {
        if (progressOverlay) progressOverlay.classList.add('hidden');
      }
    }

    // Target Age Slider strictly bounded to [8, 90]
    const yearsSlider = document.getElementById('yearsSlider');
    const targetAgeBadge = document.getElementById('targetAgeBadge');
    const bannerSummaryText = document.getElementById('bannerSummaryText');
    const presetChipsContainer = document.getElementById('presetChipsContainer');
    const sliderTickMin = document.getElementById('sliderTickMin');
    const sliderTickCenter = document.getElementById('sliderTickCenter');
    const sliderTickMax = document.getElementById('sliderTickMax');

    function setupTargetAgeControls(estAge) {
      const roundedEst = Math.round(estAge);

      if (yearsSlider) {
        yearsSlider.min = MIN_TARGET_AGE;
        yearsSlider.max = MAX_TARGET_AGE;

        if (roundedEst <= 40) {
          targetAge = Math.min(MAX_TARGET_AGE, roundedEst + 30);
        } else {
          targetAge = Math.max(MIN_TARGET_AGE, roundedEst - 25);
        }
        yearsSlider.value = targetAge;
      }

      if (sliderTickMin) sliderTickMin.textContent = MIN_TARGET_AGE;
      if (sliderTickCenter) sliderTickCenter.textContent = Math.round((MIN_TARGET_AGE + MAX_TARGET_AGE) / 2);
      if (sliderTickMax) sliderTickMax.textContent = MAX_TARGET_AGE;

      renderPresetChips(roundedEst);
      updateTargetDisplays();
    }

    function renderPresetChips(roundedEst) {
      if (!presetChipsContainer) return;
      presetChipsContainer.innerHTML = '';

      const candidateShifts = [-30, -20, -10, 10, 20, 30, 40, 50];
      const validPresets = [];

      candidateShifts.forEach(shift => {
        const candTarget = roundedEst + shift;
        if (candTarget >= MIN_TARGET_AGE && candTarget <= MAX_TARGET_AGE) {
          validPresets.push({
            label: `${shift > 0 ? '+' : ''}${shift} yrs (${candTarget})`,
            target: candTarget
          });
        }
      });

      [15, 30, 50, 70, 85].forEach(absTarget => {
        if (Math.abs(absTarget - roundedEst) >= 5) {
          validPresets.push({
            label: `Age ${absTarget}`,
            target: absTarget
          });
        }
      });

      const seen = new Set();
      const finalPresets = [];
      for (const p of validPresets) {
        if (!seen.has(p.target) && finalPresets.length < 6) {
          seen.add(p.target);
          finalPresets.push(p);
        }
      }

      finalPresets.sort((a, b) => a.target - b.target);

      finalPresets.forEach(preset => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        if (preset.target === targetAge) chip.classList.add('active');
        chip.textContent = preset.label;
        chip.addEventListener('click', () => {
          targetAge = preset.target;
          if (yearsSlider) yearsSlider.value = targetAge;
          document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          updateTargetDisplays();
        });
        presetChipsContainer.appendChild(chip);
      });
    }

    function updateTargetDisplays() {
      if (currentEstimatedAge === null) {
        safeSetText(targetAgeBadge, '--');
        safeSetText(bannerSummaryText, 'Upload or capture a photo first to estimate age and choose transformation');
        return;
      }

      if (yearsSlider) {
        targetAge = parseInt(yearsSlider.value, 10);
      }
      targetAge = Math.max(MIN_TARGET_AGE, Math.min(MAX_TARGET_AGE, targetAge));

      safeSetText(targetAgeBadge, `${targetAge} years`);

      const shift = targetAge - Math.round(currentEstimatedAge);
      let summary = '';
      if (shift > 0) {
        summary = `Transforming approximately +${shift} years into the future (Target: ${targetAge} yrs)`;
      } else if (shift < 0) {
        summary = `Transforming approximately ${shift} years into the past (Target: ${targetAge} yrs)`;
      } else {
        summary = `Current estimated age (${targetAge} yrs) — minimal facial change`;
      }
      safeSetText(bannerSummaryText, summary);

      if (presetChipsContainer) {
        presetChipsContainer.querySelectorAll('.preset-chip').forEach(c => {
          if (c.textContent.includes(`Age ${targetAge}`) || c.textContent.includes(`(${targetAge})`)) {
            c.classList.add('active');
          } else {
            c.classList.remove('active');
          }
        });
      }
    }

    if (yearsSlider) {
      yearsSlider.addEventListener('input', updateTargetDisplays);
    }

    // Execution / Transformation Call
    const btnExecuteTransform = document.getElementById('btnExecuteTransform');
    const resultPresentationBox = document.getElementById('resultPresentationBox');
    const imgSplitTransformed = document.getElementById('imgSplitTransformed');
    const imgSplitOriginal = document.getElementById('imgSplitOriginal');
    const imgComparisonPoster = document.getElementById('imgComparisonPoster');
    const btnDownloadPoster = document.getElementById('btnDownloadPoster');
    const sliderBadgeOrig = document.getElementById('sliderBadgeOrig');
    const sliderBadgeTrans = document.getElementById('sliderBadgeTrans');
    const statOrigAge = document.getElementById('statOrigAge');
    const statShift = document.getElementById('statShift');
    const statTargetAge = document.getElementById('statTargetAge');

    const splitSliderContainer = document.getElementById('splitSliderContainer');
    const splitBeforeWrap = document.getElementById('splitBeforeWrap');
    const splitHandle = document.getElementById('splitHandle');
    if (splitSliderContainer && splitBeforeWrap && splitHandle) {
      initSplitSlider(splitSliderContainer, splitBeforeWrap, splitHandle, 50);
    }

    if (btnExecuteTransform) {
      btnExecuteTransform.addEventListener('click', async () => {
        if (!currentSessionId) {
          showToast('Please upload an image or take a photo first.');
          return;
        }

        const shift = targetAge - Math.round(currentEstimatedAge);

        updateStepProgress(3);

        if (progressOverlay) {
          if (progressTitle) progressTitle.textContent = `Synthesizing Age Progression (${shift >= 0 ? '+' : ''}${shift} yrs)...`;
          if (progressSubtitle) progressSubtitle.textContent = 'SAM StyleGAN2 model is generating high-fidelity facial aging in GPU memory.';
          progressOverlay.classList.remove('hidden');
        }

        try {
          const res = await fetch('/api/transform', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: currentSessionId,
              shift: shift
            })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Transformation failed.');
          }

          const origAgeRounded = Math.round(data.estimated_age);
          const finalTargetAge = Math.round(data.target_age);
          const finalShift = Math.round(data.shift_years);

          const transImg = data.transformed_image || data.transformed_url;
          const origImg = data.original_image || data.cropped_image || data.cropped_url;
          const compImg = data.comparison_image || data.comparison_url;

          if (imgSplitTransformed && transImg) imgSplitTransformed.src = transImg;
          if (imgSplitOriginal && origImg) imgSplitOriginal.src = origImg;
          if (imgComparisonPoster && compImg) imgComparisonPoster.src = compImg;
          if (btnDownloadPoster && compImg) {
            btnDownloadPoster.href = compImg;
            btnDownloadPoster.download = `FutureFace_Comparison_Target_${finalTargetAge || targetAge}.jpg`;
          }
          const btnDownloadTransformed = document.getElementById('btnDownloadTransformed');
          if (btnDownloadTransformed && transImg) {
            btnDownloadTransformed.href = transImg;
            btnDownloadTransformed.download = `FutureFace_Transformed_Target_${finalTargetAge || targetAge}.jpg`;
          }

          safeSetText(sliderBadgeOrig, `Original (${origAgeRounded} yrs)`);
          safeSetText(sliderBadgeTrans, `Transformed (${finalTargetAge} yrs)`);

          safeSetText(statOrigAge, `${data.estimated_age.toFixed(1)} yrs`);
          safeSetText(statShift, `${finalShift >= 0 ? '+' : ''}${finalShift} yrs`);
          safeSetText(statTargetAge, `${finalTargetAge} yrs`);

          if (resultPresentationBox) {
            resultPresentationBox.classList.remove('hidden');
            resultPresentationBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          updateStepProgress(4);
          showToast('Transformation completed successfully!', false);

        } catch (err) {
          console.error(err);
          showToast(err.message || 'Error generating future face.');
          updateStepProgress(2);
        } finally {
          if (progressOverlay) progressOverlay.classList.add('hidden');
        }
      });
    }

    // Result view toggle
    const btnViewSplit = document.getElementById('btnViewSplit');
    const btnViewSide = document.getElementById('btnViewSide');
    const viewSplitPanel = document.getElementById('viewSplitPanel');
    const viewSidePanel = document.getElementById('viewSidePanel');

    if (btnViewSplit && btnViewSide && viewSplitPanel && viewSidePanel) {
      btnViewSplit.addEventListener('click', () => {
        btnViewSplit.classList.add('active');
        btnViewSide.classList.remove('active');
        viewSplitPanel.classList.add('active');
        viewSidePanel.classList.remove('active');
      });

      btnViewSide.addEventListener('click', () => {
        btnViewSide.classList.add('active');
        btnViewSplit.classList.remove('active');
        viewSidePanel.classList.add('active');
        viewSplitPanel.classList.remove('active');
      });
    }

    const btnTryAnotherAge = document.getElementById('btnTryAnotherAge');
    const btnRestartAll = document.getElementById('btnRestartAll');

    if (btnTryAnotherAge) {
      btnTryAnotherAge.addEventListener('click', () => {
        if (yearsSlider) {
          yearsSlider.scrollIntoView({ behavior: 'smooth', block: 'center' });
          yearsSlider.focus();
        }
      });
    }

    if (btnRestartAll) {
      btnRestartAll.addEventListener('click', () => {
        selectedFile = null;
        currentSessionId = null;
        if (dropzoneContent) dropzoneContent.classList.remove('hidden');
        if (dropzonePreview) dropzonePreview.classList.add('hidden');
        if (fileInput) fileInput.value = '';
        if (resultPresentationBox) resultPresentationBox.classList.add('hidden');
        if (croppedFaceImg) croppedFaceImg.classList.add('hidden');
        if (thumbPlaceholder) thumbPlaceholder.classList.remove('hidden');
        currentEstimatedAge = null;
        safeSetText(displayEstimatedAge, '--');
        const currentAgeHint = document.getElementById('currentAgeHint');
        safeSetText(currentAgeHint, '(Upload or capture photo to estimate)');
        safeSetText(targetAgeBadge, '--');
        safeSetText(bannerSummaryText, 'Upload or capture a photo first to estimate age and choose transformation');
        if (yearsSlider) {
          yearsSlider.setAttribute('disabled', 'disabled');
          yearsSlider.value = 50;
        }
        if (presetChipsContainer) {
          presetChipsContainer.innerHTML = '<span class="no-presets-hint">Upload or capture a photo to unlock age shift presets</span>';
        }
        stopWebcam();
        updateStepProgress(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }
});

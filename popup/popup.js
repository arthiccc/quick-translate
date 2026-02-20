(async function() {
  const statusEl = document.getElementById('status');
  const targetLangEl = document.getElementById('targetLang');
  const hoverEnabledEl = document.getElementById('hoverEnabled');
  const bilingualEl = document.getElementById('bilingual');
  const hoverDelayEl = document.getElementById('hoverDelay');
  
  await loadSettings();
  await checkAvailability();
  
  targetLangEl.addEventListener('change', saveSettings);
  hoverEnabledEl.addEventListener('change', saveSettings);
  bilingualEl.addEventListener('change', saveSettings);
  hoverDelayEl.addEventListener('change', saveSettings);
  
  async function loadSettings() {
    try {
      const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (settings) {
        targetLangEl.value = settings.targetLang || 'en';
        hoverEnabledEl.checked = settings.hoverEnabled !== false;
        bilingualEl.checked = settings.bilingual !== false;
        hoverDelayEl.value = settings.hoverDelay || 300;
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }
  
  async function saveSettings() {
    const settings = {
      targetLang: targetLangEl.value,
      hoverEnabled: hoverEnabledEl.checked,
      bilingual: bilingualEl.checked,
      hoverDelay: parseInt(hoverDelayEl.value, 10) || 300
    };
    
    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings
      });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }
  
  async function checkAvailability() {
    if (!('Translator' in self)) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Chrome AI not available. Enable: chrome://flags/#optimization-guide-on-device-model';
      return;
    }
    
    try {
      const availability = await self.Translator.availability({
        sourceLanguage: 'en',
        targetLanguage: targetLangEl.value
      });
      
      if (availability === 'readily') {
        statusEl.className = 'status success';
        statusEl.textContent = 'Chrome AI ready';
      } else if (availability === 'downloadable' || availability === 'downloading') {
        statusEl.className = 'status pending';
        statusEl.textContent = 'Downloading AI model...';
        
        setTimeout(checkAvailability, 2000);
      } else {
        statusEl.className = 'status error';
        statusEl.textContent = 'Chrome AI unavailable';
      }
    } catch (e) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Error: ' + e.message;
    }
  }
})();

(function() {
  'use strict';
  
  let settings = {
    targetLang: 'en',
    hoverEnabled: true,
    hoverDelay: 300,
    bilingual: true
  };
  
  let hoverTimeout = null;
  let currentOverlay = null;
  let pageTranslated = false;
  let originalNodes = [];
  
  const OVERLAY_ID = 'qt-translation-overlay';
  const HOVER_TOOLTIP_ID = 'qt-hover-tooltip';
  
  init();
  
  async function init() {
    await loadSettings();
    setupMessageListener();
    
    if (settings.hoverEnabled) {
      enableHoverTranslate();
    }
  }
  
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response) {
        settings = { ...settings, ...response };
      }
    } catch (e) {
      console.log('Could not load settings, using defaults');
    }
  }
  
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true;
    });
  }
  
  async function handleMessage(message) {
    switch (message.action) {
      case 'translateSelection':
        return await translateSelection(message.text, message.targetLang);
        
      case 'translatePage':
        return await translatePage(message.targetLang, message.bilingual);
        
      case 'toggleHover':
        settings.hoverEnabled = message.enabled;
        if (message.enabled) {
          enableHoverTranslate();
        } else {
          disableHoverTranslate();
        }
        return { success: true };
        
      case 'restorePage':
        return restorePage();
        
      case 'updateSettings':
        settings = { ...settings, ...message.settings };
        return { success: true };
        
      default:
        return { error: 'Unknown action' };
    }
  }
  
  async function translateSelection(text, targetLang) {
    showLoadingOverlay();
    
    try {
      const result = await window.TranslatorService.translate(text, targetLang);
      showTranslationOverlay(result.translated, result.sourceLang, targetLang);
      return { success: true, result };
    } catch (error) {
      showErrorOverlay(error.message);
      return { error: error.message };
    }
  }
  
  async function translatePage(targetLang, bilingual) {
    if (pageTranslated) {
      restorePage();
    }
    
    showPageLoadingIndicator();
    
    try {
      const textNodes = getTextNodes(document.body);
      originalNodes = textNodes.map(node => ({
        node,
        originalText: node.textContent
      }));
      
      const translatePromises = [];
      let translated = 0;
      
      for (const item of originalNodes) {
        if (item.originalText.trim().length < 2) {
          translated++;
          continue;
        }
        
        translatePromises.push(
          window.TranslatorService.translate(item.originalText, targetLang)
            .then(result => {
              translated++;
              updatePageProgress(translated, originalNodes.length);
              
              if (bilingual) {
                const wrapper = document.createElement('span');
                wrapper.className = 'qt-bilingual-wrapper';
                wrapper.innerHTML = `<span class="qt-original">${escapeHtml(item.originalText)}</span> <span class="qt-translated">${escapeHtml(result.translated)}</span>`;
                item.node.replaceWith(wrapper);
              } else {
                item.node.textContent = result.translated;
              }
            })
            .catch(e => {
              console.error('Translation error:', e);
              translated++;
            })
        );
        
        if (translatePromises.length >= 10) {
          await Promise.all(translatePromises);
          translatePromises.length = 0;
        }
      }
      
      await Promise.all(translatePromises);
      
      pageTranslated = true;
      hidePageLoadingIndicator();
      showRestoreButton();
      
      return { success: true };
    } catch (error) {
      hidePageLoadingIndicator();
      return { error: error.message };
    }
  }
  
  function getTextNodes(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'template', 'code', 'pre', 'textarea', 'input'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (parent.closest('.qt-overlay, .qt-tooltip, .qt-restore-btn')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const nodes = [];
    let node;
    while (node = walker.nextNode()) {
      nodes.push(node);
    }
    
    return nodes;
  }
  
  function restorePage() {
    const wrappers = document.querySelectorAll('.qt-bilingual-wrapper');
    wrappers.forEach(wrapper => {
      const original = wrapper.querySelector('.qt-original');
      if (original) {
        const textNode = document.createTextNode(original.textContent);
        wrapper.replaceWith(textNode);
      }
    });
    
    pageTranslated = false;
    hideRestoreButton();
    
    return { success: true };
  }
  
  function enableHoverTranslate() {
    document.addEventListener('mouseover', handleHoverStart);
    document.addEventListener('mouseout', handleHoverEnd);
  }
  
  function disableHoverTranslate() {
    document.removeEventListener('mouseover', handleHoverStart);
    document.removeEventListener('mouseout', handleHoverEnd);
    hideHoverTooltip();
  }
  
  function handleHoverStart(e) {
    if (!settings.hoverEnabled) return;
    
    const target = e.target;
    if (!isTranslatableElement(target)) return;
    
    hoverTimeout = setTimeout(async () => {
      const text = getHoverText(target);
      if (!text || text.trim().length < 2) return;
      
      try {
        const result = await window.TranslatorService.translate(text, settings.targetLang);
        showHoverTooltip(e.clientX, e.clientY, result.translated, result.sourceLang);
      } catch (error) {
        console.error('Hover translation error:', error);
      }
    }, settings.hoverDelay);
  }
  
  function handleHoverEnd() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    setTimeout(() => {
      const tooltip = document.getElementById(HOVER_TOOLTIP_ID);
      if (tooltip && !tooltip.matches(':hover')) {
        hideHoverTooltip();
      }
    }, 300);
  }
  
  function isTranslatableElement(el) {
    if (!el || !el.tagName) return false;
    
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'input', 'textarea', 'code'].includes(tag)) {
      return false;
    }
    
    if (el.closest('.qt-overlay, .qt-tooltip, .qt-restore-btn')) {
      return false;
    }
    
    return true;
  }
  
  function getHoverText(el) {
    if (el.tagName === 'P' || el.tagName === 'LI' || el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4' || el.tagName === 'H5' || el.tagName === 'H6' || el.tagName === 'SPAN' || el.tagName === 'DIV') {
      return el.innerText || el.textContent;
    }
    return null;
  }
  
  function showHoverTooltip(x, y, translated, sourceLang) {
    let tooltip = document.getElementById(HOVER_TOOLTIP_ID);
    
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = HOVER_TOOLTIP_ID;
      tooltip.className = 'qt-tooltip';
      document.body.appendChild(tooltip);
    }
    
    tooltip.innerHTML = `
      <div class="qt-tooltip-content">${escapeHtml(translated)}</div>
      <div class="qt-tooltip-lang">${sourceLang} → ${settings.targetLang}</div>
    `;
    
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = x + 10;
    let top = y + 10;
    
    if (left + rect.width > viewportWidth) {
      left = viewportWidth - rect.width - 10;
    }
    
    if (top + rect.height > viewportHeight) {
      top = y - rect.height - 10;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.display = 'block';
  }
  
  function hideHoverTooltip() {
    const tooltip = document.getElementById(HOVER_TOOLTIP_ID);
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
  
  function showLoadingOverlay() {
    hideOverlay();
    
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'qt-overlay qt-loading';
    overlay.innerHTML = `
      <div class="qt-overlay-content">
        <div class="qt-spinner"></div>
        <div>Translating...</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    currentOverlay = overlay;
  }
  
  function showTranslationOverlay(translated, sourceLang, targetLang) {
    hideOverlay();
    
    const selection = window.getSelection();
    let x = 100, y = 100;
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      x = rect.left + window.scrollX;
      y = rect.bottom + window.scrollY + 10;
    }
    
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'qt-overlay qt-result';
    overlay.innerHTML = `
      <div class="qt-overlay-header">
        <span class="qt-lang-badge">${sourceLang} → ${targetLang}</span>
        <button class="qt-close-btn" title="Close">×</button>
      </div>
      <div class="qt-overlay-body">${escapeHtml(translated)}</div>
      <div class="qt-overlay-footer">
        <button class="qt-copy-btn">Copy</button>
      </div>
    `;
    
    overlay.style.left = `${Math.min(x, window.innerWidth - 350)}px`;
    overlay.style.top = `${y}px`;
    
    overlay.querySelector('.qt-close-btn').addEventListener('click', () => hideOverlay());
    overlay.querySelector('.qt-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(translated);
      overlay.querySelector('.qt-copy-btn').textContent = 'Copied!';
      setTimeout(() => {
        overlay.querySelector('.qt-copy-btn').textContent = 'Copy';
      }, 1500);
    });
    
    makeDraggable(overlay);
    document.body.appendChild(overlay);
    currentOverlay = overlay;
  }
  
  function showErrorOverlay(message) {
    hideOverlay();
    
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'qt-overlay qt-error';
    overlay.innerHTML = `
      <div class="qt-overlay-content">
        <div class="qt-error-icon">⚠️</div>
        <div class="qt-error-message">${escapeHtml(message)}</div>
        <button class="qt-close-btn">Close</button>
      </div>
    `;
    
    overlay.querySelector('.qt-close-btn').addEventListener('click', () => hideOverlay());
    document.body.appendChild(overlay);
    currentOverlay = overlay;
    
    setTimeout(hideOverlay, 5000);
  }
  
  function hideOverlay() {
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
    
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
  }
  
  function showPageLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'qt-page-loading';
    indicator.className = 'qt-page-loading';
    indicator.innerHTML = `
      <div class="qt-page-progress">
        <div class="qt-page-progress-bar"></div>
      </div>
      <div class="qt-page-status">Translating page... <span class="qt-page-count">0%</span></div>
    `;
    
    document.body.appendChild(indicator);
  }
  
  function updatePageProgress(current, total) {
    const countEl = document.querySelector('.qt-page-count');
    const barEl = document.querySelector('.qt-page-progress-bar');
    
    if (countEl && barEl) {
      const percent = Math.round((current / total) * 100);
      countEl.textContent = `${percent}%`;
      barEl.style.width = `${percent}%`;
    }
  }
  
  function hidePageLoadingIndicator() {
    const indicator = document.getElementById('qt-page-loading');
    if (indicator) {
      indicator.remove();
    }
  }
  
  function showRestoreButton() {
    const btn = document.createElement('button');
    btn.id = 'qt-restore-btn';
    btn.className = 'qt-restore-btn';
    btn.textContent = '↩ Restore Original';
    btn.addEventListener('click', restorePage);
    
    document.body.appendChild(btn);
  }
  
  function hideRestoreButton() {
    const btn = document.getElementById('qt-restore-btn');
    if (btn) {
      btn.remove();
    }
  }
  
  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    const header = el.querySelector('.qt-overlay-header');
    if (!header) return;
    
    header.style.cursor = 'move';
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('qt-close-btn')) return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = el.offsetLeft;
      initialY = el.offsetTop;
      
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      el.style.left = `${initialX + dx}px`;
      el.style.top = `${initialY + dy}px`;
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
})();

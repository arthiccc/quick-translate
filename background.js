const DEFAULT_TARGET_LANG = 'en';

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate selection',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'translate-page',
    title: 'Translate entire page',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'toggle-hover',
    title: 'Toggle hover translate',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const settings = await getSettings();
  
  switch (info.menuItemId) {
    case 'translate-selection':
      if (info.selectionText) {
        await sendMessageToTab(tab.id, {
          action: 'translateSelection',
          text: info.selectionText,
          targetLang: settings.targetLang
        });
      }
      break;
      
    case 'translate-page':
      await sendMessageToTab(tab.id, {
        action: 'translatePage',
        targetLang: settings.targetLang,
        bilingual: settings.bilingual !== false
      });
      break;
      
    case 'toggle-hover':
      const newHoverState = !settings.hoverEnabled;
      await saveSettings({ ...settings, hoverEnabled: newHoverState });
      await sendMessageToTab(tab.id, {
        action: 'toggleHover',
        enabled: newHoverState
      });
      break;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  
  if (message.action === 'saveSettings') {
    saveSettings(message.settings).then(sendResponse);
    return true;
  }
});

async function getSettings() {
  const result = await chrome.storage.sync.get({
    targetLang: DEFAULT_TARGET_LANG,
    hoverEnabled: true,
    hoverDelay: 300,
    bilingual: true
  });
  return result;
}

async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
  return true;
}

async function sendMessageToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    console.log('Could not send message to tab:', e);
  }
}

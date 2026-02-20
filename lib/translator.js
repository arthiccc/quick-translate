class Translator {
  constructor() {
    this.translators = new Map();
    this.detector = null;
    this.initPromise = this.init();
  }
  
  async init() {
    if (!this.isSupported()) {
      console.warn('Translator API not supported');
      return false;
    }
    return true;
  }
  
  isSupported() {
    return 'Translator' in self;
  }
  
  async checkAvailability(sourceLang, targetLang) {
    if (!this.isSupported()) return 'unavailable';
    
    const availability = await self.Translator.availability({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });
    
    return availability;
  }
  
  async getTranslator(sourceLang, targetLang, onProgress) {
    const key = `${sourceLang}:${targetLang}`;
    
    if (this.translators.has(key)) {
      return this.translators.get(key);
    }
    
    const availability = await this.checkAvailability(sourceLang, targetLang);
    
    if (availability === 'unavailable') {
      throw new Error('Translation not available for this language pair');
    }
    
    const translator = await self.Translator.create({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      monitor: onProgress ? (m) => {
        m.addEventListener('downloadprogress', (e) => {
          onProgress(e.loaded);
        });
      } : undefined
    });
    
    this.translators.set(key, translator);
    return translator;
  }
  
  async detectLanguage(text) {
    if (!('LanguageDetector' in self)) {
      return null;
    }
    
    if (!this.detector) {
      const availability = await self.LanguageDetector.availability();
      if (availability === 'unavailable') {
        return null;
      }
      this.detector = await self.LanguageDetector.create();
    }
    
    const results = await this.detector.detect(text);
    
    if (results && results.length > 0) {
      return results[0];
    }
    
    return null;
  }
  
  async translate(text, targetLang, sourceLang = null, onProgress = null) {
    await this.initPromise;
    
    if (!this.isSupported()) {
      throw new Error('Chrome AI not available. Enable chrome://flags/#optimization-guide-on-device-model');
    }
    
    if (!sourceLang) {
      const detected = await this.detectLanguage(text);
      sourceLang = detected ? detected.language : 'en';
    }
    
    if (sourceLang === targetLang) {
      return { translated: text, sourceLang, targetLang, cached: true };
    }
    
    const translator = await this.getTranslator(sourceLang, targetLang, onProgress);
    
    const translated = await translator.translate(text);
    
    return { translated, sourceLang, targetLang };
  }
  
  async *translateStreaming(text, targetLang, sourceLang = null) {
    await this.initPromise;
    
    if (!this.isSupported()) {
      throw new Error('Chrome AI not available');
    }
    
    if (!sourceLang) {
      const detected = await this.detectLanguage(text);
      sourceLang = detected ? detected.language : 'en';
    }
    
    const translator = await this.getTranslator(sourceLang, targetLang);
    
    const stream = translator.translateStreaming(text);
    
    for await (const chunk of stream) {
      yield chunk;
    }
  }
  
  clearCache() {
    this.translators.clear();
    this.detector = null;
  }
}

window.TranslatorService = new Translator();

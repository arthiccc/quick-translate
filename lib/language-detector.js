class LanguageDetectorService {
  constructor() {
    this.detector = null;
  }
  
  isSupported() {
    return 'LanguageDetector' in self;
  }
  
  async checkAvailability() {
    if (!this.isSupported()) return 'unavailable';
    return await self.LanguageDetector.availability();
  }
  
  async init(onProgress) {
    if (!this.isSupported()) {
      throw new Error('Language Detector API not supported');
    }
    
    if (this.detector) return this.detector;
    
    const availability = await this.checkAvailability();
    
    if (availability === 'unavailable') {
      throw new Error('Language detector not available');
    }
    
    this.detector = await self.LanguageDetector.create({
      monitor: onProgress ? (m) => {
        m.addEventListener('downloadprogress', (e) => {
          onProgress(e.loaded);
        });
      } : undefined
    });
    
    return this.detector;
  }
  
  async detect(text) {
    await this.init();
    
    const results = await this.detector.detect(text);
    
    return results.map(r => ({
      language: r.language,
      confidence: r.confidence
    }));
  }
  
  async getTopLanguage(text) {
    const results = await this.detect(text);
    return results.length > 0 ? results[0] : null;
  }
  
  getLanguageName(code) {
    const names = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'pl': 'Polish',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'ms': 'Malay',
      'uk': 'Ukrainian',
      'cs': 'Czech',
      'ro': 'Romanian',
      'hu': 'Hungarian',
      'el': 'Greek',
      'he': 'Hebrew',
      'bn': 'Bengali',
      'ta': 'Tamil',
      'te': 'Telugu',
      'ml': 'Malayalam'
    };
    
    return names[code] || code.toUpperCase();
  }
}

window.LanguageDetectorService = new LanguageDetectorService();

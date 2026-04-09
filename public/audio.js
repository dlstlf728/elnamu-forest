// ===== 대나무숲 오디오 엔진 =====
// 실제 음원 파일 재생 (BGM + 날씨 효과음)

class ForestAudio {
  constructor() {
    this.enabled = false;
    this.currentWeather = 'clear';

    // BGM
    this.bgm = new Audio('bgm.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0.25;

    // 날씨 사운드
    this.rain = new Audio('rain.mp3');
    this.rain.loop = true;
    this.rain.volume = 0;

    this.wind = new Audio('wind.mp3');
    this.wind.loop = true;
    this.wind.volume = 0;

    this._fadeInterval = null;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.bgm.play().catch(() => {});
      this.setWeather(this.currentWeather);
    } else {
      this.bgm.pause();
      this.rain.pause();
      this.wind.pause();
    }
    return this.enabled;
  }

  setWeather(weather) {
    this.currentWeather = weather;
    if (!this.enabled) return;

    if (weather === 'rain' || weather === 'thunder') {
      this._fadeIn(this.rain, 0.35);
      this._fadeOut(this.wind);
    } else if (weather === 'snow') {
      this._fadeIn(this.wind, 0.3);
      this._fadeOut(this.rain);
    } else {
      this._fadeOut(this.rain);
      this._fadeOut(this.wind);
    }
  }

  _fadeIn(audio, targetVol) {
    audio.volume = 0;
    audio.play().catch(() => {});
    let vol = 0;
    const step = () => {
      vol = Math.min(vol + 0.01, targetVol);
      audio.volume = vol;
      if (vol < targetVol) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  _fadeOut(audio) {
    let vol = audio.volume;
    const step = () => {
      vol = Math.max(vol - 0.01, 0);
      audio.volume = vol;
      if (vol > 0) {
        requestAnimationFrame(step);
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    };
    requestAnimationFrame(step);
  }
}

window.forestAudio = new ForestAudio();

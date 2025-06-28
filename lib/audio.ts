// Audio management utility for the quiz game
class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private isEnabled: boolean = true;
  private volume: number = 0.3; // Default volume (30%)
  private isInitialized: boolean = false;
  private clocktickInterval: number | null = null;

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.preloadSounds();
    }
  }

  private preloadSounds() {
    if (this.isInitialized) return;
    
    const soundFiles: Record<string, string> = {
      click: '/sounds/click.mp3',
      success: '/sounds/success.mp3',
      failure: '/sounds/failure.mp3',
      clocktick: '/sounds/clocktick.mp3',
      lost: '/sounds/lost.mp3',
    };

    Object.keys(soundFiles).forEach((name) => {
      const path = soundFiles[name];
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = this.volume;
        
        // Handle loading errors gracefully
        audio.addEventListener('error', () => {
          console.warn(`Failed to load sound: ${name} (${path})`);
        });

        this.sounds.set(name, audio);
      } catch (error) {
        console.warn(`Error creating audio for ${name}:`, error);
      }
    });

    this.isInitialized = true;
  }

  public play(soundName: string): void {
    if (typeof window === 'undefined' || !this.isEnabled) return;

    // Ensure sounds are loaded
    if (!this.isInitialized) {
      this.preloadSounds();
    }

    const sound = this.sounds.get(soundName);
    if (!sound) {
      console.warn(`Sound not found: ${soundName}`);
      return;
    }

    try {
      // Reset the audio to the beginning
      sound.currentTime = 0;
      
      // Play the sound
      const playPromise = sound.play();
      
      // Handle play promise (required for some browsers)
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Auto-play was prevented, which is normal
          console.debug(`Audio play prevented for ${soundName}:`, error);
        });
      }
    } catch (error) {
      console.warn(`Error playing sound ${soundName}:`, error);
    }
  }

  public startClocktick(): void {
    if (typeof window === 'undefined' || !this.isEnabled) return;
    
    // Stop any existing clocktick
    this.stopClocktick();
    
    // Play the first tick immediately
    this.play('clocktick');
    
    // Set up interval to play every 8 seconds
    this.clocktickInterval = setInterval(() => {
      this.play('clocktick');
    }, 8000);
  }

  public stopClocktick(): void {
    if (this.clocktickInterval) {
      clearInterval(this.clocktickInterval);
      this.clocktickInterval = null;
    }
    
    // Also stop any currently playing clocktick sound
    const clocktickSound = this.sounds.get('clocktick');
    if (clocktickSound) {
      clocktickSound.pause();
      clocktickSound.currentTime = 0;
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    this.sounds.forEach((sound) => {
      sound.volume = this.volume;
    });
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopClocktick();
    }
  }

  public isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  // Method to test if audio is working
  public testAudio(): void {
    this.play('click');
  }
}

// Create a singleton instance
let audioManagerInstance: AudioManager | null = null;

export const getAudioManager = (): AudioManager => {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
};

// Convenience functions for common sounds
export const playClickSound = () => getAudioManager().play('click');
export const playSuccessSound = () => getAudioManager().play('success');
export const playFailureSound = () => getAudioManager().play('failure');
export const playClocktickSound = () => getAudioManager().play('clocktick');
export const playLostSound = () => getAudioManager().play('lost');

// Hook for React components
export const useAudio = () => {
  const audioManager = getAudioManager();
  
  return {
    playClick: playClickSound,
    playSuccess: playSuccessSound,
    playFailure: playFailureSound,
    playClocktick: playClocktickSound,
    playLost: playLostSound,
    startClocktick: () => audioManager.startClocktick(),
    stopClocktick: () => audioManager.stopClocktick(),
    setVolume: (volume: number) => audioManager.setVolume(volume),
    setEnabled: (enabled: boolean) => audioManager.setEnabled(enabled),
    isEnabled: () => audioManager.isAudioEnabled(),
    testAudio: () => audioManager.testAudio(),
  };
};
declare module 'amplitudejs' {
  const Amplitude: {
    init(config: {
      songs: Array<{ name: string; artist: string; url: string; cover_art_url: string }>;
      volume: number;
      continue_next: boolean;
      callbacks: Record<string, () => void>;
    }): void;
    getAudio(): HTMLAudioElement;
    play(): void;
    playSongAtIndex(index: number): void;
    pause(): void;
    stop(): void;
    setVolume(volume: number): void;
    setSongPlayedPercentage(percentage: number): void;
  };
  export default Amplitude;
}

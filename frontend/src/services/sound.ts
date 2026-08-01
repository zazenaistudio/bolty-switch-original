const soundMap = {
  navigation: "/sounds/10. Navigation.mp3",
  execute: "/sounds/07. Launch Game.mp3",
  success: "/sounds/01. Achievement Toast.mp3",
  error: "/sounds/08. Message Toast.mp3",
  modal: "/sounds/12. Show Modal.mp3",
  toggleOn: "/sounds/18. Switch Toggle On.mp3",
  toggleOff: "/sounds/17. Switch Toggle Off.mp3",
  wakeOn: "/sounds/04. Default Activation.mp3",
  wakeOff: "/sounds/03. Bumper End 02.mp3",
} as const;

export type SoundName = keyof typeof soundMap;

export function playSound(name: SoundName, enabled: boolean, volume = 0.72) {
  if (!enabled) return;
  const audio = new Audio(soundMap[name]);
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => undefined);
}

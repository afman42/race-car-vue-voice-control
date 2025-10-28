// vitest.setup.js
import { vi } from 'vitest';

// Mock the services since we're only testing the simulation logic
vi.mock('@/services/audioService', () => ({
  default: {
    playSound: vi.fn(() => Promise.resolve()),
    loadSounds: vi.fn(),
  }
}));

vi.mock('@/services/textToSpeechService', () => ({
  default: {
    speak: vi.fn(() => Promise.resolve()),
  }
}));
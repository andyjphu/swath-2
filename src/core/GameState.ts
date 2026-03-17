export class GameState {
  currentTick = 0;
  speedMultiplier = 1;
  isPaused = false;

  reset(): void {
    this.currentTick = 0;
    this.speedMultiplier = 1;
    this.isPaused = false;
  }
}

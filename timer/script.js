// 각 모드의 시간은 index.html의 data-minutes 값으로 변경할 수 있습니다.
const time = document.querySelector('#time');
const start = document.querySelector('#start');
const status = document.querySelector('#status');
const hint = document.querySelector('#timer-hint');
const progress = document.querySelector('#progress');
const announcement = document.querySelector('#announcement');
const modes = [...document.querySelectorAll('[data-minutes]')];
let duration = 25 * 60;
let remaining = duration;
let running = false;
let deadline = 0;
let interval;
let resting = false;
function render() {
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  time.textContent = `${minutes}:${seconds}`;
  progress.style.strokeDashoffset = 684.867 * (1 - remaining / duration);
  start.innerHTML = running ? '일시정지 <span aria-hidden="true">Ⅱ</span>' : '시작하기 <span aria-hidden="true">▶</span>';
  status.textContent = running ? (resting ? '휴식 중' : '집중 중') : remaining === 0 ? '완료' : remaining < duration ? '일시정지' : (resting ? '휴식 준비' : '집중 준비');
  document.title = running ? `${minutes}:${seconds} · ${resting ? '휴식' : '집중'} — 모먼트` : '모먼트 — 지금, 나에게 집중할 시간';
}
function tick() {
  remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  if (remaining === 0) {
    running = false;
    clearInterval(interval);
    hint.textContent = resting ? '충전 완료! 다시 시작해 볼까요?' : '잘했어요! 잠깐 쉬어가세요.';
    announcement.textContent = resting ? '휴식 시간이 끝났습니다.' : '집중 시간이 끝났습니다. 잠깐 쉬어가세요.';
  }
  render();
}
function reset() {
  clearInterval(interval);
  running = false;
  remaining = duration;
  hint.textContent = resting ? '잠시 쉬어가도 괜찮아요' : '작은 집중, 커다란 변화';
  announcement.textContent = '';
  render();
}
start.addEventListener('click', () => {
  if (running) {
    tick();
    running = false;
    clearInterval(interval);
  } else {
    if (remaining === 0) reset();
    running = true;
    deadline = Date.now() + remaining * 1000;
    interval = setInterval(tick, 250);
  }
  render();
});
document.querySelector('#reset').addEventListener('click', reset);
modes.forEach((button, index) => button.addEventListener('click', () => {
  modes.forEach(mode => {
    mode.classList.toggle('active', mode === button);
    mode.setAttribute('aria-pressed', String(mode === button));
  });
  duration = Number(button.dataset.minutes) * 60;
  resting = index > 0;
  document.querySelector('#timer-heading').textContent = resting ? '지금은, 쉬어갈 시간' : '지금은, 집중할 시간';
  reset();
}));
document.addEventListener('visibilitychange', () => { if (running) tick(); });
render();

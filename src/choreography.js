// 归一化进度映射为分段节奏。所有曲线可由滑杆反向求值。
const ease = (a, b, p) => {
  const t = Math.max(0, Math.min(1, (p - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const DURATION = 16;
export function choreography(p) {
  return {
    lift: ease(0.08, 0.2, p),
    release: ease(0.1, 0.38, p),
    stream: ease(0.48, 0.72, p),
    form: ease(0.69, 0.89, p),
    reveal: ease(0.88, 0.96, p),
    light: ease(0.91, 0.985, p),
    label:
      p < 0.14
        ? "花海轻起伏"
        : p < 0.39
          ? "花瓣化光"
          : p < 0.73
            ? p < 0.48
              ? "粒子海 · 微光轻漾"
              : "流光收束"
            : p < 0.91
              ? "葵仔显形"
              : "托光 · 向阳而生",
  };
}

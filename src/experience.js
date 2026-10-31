import { VISUAL } from "./visual-style.js";
// 当前祝福是拾取、结尾与导出共用的唯一状态。存储失败时仍可在当前页面完成体验。
const STORAGE_KEY = "zjut-code-in-bloom-wish-v1";
const DEFAULT_WISH = "愿每一行热爱，都向阳生长。";
const clean = (text) =>
  Array.from(
    String(text || "")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, 80)
    .join("");
const $ = (id) => document.getElementById(id);
function lines(ctx, text, width) {
  const result = [];
  let current = "";
  const closing = /[，。！？；：、）》】”’％,.!?;:)\]}]/;
  for (const glyph of Array.from(text)) {
    if (current && ctx.measureText(current + glyph).width > width) {
      if (closing.test(glyph)) {
        const chars = Array.from(current),
          carry = chars.pop();
        result.push(chars.join(""));
        current = carry + glyph;
        continue;
      }
      result.push(current);
      current = "";
    }
    current += glyph;
  }
  if (current) result.push(current);
  return result;
}

export function createExperience({
  onStart,
  onPause,
  onWishChanged,
  capturePortrait,
  modal,
}) {
  let selection = { text: DEFAULT_WISH, source: "default" },
    demo = null,
    finalVisible = false,
    exporting = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && clean(saved.text))
      selection = {
        text: clean(saved.text),
        source: ["picked", "custom", "default"].includes(saved.source)
          ? saved.source
          : "custom",
      };
  } catch {}
  function syncWish() {
    onWishChanged(selection.text);
    $("finaleWish").textContent = selection.text;
  }
  function select(text, source) {
    const normalized = clean(text);
    if (!normalized) return false;
    selection = { text: normalized, source };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
      $("experienceStatus").textContent = "已记住这句祝福，它将陪你走到结尾。";
    } catch {
      $("experienceStatus").textContent = "这句祝福已留在当前页面。";
    }
    syncWish();
    $("saveStatus").textContent = "";
    return true;
  }
  syncWish();
  function stopDemo(message = "") {
    if (!demo) return;
    demo = null;
    document.body.dataset.demo = "false";
    $("demoButton").textContent = "一键演示";
    $("demoNarration").hidden = true;
    $("experienceStatus").textContent = message;
  }
  function startDemo() {
    onPause();
    demo = { seconds: 0, paused: false };
    document.body.dataset.demo = "true";
    $("demoButton").textContent = "结束演示";
    $("experienceStatus").textContent =
      "一键演示 · 44秒；拖动时间轴可随时接管。";
    $("demoNarration").hidden = false;
    $("play").textContent = "Ⅱ";
  }
  function advance(dt) {
    if (!demo) return null;
    if (!demo.paused) demo.seconds = Math.min(44, demo.seconds + dt);
    const t = demo.seconds;
    $("demoNarration").hidden = t >= 33;
    $("demoNarration").textContent =
      t < 6
        ? "一片向阳花海，藏着万千份热爱。"
        : t < 11
          ? `「${selection.text}」`
          : "让每一份祝福，汇成向阳的光。";
    if (t >= 44) {
      stopDemo("演示完成。把这束光保存下来吧。");
      $("play").textContent = "↻";
    }
    return Math.max(0, Math.min(1, (t - 11) / 22));
  }
  function update(progress) {
    const show = progress >= 0.985;
    if (show !== finalVisible) {
      finalVisible = show;
      $("finale").hidden = !show;
    }
    if (!show) $("saveStatus").textContent = "";
  }
  function openEditor() {
    stopDemo();
    onPause();
    modal(
      "写一句，属于你的祝福。",
      '<p class="wish-help">这句话会出现在葵仔托光的结尾与纪念卡里。最多80字，可在本机恢复。</p><p class="wish-preview" id="wishPreview"></p><form id="wishForm"><input id="wishInput" maxlength="160" required aria-label="你的学院祝福"><button class="submit">带着这句出发 ↗</button></form>',
    );
    $("wishPreview").textContent = selection.text;
    $("wishInput").value = selection.text;
    $("wishInput").focus();
    $("wishForm").onsubmit = (e) => {
      e.preventDefault();
      if (select($("wishInput").value, "custom")) {
        $("dialog").close();
        onStart();
      }
    };
  }
  $("demoButton").onclick = () =>
    demo ? stopDemo("已切回自由探索。") : startDemo();
  $("wish").onclick = openEditor;
  $("editFinalWish").onclick = openEditor;
  $("keepBlessing").onclick = () => onStart();
  $("saveCard").onclick = async () => {
    if (exporting) return;
    exporting = true;
    $("saveCard").disabled = true;
    $("saveStatus").textContent = "正在把这束光定格……";
    // 在开始导出时固定文字，防止异步编码期间发生选择变化。
    const chosen = { ...selection };
    try {
      const portrait = capturePortrait();
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      const bg = portrait.getContext("2d").getImageData(0, 0, 1, 1).data;
      const bgColor = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 1800, 1200);
      // Feather all four edges now that the shared scene has a non-uniform light mist.
      const feathered = document.createElement("canvas");
      feathered.width = portrait.width;
      feathered.height = portrait.height;
      const imageContext = feathered.getContext("2d");
      imageContext.drawImage(portrait, 0, 0);
      imageContext.globalCompositeOperation = "destination-in";
      const vertical = imageContext.createLinearGradient(
        0,
        0,
        0,
        portrait.height,
      );
      vertical.addColorStop(0, "rgba(255,255,255,0)");
      vertical.addColorStop(0.1, "rgba(255,255,255,1)");
      vertical.addColorStop(0.9, "rgba(255,255,255,1)");
      vertical.addColorStop(1, "rgba(255,255,255,0)");
      imageContext.fillStyle = vertical;
      imageContext.fillRect(0, 0, portrait.width, portrait.height);
      const horizontal = imageContext.createLinearGradient(
        0,
        0,
        portrait.width,
        0,
      );
      horizontal.addColorStop(0, "rgba(255,255,255,0)");
      horizontal.addColorStop(0.17, "rgba(255,255,255,1)");
      horizontal.addColorStop(0.86, "rgba(255,255,255,1)");
      horizontal.addColorStop(1, "rgba(255,255,255,0)");
      imageContext.fillStyle = horizontal;
      imageContext.fillRect(0, 0, portrait.width, portrait.height);
      ctx.drawImage(feathered, 760, 50, 1000, 1050);
      const fade = ctx.createLinearGradient(720, 0, 880, 0);
      fade.addColorStop(0, bgColor);
      fade.addColorStop(1, `rgba(${bg[0]},${bg[1]},${bg[2]},0)`);
      ctx.fillStyle = fade;
      ctx.fillRect(720, 0, 160, 1150);
      ctx.fillStyle = VISUAL.champagne;
      ctx.font = "18px Consolas";
      ctx.fillText("1986 — 2026  /  CODE IN BLOOM", 95, 115);
      ctx.fillStyle = "#e9e8d7";
      ctx.font = "66px SimSun, serif";
      ctx.fillText("向阳而生", 90, 260);
      ctx.fillStyle = VISUAL.champagne;
      ctx.font = "35px SimSun, serif";
      ctx.fillText("四十载代码，一朵花开。", 95, 330);
      ctx.fillStyle = "#fff0c9";
      ctx.font = "31px Microsoft YaHei, Segoe UI Emoji, sans-serif";
      const wrapped = lines(ctx, chosen.text, 640);
      let y = 470;
      for (const line of wrapped) {
        ctx.fillText(line, 95, y);
        y += 51;
      }
      ctx.fillStyle = "#a0b3b5";
      ctx.font = "19px Microsoft YaHei";
      ctx.fillText("你留下的话，成为了光。", 95, Math.max(850, y + 55));
      ctx.fillStyle = "#c4ae7d";
      ctx.font = "19px Microsoft YaHei";
      ctx.fillText("厚德健行 · 下一行，由你。", 95, 945);
      ctx.strokeStyle = "#6d805a66";
      ctx.beginPath();
      ctx.moveTo(95, 1090);
      ctx.lineTo(1705, 1090);
      ctx.stroke();
      ctx.fillStyle = "#8da4ac";
      ctx.font = "17px Microsoft YaHei";
      ctx.fillText(
        "献礼浙江工业大学计算机学院办学40周年 · 共庆学校建校73周年",
        95,
        1143,
      );
      ctx.textAlign = "right";
      ctx.fillText("向阳而生 · 你的院庆纪念卡", 1705, 1143);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95),
      );
      if (!blob) throw new Error("JPEG encoding failed");
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "向阳而生-我的院庆纪念卡.jpg";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      $("saveStatus").textContent = "纪念卡已生成，请查看浏览器下载列表。";
    } catch (error) {
      console.error(error);
      $("saveStatus").textContent = "导出未完成，请重试。";
    } finally {
      exporting = false;
      $("saveCard").disabled = false;
    }
  };
  return {
    select,
    update,
    advance,
    stopDemo,
    startDemo,
    get currentWish() {
      return selection.text;
    },
    get source() {
      return selection.source;
    },
    get demoActive() {
      return demo !== null;
    },
    get demoPaused() {
      return !!demo?.paused;
    },
    toggleDemoPause() {
      if (!demo) return;
      demo.paused = !demo.paused;
      $("play").textContent = demo.paused ? "▶" : "Ⅱ";
    },
    get demoSeconds() {
      return demo?.seconds ?? 44;
    },
  };
}

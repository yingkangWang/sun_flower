// 粒子视觉稿：Three.js MIT；使用其官方后处理模块，不含无明确许可示例源码。
import * as THREE from "three";
import { createExperience } from "./experience.js";
import { mountOpening } from "./opening.tsx";
import { createOpeningScene } from "./opening-scene.js";
import { createEntryTransition } from "./entry-transition.js";
import { VISUAL, addGardenAtmosphere } from "./visual-style.js";
import { createMascot } from "./mascot.js";
import { createBotanical } from "./botanical.js";
import { sampleBotanical } from "./surface-particles.js";
import { choreography, DURATION } from "./choreography.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
const stage = document.querySelector("#stage"),
  progress = document.querySelector("#progress");
const scene = new THREE.Scene();
scene.background = new THREE.Color(VISUAL.background);
scene.fog = new THREE.FogExp2(VISUAL.background, 0.025);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = VISUAL.exposure;
stage.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(
  40,
  stage.clientWidth / stage.clientHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 13.8);
const composer = new EffectComposer(renderer);
const mainRenderPass = new RenderPass(scene, camera);
composer.addPass(mainRenderPass);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(stage.clientWidth, stage.clientHeight),
  VISUAL.bloom.strength,
  VISUAL.bloom.radius,
  VISUAL.bloom.threshold,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
scene.add(
  new THREE.HemisphereLight(VISUAL.ambientLight, VISUAL.shadowLight, 1.12),
);
scene.add(new THREE.AmbientLight(VISUAL.ambientLight, 0.95));
const sun = new THREE.DirectionalLight(VISUAL.keyLight, 1.8);
sun.position.set(0, 6, 8);
scene.add(sun);
const rim = new THREE.DirectionalLight(VISUAL.rimLight, 0.5);
rim.position.set(-4, 1, -3);
scene.add(rim);
const atmosphere = addGardenAtmosphere(scene);
// 固定随机序列使同一进度的形态可复现。
let seed = 89;
function rand() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const beds = [
  [-8.8, 1.85, 0.58, -4],
  [-6.4, 1.3, 0.43, -5],
  [-4.2, 2.0, 0.52, -4],
  [-1.7, 1.4, 0.41, -5],
  [1.0, 1.8, 0.5, -4],
  [3.3, 1.2, 0.45, -5],
  [6.0, 2.1, 0.57, -4],
  [8.6, 1.2, 0.5, -4.5],
  [-7.1, -0.4, 0.82, -1.5],
  [-3.9, -0.7, 0.72, -2.0],
  [-0.45, -0.25, 0.86, -1.1],
  [3.4, -0.85, 0.69, -2],
  [6.9, -0.15, 0.8, -1.4],
  [-8.1, -2.8, 1.22, 1.4],
  [-3.55, -2.3, 1.08, 1.1],
  [2.15, -2.65, 1.28, 1.4],
  [7.35, -2.5, 1.16, 1.1],
];
const botanical = createBotanical(beds);
scene.add(botanical.group);
const sampled = sampleBotanical(botanical.group, 47600, rand);
const { positions, colors, sizes, detach } = sampled;
const c = new THREE.Color();
const FLOWER_PARTICLES = positions.length / 3;
const FIELD_PARTICLES = 18000;
for (let i = 0; i < FIELD_PARTICLES; i++) {
  positions.push((rand() - 0.5) * 23, (rand() - 0.5) * 10, -4 + rand() * 8);
  detach.push(rand());
  c.setHSL(0.09 + rand() * 0.06, 0.3, 0.42 + rand() * 0.24);
  colors.push(c.r, c.g, c.b);
  sizes.push(0.45 + rand() * 1.15);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(positions, 3),
);
geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
const seedAttribute = positions
  .filter((_, i) => i % 3 === 0)
  .map((_, i) => (i * 0.61803398875) % 1);
geometry.setAttribute(
  "aSeed",
  new THREE.Float32BufferAttribute(seedAttribute, 1),
);
geometry.setAttribute(
  "aField",
  new THREE.Float32BufferAttribute(
    Array.from({ length: positions.length / 3 }, (_, i) =>
      i >= FLOWER_PARTICLES ? 1 : 0,
    ),
    1,
  ),
);
geometry.setAttribute("aDetach", new THREE.Float32BufferAttribute(detach, 1));
const uniforms = {
  uLift: { value: 0 },
  uRelease: { value: 0 },
  uStream: { value: 0 },
  uForm: { value: 0 },
  uReveal: { value: 0 },
  uProgress: { value: 0 },
  uTime: { value: 0 },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uPixelRatio: { value: renderer.getPixelRatio() },
};
const material = new THREE.ShaderMaterial({
  uniforms,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `
  attribute vec3 aTarget,aEndColor;attribute float aSize,aSeed,aField,aDetach;
  uniform float uTime,uPixelRatio,uLift,uRelease,uStream,uForm,uReveal;uniform vec2 uMouse;
  varying vec3 vColor;varying float vOpacity;
  void main(){
    float born=smoothstep(aDetach-.06,aDetach+.06,uRelease);
    float drift=max(0.,uRelease-aDetach)/(1.06-aDetach);
    vec3 origin=position;
    vec3 offset=vec3(sin(aSeed*37.1)*.85,.35+aSeed*.9,cos(aSeed*43.7)*.75);
    vec3 sea=origin+offset*drift*drift;
    sea.x+=aField*sin(uTime*.30+aSeed*50.)*.28;
    sea.y+=aField*cos(uTime*.22+aSeed*31.)*.20;
    sea+=vec3(sin(uTime*.36+aSeed*23.),cos(uTime*.29+aSeed*19.),0.)*.045*born;
    float angle=atan(sea.y,sea.x)+uStream*1.1;
    float radius=mix(length(sea.xy),1.7+aSeed*.7,uStream);
    vec3 stream=vec3(cos(angle)*radius,sin(angle)*radius*.66,sea.z*(1.-uStream*.55));
    vec3 p=mix(sea,stream,uStream);p=mix(p,aTarget,uForm);
    float d=distance(p.xy,uMouse);p.xy+=(p.xy-uMouse)*(.02*exp(-d*d*.8))*(1.-uForm);
    vColor=mix(color,aEndColor,uForm);
    vOpacity=mix(mix(.12,.72,born),.37,aField)*(1.-uReveal*.95);
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=clamp(aSize*uPixelRatio*mix(25.+aField*8.,36.,uStream)/-mv.z,.9+aField*.2,3.1);
  }`,
  fragmentShader: `varying vec3 vColor;varying float vOpacity;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,1.5);gl_FragColor=vec4(vColor*1.55,a*vOpacity);}`,
});
const flower = new THREE.Points(geometry, material);
flower.frustumCulled = false;
scene.add(flower);
const mascot = createMascot(),
  kuizai = mascot.group,
  mascotMaterials = mascot.materials,
  lamp = mascot.lamp;
scene.add(kuizai);
// 用官方MeshSurfaceSampler从各个角色部件采样，构造与花海等长的终点数组。
// 每粒点保有固定起点/终点，拖动只改变插值，不重新随机采样。
kuizai.updateMatrixWorld(true);
const surfaces = [];
let totalWeight = 0;
kuizai.traverse((obj) => {
  if (obj.isMesh && !obj.userData.noSample) {
    // 按世界空间三角形面积分配粒子，避免小手与连续躯干同权重。
    const pa = obj.geometry.attributes.position,
      idx = obj.geometry.index;
    const va = new THREE.Vector3(),
      vb = new THREE.Vector3(),
      vc = new THREE.Vector3();
    let weight = 0;
    const count = idx ? idx.count : pa.count;
    for (let j = 0; j < count; j += 3) {
      va.fromBufferAttribute(pa, idx ? idx.getX(j) : j).applyMatrix4(
        obj.matrixWorld,
      );
      vb.fromBufferAttribute(pa, idx ? idx.getX(j + 1) : j + 1).applyMatrix4(
        obj.matrixWorld,
      );
      vc.fromBufferAttribute(pa, idx ? idx.getX(j + 2) : j + 2).applyMatrix4(
        obj.matrixWorld,
      );
      weight += vb.sub(va).cross(vc.sub(va)).length() * 0.5;
    }
    weight = Math.max(0.0001, weight);
    totalWeight += weight;
    surfaces.push({
      obj,
      sampler: new MeshSurfaceSampler(obj).setRandomGenerator(rand).build(),
      end: totalWeight,
    });
  }
});
const targets = [],
  endColors = [],
  v = new THREE.Vector3();
for (let n = 0; n < positions.length / 3; n++) {
  const r = rand() * totalWeight,
    entry = surfaces.find((x) => x.end >= r);
  entry.sampler.sample(v);
  entry.obj.localToWorld(v);
  targets.push(v.x, v.y, v.z);
  const col = entry.obj.material.color;
  endColors.push(col.r, col.g, col.b);
}
geometry.setAttribute("aTarget", new THREE.Float32BufferAttribute(targets, 3));
geometry.setAttribute(
  "aEndColor",
  new THREE.Float32BufferAttribute(endColors, 3),
);

mascotMaterials.forEach((m) => {
  m.transparent = true;
  m.opacity = 0;
});
kuizai.visible = false;
// 远景星尘只提供空间感，保持文字区域安静。
const dustG = new THREE.BufferGeometry(),
  dustP = [];
for (let i = 0; i < 1100; i++)
  dustP.push((rand() - 0.35) * 28, (rand() - 0.5) * 16, -3 - rand() * 6);
dustG.setAttribute("position", new THREE.Float32BufferAttribute(dustP, 3));
const dust = new THREE.Points(
  dustG,
  new THREE.PointsMaterial({
    color: 0x9fb4c5,
    size: 0.018,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  }),
);
scene.add(dust);
let wishText = "";
let previousPhase = -1;
let value = 0,
  playing = false,
  last = performance.now(),
  elapsed = 0,
  frame = 0;
function resize() {
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  if (w < 680) {
    camera.position.set(0, -0.1, 18);
    flower.position.set(0, 0, 0);
    kuizai.position.set(0, -0.25, 0.8);
  } else {
    camera.position.set(0, 0, 13.8);
    flower.position.set(0, 0, 0);
    kuizai.position.set(0, -0.25, 0.8);
  }
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
function renderSceneAt(p, forCapture = false) {
  uniforms.uProgress.value = p;
  uniforms.uTime.value = elapsed;
  progress.value = Math.round(value * 1000);
  progress.style.setProperty("--light-progress", `${p * 100}%`);
  progress.setAttribute(
    "aria-valuetext",
    `${Math.round(p * 100)}%，${choreography(p).label}`,
  );
  const beat = choreography(p);
  uniforms.uLift.value = beat.lift;
  uniforms.uRelease.value = beat.release;
  uniforms.uStream.value = beat.stream;
  uniforms.uForm.value = beat.form;
  uniforms.uReveal.value = beat.reveal;
  botanical.update(beat.release, elapsed);
  const reveal = beat.reveal;
  atmosphere.update(reveal);
  kuizai.visible = reveal > 0;
  mascotMaterials.forEach((m) => (m.opacity = reveal));
  mascot.lightMat.emissiveIntensity = 0.35 + beat.light * 2.4;
  lamp.intensity = 0.9 * reveal * beat.light;
  if (!forCapture && stage.clientWidth < 680) {
    if (p >= 0.985) {
      const panel = document.querySelector("#finale"),
        r = panel.getBoundingClientRect();
      const top = 90,
        bottom = panel.hidden ? stage.clientHeight - 350 : r.top - 16;
      const available = Math.max(180, bottom - top),
        half = Math.tan((camera.fov * Math.PI) / 360);
      const distance = Math.max(
        17,
        (6.4 / (2 * half)) * (stage.clientHeight / available),
      );
      const targetY = 1 - (2 * ((top + bottom) * 0.5)) / stage.clientHeight;
      camera.position.set(0, 0.25 - targetY * distance * half, distance + 0.8);
    } else camera.position.set(0, -0.1, 18);
  }
  return beat;
}
function capturePortrait() {
  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);
  const oldRatio = renderer.getPixelRatio(),
    oldAspect = camera.aspect,
    oldPosition = camera.position.clone();
  const image = document.createElement("canvas");
  image.width = 1000;
  image.height = 1050;
  try {
    renderer.setPixelRatio(1);
    composer.setPixelRatio(1);
    renderer.setSize(1000, 1050, false);
    composer.setSize(1000, 1050);
    camera.aspect = 1000 / 1050;
    camera.position.set(0, 0, 13.8);
    camera.updateProjectionMatrix();
    renderSceneAt(1, true);
    composer.render();
    image.getContext("2d").drawImage(renderer.domElement, 0, 0);
  } finally {
    renderer.setPixelRatio(oldRatio);
    composer.setPixelRatio(oldRatio);
    renderer.setSize(oldSize.x, oldSize.y, false);
    composer.setSize(oldSize.x, oldSize.y);
    camera.aspect = oldAspect;
    camera.position.copy(oldPosition);
    camera.updateProjectionMatrix();
    renderSceneAt(value);
    composer.render();
  }
  return image;
}
function tick(now) {
  if (document.hidden) {
    frame = 0;
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;
  if (opening.active) {
    const travel = opening.advance(dt);
    if (opening.active) {
      if (opening.transitioning) entryTransition.render(elapsed, travel);
      else openingView.render(elapsed);
    } else {
      entryTransition.finish();
      renderSceneAt(value);
      composer.render();
    }
    frame = requestAnimationFrame(tick);
    return;
  }
  entryTransition.finish();
  if (experience.demoActive) {
    value = experience.advance(dt);
  } else if (playing) {
    value = Math.min(1, value + dt / DURATION);
    if (value === 1) {
      playing = false;
      document.querySelector("#play").textContent = "↻";
    }
  }
  const beat = renderSceneAt(value);
  const phase = value < 0.25 ? 0 : value < 0.87 ? 1 : 2;
  document.body.dataset.phase = ["sea", "gather", "kuizai"][phase];
  if (previousPhase !== phase) {
    document.querySelector(".hint").textContent = [
      "✧ 点击花海，拾取一句祝福",
      "✧ 每一份祝福，都在向光汇聚",
      "✧ 四十载微光，托起下一程",
    ][phase];
    previousPhase = phase;
  }
  if (value >= 0.25) closeBlessing();
  document
    .querySelectorAll(".years span")
    .forEach((el, i) => el.classList.toggle("active", i === phase));
  document.querySelector("#phaseName").textContent = beat.label;
  document.querySelector("#chapterTitle").textContent = [
    "一片花海，万千份热爱。",
    "把每一份热爱，汇成光。",
    "四十载微光，托起下一程。",
  ][phase];
  document.querySelector("#chapterText").textContent =
    wishText ||
    [
      "从校园里的向日葵，开始这段向阳的旅程。",
      "花瓣化作微光，在时光里奔赴同一个方向。",
      "葵仔托举光种。下一行，由你。",
    ][phase];
  document.querySelector(".kuizai-label").style.opacity = String(beat.reveal);
  document.querySelector("#awaken").innerHTML =
    value >= 1 ? "再看一次 <span>↻</span>" : "汇聚微光 <span>↗</span>";
  dust.rotation.y = elapsed * 0.003;
  experience.update(value);
  composer.render();
  frame = requestAnimationFrame(tick);
}
frame = requestAnimationFrame(tick);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !frame) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
});
// 从画布坐标反投影到场景平面，适配全屏与窄屏镜头。
const pointerRay = new THREE.Raycaster(),
  pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
  pointerWorld = new THREE.Vector3();
stage.addEventListener("pointermove", (e) => {
  const rect = stage.getBoundingClientRect();
  pointerRay.setFromCamera(
    new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((e.clientY - rect.top) / rect.height) * 2,
    ),
    camera,
  );
  if (pointerRay.ray.intersectPlane(pointerPlane, pointerWorld))
    uniforms.uMouse.value.copy(pointerWorld);
});
// 祝福按区域触发，不对几万个点逐一做命中检测；连续拾取不立即重复。
const blessings = [
  "愿学院四十载积淀，在下一程绽放更耀眼的光。",
  "愿每一行代码都写满热爱，每一次探索都奔向远方。",
  "四十年薪火相传，愿工大计算机的故事续写新章。",
  "愿你我写下的微小光芒，汇成学院灿烂的星河。",
  "祝学院四十周年快乐，愿创新的种子生生不息。",
  "愿每一个在这里启程的梦想，都有向阳生长的力量。",
  "从第一行代码到无限可能，愿学院始终勇敢向前。",
  "愿四十载求索，照亮更多人的下一程。",
  "愿课堂里的好奇与实验室里的坚持，终成改变世界的光。",
  "四十正青春，愿我们与学院一起，心怀热爱，步履不停。",
  "愿代码有温度，创新有力量，工大计算机再谱华章。",
  "把祝福藏进星光，愿学院的每一个明天都熠熠生辉。",
];
const blessingCard = document.querySelector("#blessingCard");
let lastBlessing = -1;
function closeBlessing() {
  blessingCard.hidden = true;
  document.querySelector("#clickRipple").classList.remove("active");
}
function openBlessing(x, y) {
  if (value >= 0.25) return;
  let n = Math.floor(Math.random() * (blessings.length - 1));
  if (n >= lastBlessing) n++;
  if (lastBlessing < 0) n = Math.floor(Math.random() * blessings.length);
  lastBlessing = n;
  experience.select(blessings[n], "picked");
  document.querySelector("#blessingText").textContent = blessings[n];
  blessingCard.hidden = false;
  // offset尺寸不包含弹出动画的scale，防止首次展开时低估卡片宽高。
  const cardRect = {
    width: blessingCard.offsetWidth,
    height: blessingCard.offsetHeight,
  };
  const bottom =
    document.querySelector(".timeline").getBoundingClientRect().top - 12;
  blessingCard.style.left =
    Math.max(16, Math.min(x + 22, innerWidth - cardRect.width - 16)) + "px";
  blessingCard.style.top =
    Math.max(82, Math.min(y - cardRect.height / 2, bottom - cardRect.height)) +
    "px";
  const ripple = document.querySelector("#clickRipple");
  ripple.style.left = x + "px";
  ripple.style.top = y + "px";
  ripple.classList.remove("active");
  void ripple.offsetWidth;
  ripple.classList.add("active");
}
stage.addEventListener("click", (e) => openBlessing(e.clientX, e.clientY));
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("role", "button");
renderer.domElement.setAttribute(
  "aria-label",
  "星光花海，点击或按回车拾取一句学院祝福",
);
renderer.domElement.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openBlessing(innerWidth / 2, innerHeight / 2);
  }
});
document.querySelector("#closeBlessing").onclick = closeBlessing;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeBlessing();
});
window.addEventListener("resize", closeBlessing);

function awaken() {
  experience.stopDemo();
  closeBlessing();
  value = 0;
  playing = true;
  document.querySelector("#play").textContent = "Ⅱ";
}
document.querySelector("#awaken").onclick = awaken;
document.querySelector("#home").onclick = awaken;
document.querySelector("#play").onclick = () => {
  if (experience.demoActive) {
    experience.toggleDemoPause();
    return;
  }
  if (value >= 1) {
    awaken();
    return;
  }
  playing = !playing;
  document.querySelector("#play").textContent = playing ? "Ⅱ" : "▶";
};
progress.oninput = () => {
  experience.stopDemo("已接管时间轴，自由探索。");
  closeBlessing();
  value = Number(progress.value) / 1000;
  playing = false;
  document.querySelector("#play").textContent = "▶";
};
const dialog = document.querySelector("#dialog");
function modal(title, body) {
  document.querySelector("#dialogTitle").textContent = title;
  document.querySelector("#dialogBody").innerHTML = body;
  dialog.showModal();
}
document.querySelector("#close").onclick = () => dialog.close();
const history = () => {
  experience.stopDemo();
  closeBlessing();
  value = 0;
  playing = false;
  document.querySelector("#play").textContent = "▶";
  document.querySelector("#chapterTitle").textContent =
    "1986 · 故事从这里起笔。";
  document.querySelector("#chapterText").textContent =
    "1986年10月28日，学校决定成立计算机工程系。";
  progress.focus();
};
document.querySelector("#history").onclick = history;
document.querySelector("#time").onclick = history;
document.querySelector("#notes").onclick = () =>
  modal(
    "代码、微光与葵仔",
    "<p>这是一版可运行的粒子视觉稿。向日葵由黄金角花盘与曲面粒子组成；葵仔依据你提供的照片，以几何体近似重建，并非校方标准三维模型。</p><p>渲染基础使用 Three.js（MIT），辉光使用其官方 UnrealBloomPass。开源调研及来源保存在项目文档。</p><p>花海到葵仔的粒子汇聚与拖动已实现；祝福、结尾纪念卡与一键演示已接入；手势和完整院史分镜将继续完善。</p>",
  );
const experience = createExperience({
  onStart: awaken,
  onPause: () => {
    playing = false;
    document.querySelector("#play").textContent = "▶";
  },
  onWishChanged: (text) => {
    wishText = text;
  },
  capturePortrait,
  modal,
});
const openingView = createOpeningScene(
  renderer,
  composer,
  mainRenderPass,
  bloom,
);
const entryTransition = createEntryTransition({
  renderer,
  composer,
  renderOpening: (time, p) =>
    openingView.render(time, p, { offscreen: true, depth: true }),
  renderGarden: (p) => {
    renderSceneAt(0);
    const previousPosition = camera.position.clone(),
      previousOutput = composer.renderToScreen;
    const ease = THREE.MathUtils.smoothstep(p, 0.43, 1);
    camera.position.z += (1 - ease) * 2.2;
    try {
      composer.renderToScreen = false;
      composer.render();
      return composer.readBuffer.texture;
    } finally {
      composer.renderToScreen = previousOutput;
      camera.position.copy(previousPosition);
    }
  },
});
const opening = mountOpening({
  onEnter: () => {
    history();
    resize();
  },
  onReturn: () => {
    entryTransition.finish();
    history();
    dialog.close();
    document.querySelector("#finale").hidden = true;
  },
});
// Compile depth/composite and field materials while the opening is idle, before the first click.
setTimeout(() => {
  if (
    opening.active &&
    !opening.transitioning &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    entryTransition.render(elapsed, 0);
    entryTransition.finish();
    openingView.render(elapsed);
  }
}, 200);
// 供验证脚本读取真实状态，不宣称生成图效果已落地。
window.particleGarden = {
  get openingActive() {
    return opening.active;
  },
  get entryProgress() {
    return opening.progress;
  },
  get entryTransitioning() {
    return opening.transitioning;
  },
  get entryPipelineActive() {
    return entryTransition.active;
  },
  get entryShot() {
    return openingView.shot;
  },
  entryDuration: opening.duration,
  get progress() {
    return value;
  },
  get particleCount() {
    return positions.length / 3;
  },
  get phase() {
    return value < 0.25 ? "sea" : value < 0.87 ? "gather" : "kuizai";
  },
  get flowerCount() {
    return beds.length;
  },
  get beat() {
    return choreography(value).label;
  },
  duration: DURATION,
  fieldParticleCount: FIELD_PARTICLES,
  botanicalDetails: { seedCount: 13600, leafCount: 51 },
  bodyGeometry: "soft-toy-continuous-surface",
  sourceSampling: "actual-botanical-surface",
  bodyMesh: kuizai.getObjectByName("continuous-suit-body"),
  joints: mascot.joints,
  get selectedWish() {
    return experience.currentWish;
  },
  get wishSource() {
    return experience.source;
  },
  get demoActive() {
    return experience.demoActive;
  },
  get demoPaused() {
    return experience.demoPaused;
  },
  get demoSeconds() {
    return experience.demoSeconds;
  },
  renderer,
};

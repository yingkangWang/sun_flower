import * as THREE from "three";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { VISUAL } from "./visual-style.js";

const ease = (a, b, value) => {
  const p = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return p * p * (3 - 2 * p);
};

// Code-native macro petals, not a video: local assets, pointer parallax, one shared renderer.
export function createOpeningScene(renderer, composer, renderPass, bloom) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VISUAL.background);
  scene.fog = new THREE.FogExp2(VISUAL.background, 0.027);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  camera.position.set(0, 0, 15);
  const depthOfField = new BokehPass(scene, camera, {
    focus: 15,
    aperture: 0,
    maxblur: 0,
  });
  depthOfField.enabled = false;
  composer.insertPass(depthOfField, 1);
  // Broad diffuse light lets the petals read as backlit silk instead of polished metal.
  scene.add(
    new THREE.HemisphereLight(VISUAL.ambientLight, VISUAL.shadowLight, 1.35),
  );
  const key = new THREE.DirectionalLight(VISUAL.keyLight, 1.55);
  key.position.set(-3, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(VISUAL.rimLight, 1.2);
  rim.position.set(4, 2, -3);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffd5a0, 5, 12, 2);
  warm.position.set(2.4, 1.4, -1.5);
  scene.add(warm);

  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 45),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=vUv*4.;float n=noise(p+vec2(uTime*.008,0.));n+=.5*noise(p*2.2-vec2(0.,uTime*.006));float a=exp(-length((vUv-vec2(.58,.64))*vec2(1.1,1.5))*3.);
      vec3 col=mix(vec3(.014,.016,.020),vec3(.085,.078,.071),clamp(n*.35+a*.2,0.,1.));gl_FragColor=vec4(col,1.);}`,
      depthWrite: false,
    }),
  );
  mist.position.z = -12;
  scene.add(mist);

  function surface(t, s) {
    const width = Math.pow(Math.sin(Math.PI * t), 0.72) * (0.54 + 0.14 * t);
    return new THREE.Vector3(
      s * width + Math.sin(t * 2.7) * 0.13,
      t * 3.25,
      0.29 * s * s * Math.sin(Math.PI * t) +
        Math.sin(t * 4.9) * 0.47 +
        t * t * 0.46,
    );
  }
  const position = [],
    uvs = [],
    color = [],
    indices = [];
  const nx = 18,
    ny = 50;
  const bottom = new THREE.Color("#d6a05a"),
    top = new THREE.Color("#ffdc8e"),
    coolTint = new THREE.Color("#c7d1df"),
    peachTint = new THREE.Color("#f4bca9"),
    c = new THREE.Color();
  for (let y = 0; y <= ny; y++)
    for (let x = 0; x <= nx; x++) {
      const t = 0.004 + (y / ny) * 0.992,
        s = (x / nx) * 2 - 1,
        p = surface(t, s);
      p.z += Math.cos(s * 19) * 0.002 * Math.sin(t * Math.PI);
      position.push(p.x, p.y, p.z);
      uvs.push(x / nx, y / ny);
      c.copy(bottom)
        .lerp(top, Math.pow(t, 0.45))
        .multiplyScalar(1 - Math.abs(s) * 0.08);
      // Restrained peach / mist-blue edge color keeps the warm sunflower identity.
      c.lerp(coolTint, 0.16 * (0.5 - s * 0.5) * ease(0.18, 0.9, t));
      c.lerp(peachTint, 0.18 * (0.5 + s * 0.5) * Math.sin(t * Math.PI));
      color.push(c.r, c.g, c.b);
      if (y < ny && x < nx) {
        const a = y * (nx + 1) + x,
          b = a + nx + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(position, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0,
    roughness: 0.88,
    sheen: 0.7,
    sheenRoughness: 1,
    sheenColor: new THREE.Color("#f8e0da"),
    emissive: new THREE.Color("#e6b96b"),
    emissiveIntensity: 0.36,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Fade each curved petal's contour in its own UV space; text and scene stay sharp.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 vPetalUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvPetalUv = uv;",
    );
    shader.fragmentShader = "varying vec2 vPetalUv;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float contour = smoothstep(0.0, 0.28, 1.0 - abs(vPetalUv.x * 2.0 - 1.0));
      float ends = smoothstep(0.0, 0.14, vPetalUv.y) * smoothstep(0.0, 0.14, 1.0 - vPetalUv.y);
      diffuseColor.a *= mix(0.035, 1.0, contour * ends);
    `,
    );
  };
  material.customProgramCacheKey = () => "silk-petal-soft-contour-v1";
  const sculpture = new THREE.Group();
  const petals = [];
  for (let i = 0; i < 19; i++) {
    const a = (i / 19) * Math.PI * 2;
    const petal = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    petal.add(mesh);
    petal.position.set(
      -Math.sin(a) * 0.63,
      Math.cos(a) * 0.63,
      (i % 2) * -0.16,
    );
    petal.rotation.set(
      0.14 + Math.sin(i * 2.5) * 0.26,
      Math.cos(i * 1.9) * 0.22,
      a,
    );
    petal.scale.set(0.72 + (i % 3) * 0.11, 0.8 + (i % 4) * 0.06, 1);
    petals.push(petal);
    sculpture.add(petal);
  }
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 20),
    new THREE.MeshStandardMaterial({
      color: 0xffefdb,
      emissive: 0xffd3a0,
      emissiveIntensity: 2.6,
      metalness: 0,
      roughness: 1,
    }),
  );
  core.position.z = 0.42;
  sculpture.add(core);
  sculpture.rotation.set(-0.24, -0.38, -0.28);
  scene.add(sculpture);

  // Detached macro petals add depth without obscuring the headline.
  const satellites = [];
  for (const [x, y, z, r, scale] of [
    [-4.3, 2.1, 2.5, -1.3, 0.58],
    [5.8, -2.9, 2, 0.8, 0.75],
    [5.6, 3.5, -2, 1.8, 0.37],
  ]) {
    const p = new THREE.Mesh(geometry, material);
    p.position.set(x, y, z);
    p.rotation.set(0.6, 0.9, r);
    p.scale.setScalar(scale);
    scene.add(p);
    satellites.push(p);
  }

  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = spriteCanvas.height = 128;
  const ctx = spriteCanvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,247,230,1)");
  gradient.addColorStop(0.15, "rgba(255,230,190,.72)");
  gradient.addColorStop(0.48, "rgba(255,209,162,.2)");
  gradient.addColorStop(1, "rgba(255,209,162,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(spriteCanvas);
  const heartPositions = [];
  const scatter = (value) => {
    const n = Math.sin(value) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < 280; i++) {
    const r = Math.sqrt(scatter(i * 12.9898 + 1)) * 0.67,
      a = scatter(i * 78.233 + 3) * Math.PI * 2;
    heartPositions.push(
      Math.cos(a) * r,
      Math.sin(a) * r,
      0.08 + Math.sqrt(Math.max(0, 1 - (r / 0.75) ** 2)) * 0.23,
    );
  }
  const heart = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(heartPositions, 3),
    ),
    new THREE.PointsMaterial({
      map: texture,
      size: 0.11,
      color: 0xf7d8a0,
      opacity: 0.24,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sculpture.add(heart);
  const centerGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: 0xffd9ad,
      opacity: 0.6,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  centerGlow.position.z = 0.44;
  centerGlow.scale.setScalar(1.5);
  sculpture.add(centerGlow);
  const sunVeil = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: 0xffd3b2,
      opacity: 0.38,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sunVeil.position.set(2.4, 1.3, -3.2);
  sunVeil.scale.setScalar(13.5);
  scene.add(sunVeil);
  // Soft foreground glints provide near/far separation without a global CSS blur.
  for (const [x, y, z, scale] of [
    [-4.6, -2.4, 5, 1.5],
    [4.8, -2.8, 5.5, 2.2],
    [6.4, 2.8, 3, 1.1],
  ]) {
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: 0xe9d4b0,
        opacity: 0.16,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.set(x, y, z);
    halo.scale.setScalar(scale);
    scene.add(halo);
  }
  const dustPositions = [];
  let seed = 2026;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 1600; i++)
    dustPositions.push(
      (random() - 0.5) * 21,
      (random() - 0.5) * 13,
      (random() - 0.5) * 11,
    );
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(dustPositions, 3),
  );
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      map: texture,
      size: 0.065,
      opacity: 0.64,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffdfaa,
    }),
  );
  scene.add(dust);
  const halos = [];
  for (let i = 0; i < 14; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: 0xf9dba0,
        transparent: true,
        opacity: 0.06 + random() * 0.08,
        depthWrite: false,
      }),
    );
    sprite.position.set(
      (random() - 0.5) * 19,
      (random() - 0.5) * 12,
      random() * 6,
    );
    sprite.scale.setScalar(0.5 + random() * 1.4);
    scene.add(sprite);
    halos.push(sprite);
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = new THREE.Vector2(),
    smoothed = new THREE.Vector2();
  const focusPoint = new THREE.Vector3(),
    destination = new THREE.Vector3(),
    lookTarget = new THREE.Vector3();
  const center = new THREE.Vector2();
  let shot = {
    travel: 0,
    focusDistance: 15,
    maxBlur: 0,
    depthEnabled: false,
    cameraZ: 15,
  };
  window.addEventListener(
    "pointermove",
    (e) =>
      pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5),
    { passive: true },
  );
  return {
    get shot() {
      return { ...shot };
    },
    render(time, travel = 0, { offscreen = false, depth = false } = {}) {
      const t = reducedMotion.matches ? 0 : time;
      const mobile = innerWidth < 680;
      camera.aspect = innerWidth / innerHeight;
      camera.position.set(0, 0, mobile ? 19.8 : 15);
      smoothed.lerp(
        reducedMotion.matches ? new THREE.Vector2() : pointer,
        0.035,
      );
      sculpture.position.set(mobile ? 0.45 : 2.3, mobile ? 2.55 : 0.75, 0);
      sculpture.scale.setScalar(mobile ? 0.86 : 1.04);
      sculpture.rotation.y =
        -0.58 + Math.sin(t * 0.12) * 0.1 + smoothed.x * 0.12;
      sculpture.rotation.x =
        -0.34 + Math.cos(t * 0.15) * 0.06 + smoothed.y * 0.1;
      sculpture.rotation.z = -0.28 + Math.sin(t * 0.08) * 0.06;
      petals.forEach((p, i) => {
        p.rotation.x =
          0.14 + Math.sin(i * 2.5) * 0.26 + Math.sin(t * 0.23 + i) * 0.04;
        p.rotation.y = Math.cos(i * 1.9) * 0.22 + Math.sin(t * 0.21 + i) * 0.05;
        p.rotation.z =
          (i / 19) * Math.PI * 2 + Math.sin(t * 0.17 + i * 1.7) * 0.015;
      });
      satellites.forEach(
        (p, i) => (p.rotation.y = 0.9 + Math.sin(t * 0.19 + i) * 0.17),
      );
      dust.rotation.y = t * 0.012;
      dust.position.y = Math.sin(t * 0.1) * 0.15;
      mist.material.uniforms.uTime.value = t;
      core.material.emissiveIntensity = 2.2 + Math.sin(t * 0.6) * 0.2;
      centerGlow.material.opacity = 0.56 + Math.sin(t * 0.5) * 0.04;
      sunVeil.material.opacity = 0.37 + Math.sin(t * 0.15) * 0.012;
      scene.updateMatrixWorld(true);
      core.getWorldPosition(focusPoint);
      const approach = ease(0, 0.78, travel);
      destination.copy(focusPoint).add(new THREE.Vector3(0, 0, 0.62));
      camera.position.lerp(destination, approach);
      lookTarget.set(0, 0, 0).lerp(focusPoint, approach);
      camera.lookAt(lookTarget);
      camera.fov = 37 + approach * 6;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const projected = focusPoint.clone().project(camera);
      center.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
      const focusDistance = camera.position.distanceTo(focusPoint);
      const lens = Math.max(
        0.18 * (1 - ease(0, 0.2, travel)),
        ease(0.03, 0.28, travel) * (1 - ease(0.78, 1, travel)),
      );
      const useDepth = depth || !reducedMotion.matches;
      depthOfField.uniforms.focus.value = focusDistance;
      depthOfField.uniforms.aperture.value = lens * 0.007;
      depthOfField.uniforms.maxblur.value = lens * 0.026;
      shot = {
        travel,
        focusDistance,
        maxBlur: lens * 0.026,
        depthEnabled: useDepth,
        cameraZ: camera.position.z,
      };
      const oldScene = renderPass.scene,
        oldCamera = renderPass.camera;
      const oldExposure = renderer.toneMappingExposure,
        oldStrength = bloom.strength,
        oldThreshold = bloom.threshold;
      const oldOutput = composer.renderToScreen,
        oldDepth = depthOfField.enabled;
      try {
        renderer.toneMappingExposure = VISUAL.exposure;
        bloom.strength = VISUAL.bloom.strength + ease(0.3, 0.7, travel) * 0.06;
        bloom.threshold = VISUAL.bloom.threshold;
        composer.renderToScreen = !offscreen;
        depthOfField.enabled = useDepth;
        renderPass.scene = scene;
        renderPass.camera = camera;
        composer.render();
      } finally {
        renderPass.scene = oldScene;
        renderPass.camera = oldCamera;
        renderer.toneMappingExposure = oldExposure;
        bloom.strength = oldStrength;
        bloom.threshold = oldThreshold;
        composer.renderToScreen = oldOutput;
        depthOfField.enabled = oldDepth;
      }
      return { texture: composer.readBuffer.texture, center };
    },
  };
}

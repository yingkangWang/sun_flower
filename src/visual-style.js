import * as THREE from "three";

// One palette and exposure for the macro opening, live field and portrait export.
export const VISUAL = Object.freeze({
  background: "#252b32",
  exposure: 1.08,
  champagne: "#f4cc79",
  peach: "#f5c6a5",
  mistBlue: "#d0d9df",
  keyLight: "#ffe0b5",
  ambientLight: "#fff0d9",
  shadowLight: "#4b4643",
  rimLight: "#f1d1ad",
  petal: "#ffdda0",
  seed: "#b7a17c",
  leaf: "#728779",
  bloom: Object.freeze({ strength: 0.26, radius: 0.55, threshold: 1.35 }),
});

export function addGardenAtmosphere(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d"),
    gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,.75)");
  gradient.addColorStop(0.35, "rgba(255,255,255,.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas),
    sprites = [];
  for (const [color, x, y, z, size, opacity] of [
    [VISUAL.peach, 3.5, 1.6, -9, 19, 0.23],
    [VISUAL.champagne, -5, -1.5, -8, 15, 0.085],
  ]) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(size);
    scene.add(sprite);
    sprites.push({ material, opacity });
  }
  return {
    update(reveal) {
      sprites.forEach(
        ({ material, opacity }) =>
          (material.opacity = opacity * (1 - reveal * 0.32)),
      );
    },
  };
}

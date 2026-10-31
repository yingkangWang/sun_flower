import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { VISUAL } from "./visual-style.js";
// 曲茎、叶柄、折面锯齿叶、叶脉及花盘种子均是几何细节。
export function addPlantDetail(group, beds, material) {
  const stemMat = material("#758372"),
    leafMat = material(VISUAL.leaf),
    veinMat = material("#a8b49b"),
    seedMat = material(VISUAL.seed),
    calyxMat = material("#647b6c");
  // 纵向沟纹与叶片明暗不依赖贴图或外部素材。
  const originalStem = stemMat.onBeforeCompile;
  stemMat.onBeforeCompile = (s) => {
    originalStem(s);
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb*=.85+.15*sin(atan(vFlowerPos.z,vFlowerPos.x)*19.+vFlowerPos.y*1.5);",
    );
  };
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, -3.9, -0.07),
    new THREE.Vector3(0.08, -2.7, -0.08),
    new THREE.Vector3(-0.06, -1.5, -0.07),
    new THREE.Vector3(0, -0.35, -0.06),
    new THREE.Vector3(0, 0, 0),
  ]);
  const stemG = new THREE.TubeGeometry(stemCurve, 48, 0.032, 12, false),
    stems = new THREE.InstancedMesh(stemG, stemMat, beds.length);
  const vertices = [],
    uv = [],
    indices = [],
    nx = 30,
    ny = 12;
  function leafPoint(u, v) {
    const width =
      0.43 *
      Math.pow(Math.sin(Math.PI * u), 0.8) *
      (1 + 0.045 * Math.sin(u * 30 * Math.PI));
    return new THREE.Vector3(
      u * 1.28,
      v * width,
      0.16 * Math.sin(Math.PI * u) * (1 - 0.65 * v * v) - 0.035 * u,
    );
  }
  for (let j = 0; j <= nx; j++)
    for (let k = 0; k <= ny; k++) {
      const p = leafPoint(j / nx, (k / ny) * 2 - 1);
      vertices.push(p.x, p.y, p.z);
      uv.push(j / nx, k / ny);
    }
  for (let j = 0; j < nx; j++)
    for (let k = 0; k < ny; k++) {
      const a = j * (ny + 1) + k,
        b = a + ny + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const leafG = new THREE.BufferGeometry();
  leafG.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  leafG.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  leafG.setIndex(indices);
  leafG.computeVertexNormals();
  const leafCount = beds.length * 3,
    leaves = new THREE.InstancedMesh(leafG, leafMat, leafCount);
  const veinParts = [];
  veinParts.push(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        Array.from({ length: 13 }, (_, i) =>
          leafPoint(i / 12, 0).add(new THREE.Vector3(0, 0, 0.008)),
        ),
      ),
      12,
      0.009,
      5,
      false,
    ),
  );
  for (let i = 1; i < 8; i++)
    for (let side of [-1, 1]) {
      const u = i / 10;
      const pts = [
        leafPoint(u, 0),
        leafPoint(u + 0.05, side * 0.42),
        leafPoint(Math.min(0.97, u + 0.14), side * 0.88),
      ].map((p) => p.add(new THREE.Vector3(0, 0, 0.009)));
      veinParts.push(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(pts),
          6,
          0.0038,
          4,
          false,
        ),
      );
    }
  const veins = new THREE.InstancedMesh(
    mergeGeometries(veinParts),
    veinMat,
    leafCount,
  );
  veinParts.forEach((g) => g.dispose());
  const petioleG = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.21, -0.11, -0.035),
        new THREE.Vector3(-0.1, -0.045, -0.01),
        new THREE.Vector3(0, 0, 0),
      ]),
      8,
      0.018,
      6,
      false,
    ),
    petioles = new THREE.InstancedMesh(petioleG, stemMat, leafCount);
  const seedCount = 800,
    seeds = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 7, 5),
      seedMat,
      beds.length * seedCount,
    );
  const calyx = new THREE.InstancedMesh(leafG, calyxMat, beds.length * 10),
    dummy = new THREE.Object3D(),
    head = new THREE.Object3D(),
    color = new THREE.Color();
  const vector = new THREE.Vector3(),
    world = new THREE.Matrix4();
  let leafIndex = 0,
    seedIndex = 0;
  beds.forEach(([x, y, scale, z], n) => {
    dummy.position.set(x, y, z - 0.08);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    stems.setMatrixAt(n, dummy.matrix);
    for (let j = 0; j < 3; j++) {
      const side = (j + n) % 2 === 0 ? 1 : -1,
        height = -1.05 - j * 0.86,
        root = stemCurve.getPoint(1 - Math.abs(height) / 3.9);
      dummy.position.set(
        x + scale * (root.x + side * 0.2),
        y + height * scale,
        z + 0.025 * scale,
      );
      dummy.rotation.set(
        -0.22,
        side === 1 ? 0 : Math.PI,
        side === 1 ? 0.43 : -0.43,
      );
      dummy.scale.setScalar(scale * (1 - j * 0.1));
      dummy.updateMatrix();
      leaves.setMatrixAt(leafIndex, dummy.matrix);
      veins.setMatrixAt(leafIndex, dummy.matrix);
      petioles.setMatrixAt(leafIndex, dummy.matrix);
      leafIndex++;
    }
    head.position.set(x, y, z + 0.08);
    head.rotation.set(Math.sin(n * 3.7) * 0.18, 0, 0);
    head.scale.setScalar(scale);
    head.updateMatrix();
    for (let j = 0; j < seedCount; j++) {
      const f = (j + 0.5) / seedCount,
        r = 0.474 * Math.sqrt(f),
        a = j * 2.3999632297;
      vector.set(
        Math.cos(a) * r,
        Math.sin(a) * r,
        0.15 * Math.sqrt(1 - (r / 0.49) ** 2) + 0.009,
      );
      dummy.position.copy(vector);
      dummy.rotation.set(0, 0, a - 0.4);
      const size = 0.0105 + 0.0038 * Math.sqrt(f);
      dummy.scale.set(size * 0.76, size, size * 0.64);
      dummy.updateMatrix();
      world.multiplyMatrices(head.matrix, dummy.matrix);
      seeds.setMatrixAt(seedIndex, world);
      color.setHSL(
        0.105 + (j % 5) * 0.003,
        0.27 + (j % 3) * 0.04,
        0.19 + Math.sqrt(f) * 0.15 + (j % 4) * 0.025,
      );
      seeds.setColorAt(seedIndex, color);
      seedIndex++;
    }
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2;
      dummy.position.set(
        x - Math.sin(a) * scale * 0.22,
        y + Math.cos(a) * scale * 0.22,
        z - 0.13 * scale,
      );
      dummy.rotation.set(0.2, 0, a + Math.PI / 2);
      dummy.scale.setScalar(scale * 0.38);
      dummy.updateMatrix();
      calyx.setMatrixAt(n * 10 + j, dummy.matrix);
    }
  });
  group.add(stems, petioles, leaves, veins, seeds, calyx);
  return { seeds: seedCount * beds.length, leaves: leafCount };
}

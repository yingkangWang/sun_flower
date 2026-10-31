import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
// 直接采样当前植物曲面及实例矩阵。局部坐标还决定表面淡出与点粒子脱离的时刻。
export function sampleBotanical(group, count, random) {
  group.updateMatrixWorld(true);
  const candidates = [],
    cache = new Map();
  let total = 0;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    matrix = new THREE.Matrix4(),
    scale = new THREE.Vector3();
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let data = cache.get(mesh.geometry);
    if (!data) {
      const g = mesh.geometry,
        p = g.attributes.position,
        idx = g.index;
      let area = 0;
      for (let i = 0; i < (idx ? idx.count : p.count); i += 3) {
        a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
        b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
        c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
        area += b.sub(a).cross(c.sub(a)).length() * 0.5;
      }
      data = {
        area,
        sampler: new MeshSurfaceSampler(mesh)
          .setRandomGenerator(random)
          .build(),
      };
      cache.set(g, data);
    }
    const n = mesh.isInstancedMesh ? mesh.count : 1;
    for (let i = 0; i < n; i++) {
      if (mesh.isInstancedMesh) mesh.getMatrixAt(i, matrix);
      else matrix.identity();
      matrix.premultiply(mesh.matrixWorld);
      scale.setFromMatrixScale(matrix);
      const factor =
        (scale.x * scale.y + scale.y * scale.z + scale.x * scale.z) / 3;
      total += data.area * factor;
      const col = mesh.material.color.clone();
      if (mesh.instanceColor) {
        mesh.getColorAt(i, c);
        col.multiply(new THREE.Color(c.x, c.y, c.z));
      }
      candidates.push({
        end: total,
        matrix: matrix.clone(),
        sampler: data.sampler,
        color: col,
      });
    }
  });
  const positions = [],
    colors = [],
    sizes = [],
    detach = [];
  const local = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const r = random() * total;
    let lo = 0,
      hi = candidates.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (candidates[mid].end < r) lo = mid + 1;
      else hi = mid;
    }
    const entry = candidates[lo];
    entry.sampler.sample(local);
    // 与botanical.js着色器相同的局部空间格点阈值，避免不同步的随机消失。
    local.applyMatrix4(entry.matrix);
    const raw =
      Math.floor(local.x * 140) * 17 +
      Math.floor(local.y * 140) * 59 +
      Math.floor(local.z * 140) * 101;
    const h = ((raw % 997) + 997) % 997;
    detach.push(((h * h * 7 + h * 13) % 997) / 997);
    positions.push(local.x, local.y, local.z);
    colors.push(entry.color.r, entry.color.g, entry.color.b);
    sizes.push(0.7 + random() * 0.7);
  }
  return { positions, colors, sizes, detach };
}

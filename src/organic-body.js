import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
// 用关节中心定义肢体轴线，再对有符号距离场做平滑并集。
// 输出连续表面，肩/肘/髋/膝不再靠相交球体遮挡接缝。
function ellipsoid(x, y, z, c, r) {
  const dx = (x - c[0]) / r[0],
    dy = (y - c[1]) / r[1],
    dz = (z - c[2]) / r[2],
    k0 = Math.hypot(dx, dy, dz),
    k1 = Math.hypot(dx / r[0], dy / r[1], dz / r[2]);
  return k1 < 1e-7 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}
function capsule(x, y, z, a, b, ra, rb) {
  const ba = b.map((v, i) => v - a[i]),
    pa = [x - a[0], y - a[1], z - a[2]],
    t = THREE.MathUtils.clamp(
      (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) /
        (ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2),
      0,
      1,
    );
  return (
    Math.hypot(pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2] - ba[2] * t) -
    (ra + (rb - ra) * t)
  );
}
function smoothMin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function surface(sample, min, max, resolution = 58) {
  const mc = new MarchingCubes(
    resolution,
    new THREE.MeshBasicMaterial(),
    false,
    false,
    100000,
  );
  mc.isolation = 0;
  for (let z = 0; z < resolution; z++)
    for (let y = 0; y < resolution; y++)
      for (let x = 0; x < resolution; x++) {
        const px = min[0] + ((max[0] - min[0]) * x) / resolution,
          py = min[1] + ((max[1] - min[1]) * y) / resolution,
          pz = min[2] + ((max[2] - min[2]) * z) / resolution;
        mc.field[x + resolution * (y + resolution * z)] = -sample(px, py, pz);
      }
  mc.update();
  const count = mc.geometry.drawRange.count;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      mc.geometry.attributes.position.array.slice(0, count * 3),
      3,
    ),
  );
  // MC输出坐标[-1,1]，映射回身体局部空间。
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++)
    pos.setXYZ(
      i,
      min[0] + (pos.getX(i) + 1) * 0.5 * (max[0] - min[0]),
      min[1] + (pos.getY(i) + 1) * 0.5 * (max[1] - min[1]),
      min[2] + (pos.getZ(i) + 1) * 0.5 * (max[2] - min[2]),
    );
  const smooth = mergeVertices(geometry, 1e-5);
  smooth.computeVertexNormals();
  geometry.dispose();
  mc.geometry.dispose();
  mc.material.dispose();
  return smooth;
}
export function createOrganicBody(material, skin) {
  const joints = {
    left: {
      shoulder: [-0.3, -0.51, -0.01],
      elbow: [-0.57, -0.65, 0.04],
      wrist: [-0.73, -0.41, 0.23],
    },
    right: {
      shoulder: [0.3, -0.51, -0.01],
      elbow: [0.44, -0.74, 0.015],
      wrist: [0.52, -0.88, 0.08],
    },
  };
  const sdf = (x, y, z) => {
    let d = ellipsoid(x, y, z, [0, -0.81, -0.015], [0.46, 0.45, 0.32]);
    d = smoothMin(
      d,
      ellipsoid(x, y, z, [0, -0.41, -0.02], [0.22, 0.13, 0.21]),
      0.12,
    );
    for (const limb of Object.values(joints)) {
      d = smoothMin(
        d,
        capsule(x, y, z, limb.shoulder, limb.elbow, 0.145, 0.125),
        0.18,
      );
      d = smoothMin(
        d,
        capsule(x, y, z, limb.elbow, limb.wrist, 0.125, 0.1),
        0.15,
      );
    }
    for (const side of [-1, 1]) {
      const hip = [side * 0.18, -1.08, -0.015],
        knee = [side * 0.2, -1.23, 0.025],
        ankle = [side * 0.2, -1.33, 0.035];
      d = smoothMin(d, capsule(x, y, z, hip, knee, 0.19, 0.16), 0.095);
      d = smoothMin(d, capsule(x, y, z, knee, ankle, 0.16, 0.15), 0.07);
      d = smoothMin(
        d,
        ellipsoid(x, y, z, [side * 0.2, -1.33, 0.07], [0.18, 0.1, 0.22]),
        0.055,
      );
    }
    // 温和压平脚底，两脚共用站立平面。
    return Math.max(d, -1.435 - y);
  };
  const body = new THREE.Mesh(
    surface(sdf, [-1.15, -1.73, -0.55], [1.05, -0.07, 0.7], 66),
    material,
  );
  body.name = "continuous-suit-body";
  const hands = [];
  // 左手手掌沿抬起的前臂轴线接入袖口，向上承托；拇指与指腹融合为软手型。
  const left = (x, y, z) => {
    let d = ellipsoid(x, y, z, [-0.76, -0.315, 0.27], [0.13, 0.085, 0.12]);
    d = smoothMin(
      d,
      capsule(x, y, z, [-0.73, -0.42, 0.23], [-0.76, -0.32, 0.27], 0.087, 0.1),
      0.04,
    );
    d = smoothMin(
      d,
      ellipsoid(x, y, z, [-0.65, -0.3, 0.3], [0.05, 0.06, 0.055]),
      0.04,
    );
    return d;
  };
  const right = (x, y, z) => {
    let d = ellipsoid(x, y, z, [0.54, -0.95, 0.095], [0.1, 0.12, 0.1]);
    d = smoothMin(
      d,
      capsule(x, y, z, [0.52, -0.88, 0.08], [0.54, -0.97, 0.095], 0.09, 0.095),
      0.025,
    );
    d = smoothMin(
      d,
      ellipsoid(x, y, z, [0.47, -0.94, 0.14], [0.055, 0.075, 0.05]),
      0.03,
    );
    return d;
  };
  hands.push(
    new THREE.Mesh(
      surface(left, [-1.1, -0.52, 0.04], [-0.6, -0.1, 0.51], 38),
      skin,
    ),
    new THREE.Mesh(
      surface(right, [0.39, -1.25, -0.1], [0.84, -0.8, 0.31], 38),
      skin,
    ),
  );
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: "#245f9c",
    roughness: 0.87,
  });
  const accents = [];
  for (const limb of Object.values(joints)) {
    const axis = new THREE.Vector3(...limb.wrist)
        .sub(new THREE.Vector3(...limb.elbow))
        .normalize(),
      a = new THREE.Vector3(0, 0, 1).cross(axis).normalize(),
      b = axis.clone().cross(a).normalize(),
      center = new THREE.Vector3(...limb.wrist).addScaledVector(axis, -0.015);
    const points = Array.from({ length: 41 }, (_, i) =>
      center
        .clone()
        .addScaledVector(a, Math.cos((i / 40) * Math.PI * 2) * 0.102)
        .addScaledVector(b, Math.sin((i / 40) * Math.PI * 2) * 0.102),
    );
    const cuff = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        40,
        0.004,
        5,
        false,
      ),
      detailMaterial,
    );
    cuff.userData.noSample = true;
    accents.push(cuff);
  }
  return { body, hands, joints, accents, detailMaterial };
}

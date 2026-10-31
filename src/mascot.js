import * as THREE from "three";
import { createOrganicBody } from "./organic-body.js";
// 按用户三张参考重建：双层葵瓣、连续桃色面部、黑亮椭圆眼、短蓝衣与桃色手。
export function createMascot() {
  const group = new THREE.Group();
  group.position.set(0, -0.25, 0.8);
  group.scale.setScalar(1.85);
  group.rotation.y = -0.08;
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  const blue = mat("#3477b8"),
    hood = mat("#5297c5"),
    gold = mat("#f1ce7b"),
    backGold = mat("#d5ad68"),
    skin = mat("#ffe0ce"),
    black = mat("#13191e"),
    mouthMat = mat("#d3544b"),
    tongueMat = mat("#ed7b6c"),
    white = mat("#ffffff");
  const materials = [
    blue,
    hood,
    gold,
    backGold,
    skin,
    black,
    mouthMat,
    tongueMat,
    white,
  ];
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  function orb(material, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(sphere, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    group.add(m);
    return m;
  }
  const anatomy = createOrganicBody(blue, skin);
  group.add(anatomy.body, ...anatomy.hands, ...anatomy.accents);
  materials.push(anatomy.detailMaterial);
  // 双层圆钝花瓣有前后层次，尖端略收，顶层更大。
  for (let layer = 0; layer < 2; layer++) {
    const count = layer === 0 ? 12 : 9;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (layer === 0 ? 0.12 : 0),
        r = layer === 0 ? 0.83 : 0.81;
      const petal = orb(
        layer === 0 ? backGold : gold,
        Math.sin(a) * r,
        0.45 + Math.cos(a) * r,
        layer === 0 ? -0.2 : -0.09,
        0.245,
        layer === 0 ? 0.34 : 0.43,
        0.16,
      );
      petal.rotation.z = -a;
    }
  }
  orb(hood, 0, 0.44, 0.015, 0.83, 0.78, 0.31);
  // 贝塞尔曲线构成一整块脸型。额头起伏嵌入轮廓，不再叠四个球。
  const face = new THREE.Shape();
  face.moveTo(0, 1.04);
  face.bezierCurveTo(0.14, 1.03, 0.2, 0.88, 0.36, 0.91);
  face.bezierCurveTo(0.53, 0.94, 0.62, 0.79, 0.65, 0.64);
  face.bezierCurveTo(0.68, 0.43, 0.76, 0.24, 0.61, 0.06);
  face.bezierCurveTo(0.46, -0.09, 0.23, -0.12, 0, -0.12);
  face.bezierCurveTo(-0.23, -0.12, -0.46, -0.09, -0.61, 0.06);
  face.bezierCurveTo(-0.76, 0.24, -0.68, 0.43, -0.65, 0.64);
  face.bezierCurveTo(-0.62, 0.79, -0.53, 0.94, -0.36, 0.91);
  face.bezierCurveTo(-0.2, 0.88, -0.14, 1.03, 0, 1.04);
  const faceMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(face, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.035,
      bevelSegments: 5,
      steps: 1,
      curveSegments: 32,
    }),
    skin,
  );
  faceMesh.position.set(0, 0, 0.3);
  group.add(faceMesh);
  orb(black, -0.235, 0.51, 0.407, 0.059, 0.134, 0.026);
  orb(black, 0.235, 0.51, 0.407, 0.059, 0.134, 0.026);
  orb(white, -0.249, 0.564, 0.435, 0.025, 0.035, 0.008);
  orb(white, 0.221, 0.564, 0.435, 0.025, 0.035, 0.008);
  orb(white, -0.221, 0.454, 0.433, 0.008, 0.013, 0.006);
  orb(white, 0.25, 0.454, 0.433, 0.008, 0.013, 0.006);
  const smile = new THREE.Shape();
  smile.moveTo(-0.18, 0.26);
  smile.bezierCurveTo(-0.08, 0.21, 0.08, 0.21, 0.18, 0.26);
  smile.bezierCurveTo(0.24, 0.05, -0.24, 0.05, -0.18, 0.26);
  const mouth = new THREE.Mesh(new THREE.ShapeGeometry(smile, 32), mouthMat);
  mouth.position.z = 0.412;
  group.add(mouth);
  const tongue = new THREE.Shape();
  tongue.moveTo(-0.1, 0.11);
  tongue.quadraticCurveTo(0, 0.18, 0.1, 0.11);
  tongue.quadraticCurveTo(0, 0.055, -0.1, 0.11);
  const tm = new THREE.Mesh(new THREE.ShapeGeometry(tongue), tongueMat);
  tm.position.z = 0.416;
  group.add(tm);
  // Canvas只生成腮红渐变纹理，不依赖外部图片。
  const cc = document.createElement("canvas");
  cc.width = cc.height = 128;
  const cx = cc.getContext("2d"),
    gradient = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(244,139,118,.50)");
  gradient.addColorStop(1, "rgba(244,139,118,0)");
  cx.fillStyle = gradient;
  cx.fillRect(0, 0, 128, 128);
  const cheekMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cc),
    transparent: true,
    depthWrite: false,
  });
  materials.push(cheekMat);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.29), cheekMat);
    cheek.position.set(side * 0.42, 0.28, 0.407);
    cheek.userData.noSample = true;
    group.add(cheek);
  }
  const lightMat = new THREE.MeshStandardMaterial({
    color: "#fff1bf",
    emissive: "#ffc665",
    emissiveIntensity: 2.1,
    roughness: 0.32,
  });
  materials.push(lightMat);
  const lightSeed = orb(lightMat, -0.76, -0.12, 0.27, 0.065, 0.1, 0.065);
  lightSeed.rotation.z = -0.12;
  const lamp = new THREE.PointLight(0xffd795, 1.3, 3);
  lamp.position.set(-0.76, 0.06, 1);
  group.add(lamp);
  // 连续躯干固定在托光姿态；点云采样同一终点表面，避免最后跳位。
  const initial = group.children.filter((m) => m.isMesh);
  initial.forEach((m) => {
    m.userData.baseOpacity = m.material === cheekMat ? 0.85 : 1;
  });
  return {
    group,
    materials,
    lamp,
    lightMat,
    lightSeed,
    joints: anatomy.joints,
  };
}

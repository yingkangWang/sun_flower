import * as THREE from "three";
import { addPlantDetail } from "./plant-detail.js";
import { VISUAL } from "./visual-style.js";
// 同一花形的曲面复用到实例中：少量绘制调用提供清晰轮廓与柔和光照。
export function createBotanical(beds) {
  const group = new THREE.Group(),
    uniform = { value: 0 },
    time = { value: 0 };
  function material(color) {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.uDissolve = uniform;
      s.uniforms.uBotanicalTime = time;
      s.vertexShader =
        "uniform float uBotanicalTime;\nvarying vec3 vFlowerPos;varying vec3 vDissolvePos;\n" +
        s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFlowerPos=position;\n#ifdef USE_INSTANCING\nvDissolvePos=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;\n#else\nvDissolvePos=(modelMatrix*vec4(position,1.)).xyz;\n#endif",
      );
      s.fragmentShader =
        "uniform float uDissolve;\nvarying vec3 vFlowerPos;varying vec3 vDissolvePos;\n" +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nvec3 cell=floor(vDissolvePos*140.0);float h=mod(dot(cell,vec3(17.,59.,101.)),997.);float grain=mod(h*h*7.+h*13.,997.)/997.;float fade=smoothstep(grain-.06,grain+.06,uDissolve);if(fade>.995)discard;",
      );
      s.fragmentShader = s.fragmentShader.replace(
        "#include <opaque_fragment>",
        "diffuseColor.a*=1.-fade;\n#include <opaque_fragment>",
      );
    };
    return m;
  }
  const petalMat = material(VISUAL.petal),
    diskMat = material("#8c7860"),
    greenMat = material(VISUAL.leaf);
  const petalCompile = petalMat.onBeforeCompile;
  petalMat.onBeforeCompile = (shader) => {
    petalCompile(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float t=clamp((vFlowerPos.y-.44)/1.04,0.,1.);
      float side=clamp(vFlowerPos.x/.2,-1.,1.);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.66,.60),.075*(.5+.5*side)*sin(t*3.14159));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.59,.72,.87),.055*(.5-.5*side)*t);
    `,
    );
  };
  petalMat.customProgramCacheKey = () => "champagne-field-petal-v1";
  const vertices = [],
    uv = [],
    indices = [];
  const nu = 10,
    nv = 22;
  for (let j = 0; j <= nv; j++) {
    const t = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1;
      vertices.push(
        u * 0.2 * Math.pow(Math.sin(Math.PI * t), 0.72),
        0.44 + t * 1.04,
        Math.sin(t * Math.PI) * 0.15 + u * u * 0.075 - t * t * 0.13,
      );
      uv.push(i / nu, t);
    }
  }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i,
        b = a + nu + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  pg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  pg.setIndex(indices);
  pg.computeVertexNormals();
  const petals = new THREE.InstancedMesh(pg, petalMat, beds.length * 44),
    disks = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 32, 20),
      diskMat,
      beds.length,
    ),
    stems = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.025, 0.035, 3.6, 8),
      greenMat,
      beds.length,
    );
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.2, 0.6, 0.9, 0.7, 1.35, 0.4);
  leafShape.bezierCurveTo(1.0, -0.25, 0.4, -0.2, 0, 0);
  const leaves = new THREE.InstancedMesh(
    new THREE.ShapeGeometry(leafShape, 20),
    greenMat,
    beds.length * 2,
  );
  const dummy = new THREE.Object3D(),
    baseMatrices = [];
  let k = 0;
  beds.forEach(([x, y, s, z], n) => {
    const tilt = Math.sin(n * 3.7) * 0.18;
    for (let layer = 0; layer < 2; layer++) {
      const count = layer ? 20 : 24;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.1;
        dummy.position.set(x, y, z);
        dummy.rotation.set(tilt, 0.1 * Math.cos(n), angle);
        dummy.scale.setScalar(s * (layer ? 0.87 : 1));
        dummy.updateMatrix();
        petals.setMatrixAt(k, dummy.matrix);
        petals.setColorAt(
          k,
          new THREE.Color().setHSL(
            0.105 + (n % 4) * 0.007,
            0.48,
            layer ? 0.65 : 0.73,
          ),
        );
        baseMatrices.push({
          type: "petal",
          index: k,
          matrix: dummy.matrix.clone(),
          flower: n,
        });
        k++;
      }
    }
    dummy.position.set(x, y, z + 0.08);
    dummy.rotation.set(tilt, 0, 0);
    dummy.scale.set(s * 0.49, s * 0.49, s * 0.15);
    dummy.updateMatrix();
    disks.setMatrixAt(n, dummy.matrix);
    dummy.position.set(x, y - s * 1.8, z - 0.1);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    stems.setMatrixAt(n, dummy.matrix);
    for (let side of [-1, 1]) {
      dummy.position.set(x, y - s * (side === 1 ? 1.5 : 2.5), z);
      dummy.rotation.set(-0.2, 0, side === 1 ? 0.4 : 2.8);
      dummy.scale.set(s * 0.78, s * 0.8, s * 0.8);
      dummy.updateMatrix();
      leaves.setMatrixAt(n * 2 + (side === 1 ? 0 : 1), dummy.matrix);
    }
  });
  group.add(petals, disks);
  stems.geometry.dispose();
  leaves.geometry.dispose();
  const details = addPlantDetail(group, beds, material);
  // 少量大而虚的光斑与清晰花形形成反差，避免所有点同等抢眼。
  const bokehPos = [],
    bokehSize = [];
  for (let i = 0; i < 90; i++) {
    bokehPos.push(
      Math.sin(i * 9.7) * 12,
      Math.cos(i * 7.3) * 5,
      -4 + Math.sin(i) * 7,
    );
    bokehSize.push(8 + (i % 8) * 4);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute(bokehPos, 3));
  bg.setAttribute("aSize", new THREE.Float32BufferAttribute(bokehSize, 1));
  const bm = new THREE.ShaderMaterial({
    uniforms: { uFade: uniform },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader:
      "attribute float aSize;varying float vAlpha;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*18./-mv.z;vAlpha=.18;}",
    fragmentShader:
      "uniform float uFade;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.7,.26,exp(-d*d*5.)*vAlpha*(1.-uFade));}",
  });
  group.add(new THREE.Points(bg, bm));
  return {
    group,
    update(p, elapsed) {
      uniform.value = p;
      time.value = elapsed;
      group.visible = p < 0.999;
      group.rotation.y = 0;
      group.position.y = 0;
    },
  };
}

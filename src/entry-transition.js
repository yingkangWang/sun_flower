import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

// Both scenes remain live. A depth-rendered outgoing shot is refracted into the incoming field.
// The flow is a procedural displacement field, not a physical fluid solver.
export function createEntryTransition({
  renderer,
  composer,
  renderOpening,
  renderGarden,
}) {
  const outgoing = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  outgoing.texture.name = "EntryTransition.outgoing";
  const copy = new THREE.ShaderMaterial({
    uniforms: { tImage: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D tImage;varying vec2 vUv;void main(){gl_FragColor=texture2D(tImage,vUv);}`,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tOpening: { value: outgoing.texture },
      tGarden: { value: null },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: copy.vertexShader,
    fragmentShader: `
      uniform sampler2D tOpening,tGarden;
      uniform float uProgress,uTime;uniform vec2 uCenter,uResolution;
      varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03+3.1)+.15*noise(p*4.1-1.7);}
      vec3 soften(sampler2D image,vec2 uv,float amount){
        vec2 d=vec2(amount,amount*uResolution.x/uResolution.y);
        vec3 c=texture2D(image,clamp(uv,0.001,0.999)).rgb*.2;
        float total=.2;
        // Distributed disk samples avoid the duplicate star outlines of a cross blur.
        for(int i=0;i<16;i++){
          float f=(float(i)+.5)/16., a=float(i)*2.39996323;
          vec2 offset=vec2(cos(a),sin(a))*sqrt(f)*d;
          float w=exp(-f*2.5);
          c+=texture2D(image,clamp(uv+offset,0.001,0.999)).rgb*w;
          total+=w;
        }
        return c/total;
      }
      void main(){
        float p=uProgress;
        vec2 aspect=vec2(uResolution.x/uResolution.y,1.);
        vec2 q=(vUv-uCenter)*aspect;
        float r=length(q), angle=atan(q.y,q.x);
        float blend=smoothstep(.43,1.,p);
        float envelope=sin(3.14159265*p)*smoothstep(.1,.35,p);
        vec2 drift=vec2(fbm(vUv*3.3+vec2(uTime*.11,0.)),fbm(vUv*3.3+vec2(4.,-uTime*.09)))-.5;
        vec2 tangent=vec2(-q.y,q.x)/(r+.25);
        vec2 flow=(drift*.07+tangent*.028*sin(r*7.-p*5.))*envelope;
        float reach=length(max(uCenter,1.-uCenter)*aspect)+.38;
        float radius=mix(-.32,reach,blend);
        float front=r+(fbm(vUv*3.8+uTime*.08)-.5)*.22+sin(angle*3.+r*9.-p*5.)*.035*envelope;
        float mask=1.-smoothstep(radius-.28,radius+.28,front);
        vec2 outUv=uCenter+(vUv-uCenter)*(1.-.055*envelope)+flow;
        vec2 inUv=vUv-flow*(1.-blend);
        vec3 a=texture2D(tOpening,clamp(outUv,0.001,0.999)).rgb;
        vec3 b=soften(tGarden,inUv,.006*(1.-smoothstep(.45,.95,p)));
        vec3 col=mix(a,b,mask);
        float edge=exp(-pow((front-radius)/.23,2.))*envelope;
        col+=vec3(.14,.095,.035)*edge*.65;
        // Exact endpoints prevent a brightness or focus jump when handing the renderer back.
        if(p<=0.)col=texture2D(tOpening,vUv).rgb;
        if(p>=1.)col=texture2D(tGarden,vUv).rgb;
        gl_FragColor=vec4(col,1.);
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new FullScreenQuad(copy),
    size = new THREE.Vector2();
  let active = false,
    nativeRatio = renderer.getPixelRatio(),
    workingRatio = nativeRatio;
  function fit() {
    renderer.getSize(size);
    // During a defocused shot, cap pixel work; full native resolution returns at the landing.
    const ratio = Math.min(nativeRatio, 1280 / size.x, 900 / size.y);
    if (ratio !== workingRatio) {
      renderer.setPixelRatio(ratio);
      composer.setPixelRatio(ratio);
      workingRatio = ratio;
    }
    renderer.getDrawingBufferSize(size);
    outgoing.setSize(size.x, size.y);
    material.uniforms.uResolution.value.copy(size);
  }
  function render(time, progress) {
    if (!active) {
      nativeRatio = renderer.getPixelRatio();
      workingRatio = nativeRatio;
      active = true;
    }
    fit();
    const previousTarget = renderer.getRenderTarget();
    try {
      const shot = renderOpening(time, progress);
      copy.uniforms.tImage.value = shot.texture;
      quad.material = copy;
      renderer.setRenderTarget(outgoing);
      quad.render(renderer);
      // The outgoing image is copied before the shared composer buffers are reused.
      renderer.setRenderTarget(null);
      material.uniforms.tGarden.value = renderGarden(progress);
      material.uniforms.uCenter.value.copy(shot.center);
      material.uniforms.uTime.value = time;
      material.uniforms.uProgress.value = progress;
      quad.material = material;
      renderer.setRenderTarget(null);
      quad.render(renderer);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }
  function finish() {
    if (!active) return;
    renderer.setPixelRatio(nativeRatio);
    composer.setPixelRatio(nativeRatio);
    workingRatio = nativeRatio;
    active = false;
  }
  return {
    render,
    finish,
    get active() {
      return active;
    },
  };
}

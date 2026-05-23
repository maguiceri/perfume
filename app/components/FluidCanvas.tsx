'use client';

import { useEffect, useRef } from 'react';

// ── Config ──────────────────────────────────────────────────────────────────
const SIM_RESOLUTION     = 192;
const DYE_RESOLUTION     = 512;
const DENSITY_DISSIPATION  = 0.985;
const VELOCITY_DISSIPATION = 0.98;
const PRESSURE_ITERATIONS  = 20;
const CURL        = 40;
const SPLAT_RADIUS  = 0.28;   // wide → diffuse/watery
const SPLAT_FORCE   = 5000;
const COLOR_INTENSITY = 0.06; // low per-splat → gradual, translucent accumulation

// ── Shaders ─────────────────────────────────────────────────────────────────
const VERT = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texelSize;
void main(){
  vUv = aPosition*.5+.5;
  vL = vUv-vec2(texelSize.x,0); vR = vUv+vec2(texelSize.x,0);
  vT = vUv+vec2(0,texelSize.y); vB = vUv-vec2(0,texelSize.y);
  gl_Position = vec4(aPosition,0,1);
}`;

const ADVECTION = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity, uSource;
uniform vec2 texelSize, dyeTexelSize;
uniform float dt, dissipation;
out vec4 o;
vec4 bilerp(sampler2D s, vec2 uv, vec2 ts){
  vec2 st=uv/ts-.5; vec2 i=floor(st),f=fract(st);
  vec4 a=texture(s,(i+vec2(.5,.5))*ts), b=texture(s,(i+vec2(1.5,.5))*ts);
  vec4 c=texture(s,(i+vec2(.5,1.5))*ts), d=texture(s,(i+vec2(1.5,1.5))*ts);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
void main(){
  vec2 coord = vUv - dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;
  o = dissipation*bilerp(uSource,coord,dyeTexelSize);
  o.a = 1.;
}`;

const DIVERGENCE = `#version 300 es
precision mediump float;
in vec2 vUv,vL,vR,vT,vB;
uniform sampler2D uVelocity;
out vec4 o;
void main(){
  float L=texture(uVelocity,vL).x, R=texture(uVelocity,vR).x;
  float T=texture(uVelocity,vT).y, B=texture(uVelocity,vB).y;
  vec2 C=texture(uVelocity,vUv).xy;
  if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x;
  if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y;
  o=vec4(.5*(R-L+T-B),0,0,1);
}`;

const CURL_SH = `#version 300 es
precision mediump float;
in vec2 vUv,vL,vR,vT,vB;
uniform sampler2D uVelocity;
out vec4 o;
void main(){
  float L=texture(uVelocity,vL).y, R=texture(uVelocity,vR).y;
  float T=texture(uVelocity,vT).x, B=texture(uVelocity,vB).x;
  o=vec4(.5*(R-L-T+B),0,0,1);
}`;

const VORTICITY = `#version 300 es
precision highp float;
in vec2 vUv,vL,vR,vT,vB;
uniform sampler2D uVelocity, uCurl;
uniform float curl, dt;
out vec4 o;
void main(){
  float L=texture(uCurl,vL).x, R=texture(uCurl,vR).x;
  float T=texture(uCurl,vT).x, B=texture(uCurl,vB).x, C=texture(uCurl,vUv).x;
  vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));
  f/=length(f)+.0001; f*=curl*C; f.y*=-1.;
  vec2 v=texture(uVelocity,vUv).xy+f*dt;
  o=vec4(clamp(v,-1000.,1000.),0,1);
}`;

const PRESSURE = `#version 300 es
precision mediump float;
in vec2 vUv,vL,vR,vT,vB;
uniform sampler2D uPressure, uDivergence;
out vec4 o;
void main(){
  float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x;
  float T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
  float d=texture(uDivergence,vUv).x;
  o=vec4((L+R+B+T-d)*.25,0,0,1);
}`;

const GRAD_SUB = `#version 300 es
precision mediump float;
in vec2 vUv,vL,vR,vT,vB;
uniform sampler2D uPressure, uVelocity;
out vec4 o;
void main(){
  float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x;
  float T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
  vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B);
  o=vec4(v,0,1);
}`;

const CLEAR_SH = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
out vec4 o;
void main(){ o=value*texture(uTexture,vUv); }`;

const SPLAT_SH = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio, radius;
uniform vec3 color;
uniform vec2 point;
out vec4 o;
void main(){
  vec2 p=vUv-point; p.x*=aspectRatio;
  float f=exp(-dot(p,p)/radius);
  o=vec4(texture(uTarget,vUv).xyz+f*color,1);
}`;

// Display: natural colors, no saturation boost, smooth alpha fade for water look
const DISPLAY_SH = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 fragColor;
void main(){
  vec3 C = texture(uTexture, vUv).rgb;
  float a = max(C.r, max(C.g, C.b));
  // gentle power curve: transparent in gaps, smooth where fluid exists
  a = pow(a, 0.6);
  fragColor = vec4(C / max(a, 0.001) * a, a);
}`;

// ── Component ────────────────────────────────────────────────────────────────
export default function FluidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) return;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return;

    // helpers
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src); gl!.compileShader(s); return s;
    }
    function prog(vSrc: string, fSrc: string) {
      const p = gl!.createProgram()!;
      gl!.attachShader(p, compile(gl!.VERTEX_SHADER, vSrc));
      gl!.attachShader(p, compile(gl!.FRAGMENT_SHADER, fSrc));
      gl!.bindAttribLocation(p, 0, 'aPosition');
      gl!.linkProgram(p);
      const u: Record<string, WebGLUniformLocation> = {};
      const n = gl!.getProgramParameter(p, gl!.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl!.getActiveUniform(p, i)!.name; u[nm] = gl!.getUniformLocation(p, nm)!; }
      return { p, u };
    }

    const P = {
      adv: prog(VERT, ADVECTION),
      div: prog(VERT, DIVERGENCE),
      curl: prog(VERT, CURL_SH),
      vort: prog(VERT, VORTICITY),
      pres: prog(VERT, PRESSURE),
      grad: prog(VERT, GRAD_SUB),
      clr: prog(VERT, CLEAR_SH),
      spl: prog(VERT, SPLAT_SH),
      disp: prog(VERT, DISPLAY_SH),
    };

    // VAO quad
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);

    function quad() { gl!.bindVertexArray(vao); gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0); }

    // FBO helpers
    type FBO = { tex: WebGLTexture; fbo: WebGLFramebuffer; w:number; h:number; tsx:number; tsy:number; bind(id:number):number };
    function makeFBO(w:number,h:number,iFmt:number,fmt:number,type:number,filter:number): FBO {
      const tex=gl!.createTexture()!;
      gl!.activeTexture(gl!.TEXTURE0); gl!.bindTexture(gl!.TEXTURE_2D,tex);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MIN_FILTER,filter);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MAG_FILTER,filter);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_S,gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_T,gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D,0,iFmt,w,h,0,fmt,type,null);
      const fbo=gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER,fbo);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER,gl!.COLOR_ATTACHMENT0,gl!.TEXTURE_2D,tex,0);
      gl!.viewport(0,0,w,h); gl!.clear(gl!.COLOR_BUFFER_BIT);
      return { tex, fbo, w, h, tsx:1/w, tsy:1/h, bind(id:number){ gl!.activeTexture(gl!.TEXTURE0+id); gl!.bindTexture(gl!.TEXTURE_2D,tex); return id; } };
    }
    function makeDouble(w:number,h:number,iFmt:number,fmt:number,type:number,filter:number){
      let a=makeFBO(w,h,iFmt,fmt,type,filter), b=makeFBO(w,h,iFmt,fmt,type,filter);
      return { w,h, tsx:a.tsx, tsy:a.tsy, get read(){return a;}, get write(){return b;}, swap(){[a,b]=[b,a];} };
    }
    function blit(fbo:WebGLFramebuffer|null,w:number,h:number){ gl!.bindFramebuffer(gl!.FRAMEBUFFER,fbo); gl!.viewport(0,0,w,h); }

    const HF=gl.HALF_FLOAT;
    let vel  = makeDouble(SIM_RESOLUTION, SIM_RESOLUTION, gl.RG16F,   gl.RG,   HF, gl.LINEAR);
    let dye  = makeDouble(DYE_RESOLUTION, DYE_RESOLUTION, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
    const dv = makeFBO(SIM_RESOLUTION, SIM_RESOLUTION, gl.R16F, gl.RED, HF, gl.NEAREST);
    const cu = makeFBO(SIM_RESOLUTION, SIM_RESOLUTION, gl.R16F, gl.RED, HF, gl.NEAREST);
    let pr   = makeDouble(SIM_RESOLUTION, SIM_RESOLUTION, gl.R16F, gl.RED, HF, gl.NEAREST);

    function resize(){ const w=canvas!.clientWidth,h=canvas!.clientHeight; if(canvas!.width!==w||canvas!.height!==h){canvas!.width=w;canvas!.height=h;} }

    // Smooth HSV color — cycles slowly through teal→blue→purple→pink range
    function hsvToRgb(h:number,s:number,v:number):[number,number,number]{
      const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
      switch(i%6){case 0:return[v,t,p];case 1:return[q,v,p];case 2:return[p,v,t];case 3:return[p,q,v];case 4:return[t,p,v];default:return[v,p,q];}
    }
    function currentColor():[number,number,number]{
      const t=Date.now()/6000;
      // hue oscillates in the 0.45–0.95 range (teal → blue → purple → pink)
      const hue=0.7+Math.sin(t*Math.PI*2)*0.25;
      return hsvToRgb(((hue%1)+1)%1, 0.75, 0.9);
    }

    // Splat — additive (ink in water)
    function splat(x:number,y:number,dx:number,dy:number,col:[number,number,number]){
      const asp=canvas!.width/canvas!.height;
      const r=SPLAT_RADIUS/100;

      blit(vel.write.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.spl.p);
      gl!.uniform1i(P.spl.u['uTarget'],vel.read.bind(0));
      gl!.uniform1f(P.spl.u['aspectRatio'],asp);
      gl!.uniform2f(P.spl.u['point'],x,y);
      gl!.uniform3f(P.spl.u['color'],dx,dy,0);
      gl!.uniform1f(P.spl.u['radius'],r);
      quad(); vel.swap();

      blit(dye.write.fbo,DYE_RESOLUTION,DYE_RESOLUTION);
      gl!.useProgram(P.spl.p);
      gl!.uniform1i(P.spl.u['uTarget'],dye.read.bind(0));
      gl!.uniform1f(P.spl.u['aspectRatio'],asp);
      gl!.uniform2f(P.spl.u['point'],x,y);
      gl!.uniform3f(P.spl.u['color'],col[0]*COLOR_INTENSITY,col[1]*COLOR_INTENSITY,col[2]*COLOR_INTENSITY);
      gl!.uniform1f(P.spl.u['radius'],r);
      quad(); dye.swap();
    }

    function step(dt:number){
      gl!.disable(gl!.BLEND);

      blit(cu.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.curl.p);
      gl!.uniform2f(P.curl.u['texelSize'],vel.tsx,vel.tsy);
      gl!.uniform1i(P.curl.u['uVelocity'],vel.read.bind(0));
      quad();

      blit(vel.write.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.vort.p);
      gl!.uniform2f(P.vort.u['texelSize'],vel.tsx,vel.tsy);
      gl!.uniform1i(P.vort.u['uVelocity'],vel.read.bind(0));
      gl!.uniform1i(P.vort.u['uCurl'],cu.bind(1));
      gl!.uniform1f(P.vort.u['curl'],CURL);
      gl!.uniform1f(P.vort.u['dt'],dt);
      quad(); vel.swap();

      blit(dv.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.div.p);
      gl!.uniform2f(P.div.u['texelSize'],vel.tsx,vel.tsy);
      gl!.uniform1i(P.div.u['uVelocity'],vel.read.bind(0));
      quad();

      blit(pr.write.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.clr.p);
      gl!.uniform1i(P.clr.u['uTexture'],pr.read.bind(0));
      gl!.uniform1f(P.clr.u['value'],0.8);
      quad(); pr.swap();

      for(let i=0;i<PRESSURE_ITERATIONS;i++){
        blit(pr.write.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
        gl!.useProgram(P.pres.p);
        gl!.uniform2f(P.pres.u['texelSize'],vel.tsx,vel.tsy);
        gl!.uniform1i(P.pres.u['uPressure'],pr.read.bind(0));
        gl!.uniform1i(P.pres.u['uDivergence'],dv.bind(1));
        quad(); pr.swap();
      }

      blit(vel.write.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.grad.p);
      gl!.uniform2f(P.grad.u['texelSize'],vel.tsx,vel.tsy);
      gl!.uniform1i(P.grad.u['uPressure'],pr.read.bind(0));
      gl!.uniform1i(P.grad.u['uVelocity'],vel.read.bind(1));
      quad(); vel.swap();

      // advect velocity
      blit(vel.write.fbo,SIM_RESOLUTION,SIM_RESOLUTION);
      gl!.useProgram(P.adv.p);
      gl!.uniform2f(P.adv.u['texelSize'],vel.tsx,vel.tsy);
      gl!.uniform2f(P.adv.u['dyeTexelSize'],vel.tsx,vel.tsy);
      gl!.uniform1i(P.adv.u['uVelocity'],vel.read.bind(0));
      gl!.uniform1i(P.adv.u['uSource'],vel.read.bind(0));
      gl!.uniform1f(P.adv.u['dt'],dt);
      gl!.uniform1f(P.adv.u['dissipation'],VELOCITY_DISSIPATION);
      quad(); vel.swap();

      // advect dye
      blit(dye.write.fbo,DYE_RESOLUTION,DYE_RESOLUTION);
      gl!.useProgram(P.adv.p);
      gl!.uniform2f(P.adv.u['texelSize'],vel.tsx,vel.tsy);
      gl!.uniform2f(P.adv.u['dyeTexelSize'],dye.tsx,dye.tsy);
      gl!.uniform1i(P.adv.u['uVelocity'],vel.read.bind(0));
      gl!.uniform1i(P.adv.u['uSource'],dye.read.bind(1));
      gl!.uniform1f(P.adv.u['dt'],dt);
      gl!.uniform1f(P.adv.u['dissipation'],DENSITY_DISSIPATION);
      quad(); dye.swap();
    }

    function render(){
      resize();
      blit(null,canvas!.width,canvas!.height);
      gl!.clearColor(0.02,0.01,0.05,1);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.ONE,gl!.ONE_MINUS_SRC_ALPHA);
      gl!.useProgram(P.disp.p);
      gl!.uniform1i(P.disp.u['uTexture'],dye.read.bind(0));
      quad();
    }

    // pointer
    const ptr = { x:0.5, y:0.5, dx:0, dy:0, moved:false };
    function onMove(cx:number,cy:number){
      const r=canvas!.getBoundingClientRect();
      const x=(cx-r.left)/r.width, y=1-(cy-r.top)/r.height;
      ptr.dx=(x-ptr.x)*SPLAT_FORCE; ptr.dy=(y-ptr.y)*SPLAT_FORCE;
      ptr.x=x; ptr.y=y; ptr.moved=true;
    }
    const onMouse=(e:MouseEvent)=>onMove(e.clientX,e.clientY);
    const onTouch=(e:TouchEvent)=>{ e.preventDefault(); for(const t of Array.from(e.touches)) onMove(t.clientX,t.clientY); };
    canvas.addEventListener('mousemove',onMouse);
    canvas.addEventListener('touchmove',onTouch,{passive:false});

    // seed: gentle initial splats across the screen
    resize();
    for(let i=0;i<12;i++){
      const x=0.1+Math.random()*0.8, y=0.1+Math.random()*0.8;
      const a=Math.random()*Math.PI*2;
      const f=2000+Math.random()*3000;
      splat(x,y,Math.cos(a)*f,Math.sin(a)*f,currentColor());
    }

    let last=performance.now(), raf=0;
    function loop(){
      raf=requestAnimationFrame(loop);
      const now=performance.now();
      const dt=Math.min((now-last)/1000,0.016);
      last=now;
      if(ptr.moved){ splat(ptr.x,ptr.y,ptr.dx,ptr.dy,currentColor()); ptr.moved=false; }
      step(dt);
      render();
    }
    loop();

    return ()=>{ cancelAnimationFrame(raf); canvas.removeEventListener('mousemove',onMouse); canvas.removeEventListener('touchmove',onTouch); };
  },[]);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full cursor-none" style={{background:'#050108'}} />;
}

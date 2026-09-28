import * as THREE from '../vendor/three.module.min.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xadc4c1, .00042);
const camera = new THREE.PerspectiveCamera(67, innerWidth/innerHeight, .15, 6000);
camera.position.set(15, 16, 470);
const clock = new THREE.Clock();
let elapsed = 0, timeOfDay = 16.7, flyMode = false;

// Deterministic natural synthesis ------------------------------------------------
let seed = 84721;
function rand(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }
function hash(x,z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function smooth(t){ return t*t*(3-2*t); }
function noise(x,z){ const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz; const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1); const u=smooth(fx),v=smooth(fz); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,u),THREE.MathUtils.lerp(c,d,u),v)*2-1; }
function fbm(x,z){ let n=0,a=.5,f=1; for(let i=0;i<5;i++){ n+=a*noise(x*f,z*f); f*=2.03; a*=.49; } return n; }
function coastRadius(a){ return 515 + 48*Math.sin(a*3+1.1)+27*Math.sin(a*7-2.4)+17*Math.sin(a*13+.5)+9*noise(Math.cos(a)*5,Math.sin(a)*5); }
const LAKE={x:-145,z:35,r:78,y:18.4};
function terrainHeight(x,z){
  const d=Math.hypot(x,z), a=Math.atan2(z,x), edge=coastRadius(a);
  const continental=Math.max(0,1-Math.pow(d/edge,2.25));
  const ridge=Math.abs(fbm(x*.0028+12,z*.0028-7));
  let h=-8 + continental*(36 + 72*Math.pow(Math.max(0,fbm(x*.0032,z*.0032)),1.35) + 38*ridge + 10*fbm(x*.015,z*.015));
  h += continental*8*Math.sin(x*.006+fbm(x*.002,z*.002)*3);
  const ld=Math.hypot(x-LAKE.x,z-LAKE.z), irregular=LAKE.r+8*noise(x*.025,z*.025);
  if(ld<irregular+30){ const t=THREE.MathUtils.smoothstep(ld, irregular-18, irregular+30); const basin=LAKE.y-3.7 + 4.5*Math.pow(ld/LAKE.r,2)+noise(x*.06,z*.06)*.7; h=THREE.MathUtils.lerp(basin,h,t); }
  return h;
}
function slopeAt(x,z){ const e=3,h=terrainHeight(x,z); return Math.hypot(terrainHeight(x+e,z)-h,terrainHeight(x,z+e)-h)/e; }
function biomeAt(x,z){ const h=terrainHeight(x,z),s=slopeAt(x,z),d=Math.hypot(x,z),ld=Math.hypot(x-LAKE.x,z-LAKE.z); if(h<4)return 'TIDAL SHORE'; if(ld<105)return 'FRESHWATER MARSH'; if(s>.72)return 'GRANITE RIDGE'; if(h>75)return 'UPLAND HEATH'; if(d>420)return 'COASTAL MEADOW'; return 'TEMPERATE FOREST'; }

// Sky and atmosphere ------------------------------------------------------------
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},horizon:{value:new THREE.Color()},bottom:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3()},sunColor:{value:new THREE.Color()}},vertexShader:`varying vec3 vW; void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vW;uniform vec3 top,horizon,bottom,sunDir,sunColor;void main(){vec3 d=normalize(vW-cameraPosition);float h=d.y*.5+.5;vec3 c=mix(bottom,horizon,smoothstep(0.,.48,h));c=mix(c,top,smoothstep(.48,1.,h));float sd=max(dot(d,sunDir),0.);c+=sunColor*(pow(sd,700.)*2.8+pow(sd,18.)*.12);gl_FragColor=vec4(c,1.);}`});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(4200,32,18),skyMat));
const sun=new THREE.DirectionalLight(0xffd9a3,4.1); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-450;sun.shadow.camera.right=450;sun.shadow.camera.top=450;sun.shadow.camera.bottom=-450;sun.shadow.camera.near=10;sun.shadow.camera.far=1600;sun.shadow.bias=-.0003; scene.add(sun);scene.add(sun.target);
const hemi=new THREE.HemisphereLight(0xa9ccdc,0x31402b,1.25); scene.add(hemi);
const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(18,20,12),new THREE.MeshBasicMaterial({color:0xfff4cd,fog:false}));scene.add(sunDisc);

// Geological terrain ------------------------------------------------------------
document.querySelector('#load-status').textContent='Eroding valleys and coast…';
const N=168,SIZE=1400, verts=[],cols=[],indices=[]; const color=new THREE.Color();
for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
  const x=(i/N-.5)*SIZE,z=(j/N-.5)*SIZE,y=terrainHeight(x,z),sl=slopeAt(x,z),d=Math.hypot(x,z),ld=Math.hypot(x-LAKE.x,z-LAKE.z);
  verts.push(x,y,z);
  const variation=noise(x*.08,z*.08)*.045;
  if(y<1.8) color.setRGB(.31+variation,.275+variation,.19+variation);
  else if(y<7) color.setRGB(.54+variation,.46+variation,.29+variation);
  else if(ld<105) color.setRGB(.22+variation,.29+variation,.16+variation);
  else if(sl>.62) color.setRGB(.29+variation,.30+variation,.27+variation);
  else if(y>78) color.setRGB(.31+variation,.38+variation,.22+variation);
  else color.setRGB(.20+variation,.31+variation,.13+variation);
  cols.push(color.r,color.g,color.b);
}
for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;indices.push(a,c,b,b,c,d)}
const terrainGeo=new THREE.BufferGeometry();terrainGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));terrainGeo.setIndex(indices);terrainGeo.computeVertexNormals();
const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:.01});
terrainMat.onBeforeCompile=s=>{s.uniforms.detailScale={value:1};s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat micro=fract(sin(dot(vViewPosition.xz,vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=.94+micro*.10;`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=.88+micro*.12;');};
const terrain=new THREE.Mesh(terrainGeo,terrainMat);terrain.receiveShadow=true;terrain.castShadow=true;scene.add(terrain);

// Ocean: multi-octave waves, fresnel and animated solar path --------------------
const oceanMat=new THREE.ShaderMaterial({transparent:false,depthWrite:true,uniforms:{uTime:{value:0},sunDir:{value:new THREE.Vector3()},sunColor:{value:new THREE.Color()},deep:{value:new THREE.Color(0x0a4251)},shallow:{value:new THREE.Color(0x2b8a91)}},vertexShader:`uniform float uTime;varying vec3 vWorld;varying vec3 vN;float w(vec2 p){return sin(p.x*.032+uTime*.72)*1.2+sin(p.y*.047-uTime*.61)*.7+sin((p.x+p.y)*.095+uTime)*.24;}void main(){vec3 p=position;p.z+=w(p.xy);vec2 e=vec2(.5,0);float dx=w(p.xy+e)-w(p.xy-e),dy=w(p.xy+e.yx)-w(p.xy-e.yx);vN=normalize(mat3(modelMatrix)*vec3(-dx,-dy,1.));vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`uniform float uTime;uniform vec3 sunDir,sunColor,deep,shallow;varying vec3 vWorld;varying vec3 vN;void main(){vec3 V=normalize(cameraPosition-vWorld),N=normalize(vN);float fr=pow(1.-max(dot(V,N),0.),4.);float glint=pow(max(dot(reflect(-sunDir,N),V),0.),420.)*3.;float r=length(vWorld.xz);float ang=atan(vWorld.z,vWorld.x);float edge=515.+48.*sin(ang*3.+1.1)+27.*sin(ang*7.-2.4)+17.*sin(ang*13.+.5);float shore=1.-smoothstep(0.,18.,abs(r-edge));float foam=shore*smoothstep(.48,.72,sin(vWorld.x*.11+sin(vWorld.z*.07)+uTime*1.5)*.5+.5);vec3 sky=mix(vec3(.18,.42,.50),vec3(.62,.75,.77),fr);vec3 c=mix(shallow,deep,smoothstep(edge+10.,edge+360.,r));c=mix(c,sky,.18+fr*.62);c+=sunColor*glint+c*foam*1.4;gl_FragColor=vec4(c,1.);}`});
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(5200,5200,200,200),oceanMat);ocean.rotation.x=-Math.PI/2;ocean.position.y=.25;ocean.receiveShadow=true;scene.add(ocean);

// Freshwater lake with irregular polygon shore ----------------------------------
const lakeGeo=new THREE.CircleGeometry(LAKE.r,96);const lp=lakeGeo.attributes.position;for(let i=1;i<lp.count;i++){const x=lp.getX(i),y=lp.getY(i),a=Math.atan2(y,x),r=LAKE.r+7*noise(Math.cos(a)*5+7,Math.sin(a)*5);lp.setXY(i,Math.cos(a)*r,Math.sin(a)*r)}
const lakeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},vertexShader:`uniform float uTime;varying vec2 uvw;void main(){vec3 p=position;p.z+=sin(p.x*.22+uTime)*.07+sin(p.y*.16-uTime*.7)*.08;uvw=p.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 uvw;uniform float uTime;void main(){float ripple=sin(length(uvw)*1.4-uTime*2.)*.025;float edge=smoothstep(78.,45.,length(uvw));vec3 c=mix(vec3(.24,.39,.31),vec3(.07,.24,.24),edge)+ripple;gl_FragColor=vec4(c,.84);}`});
const lake=new THREE.Mesh(lakeGeo,lakeMat);lake.rotation.x=-Math.PI/2;lake.position.set(LAKE.x,LAKE.y,LAKE.z);lake.renderOrder=3;scene.add(lake);

// Instanced ecosystem ------------------------------------------------------------
document.querySelector('#load-status').textContent='Planting a living ecosystem…';
const dummy=new THREE.Object3D();
function makeInstances(geometry,material,count,placement,shadows=true){const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);let n=0,tries=0;while(n<count&&tries<count*15){tries++;const p=placement();if(!p)continue;dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.ry||0,p.rz||0);dummy.scale.set(p.sx||p.s||1,p.sy||p.s||1,p.sz||p.s||1);dummy.updateMatrix();mesh.setMatrixAt(n++,dummy.matrix)}mesh.count=n;mesh.castShadow=shadows;mesh.receiveShadow=shadows;scene.add(mesh);return mesh}
function landPoint(minH=5,maxH=110,maxSlope=.55){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*500,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z),s=slopeAt(x,z);if(y<minH||y>maxH||s>maxSlope||Math.hypot(x-LAKE.x,z-LAKE.z)<92)return null;return{x,y,z,slope:s}}
const trunkMat=new THREE.MeshStandardMaterial({color:0x44382a,roughness:1});
const leafMat=new THREE.MeshStandardMaterial({color:0x294d24,roughness:.82,side:THREE.DoubleSide});
const treeData=[];for(let i=0;i<720;i++){let p;for(let t=0;t<20&&!p;t++){const q=landPoint(11,92,.54);if(q&&noise(q.x*.008+20,q.z*.008)>.02)p=q}if(p){p.s=.7+rand()*.75;p.ry=rand()*6.28;treeData.push(p)}}
function fromTree(){return treeData.shift()||null}
const copyTrees=[...treeData];makeInstances(new THREE.CylinderGeometry(.55,.9,9,7),trunkMat,copyTrees.length,()=>{const p=copyTrees.shift();return p&&{...p,y:p.y+4.3,sy:p.s,sx:p.s,sz:p.s}});
const canopyData=treeData.length?treeData:[...copyTrees]; // fallback unused
// recreate deterministic canopy transforms from trunk source by sampling matrices instead
const trunks=scene.children[scene.children.length-1]; const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(4.3,1),leafMat,trunks.count*3);let ci=0,m=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),sca=new THREE.Vector3();for(let i=0;i<trunks.count;i++){trunks.getMatrixAt(i,m);m.decompose(pos,quat,sca);for(let k=0;k<3;k++){dummy.position.set(pos.x+(k-1)*1.8*sca.x,pos.y+5.3*sca.y+(k===1?2.2:0),pos.z+(k%2?.9:-.6)*sca.z);dummy.rotation.set(0,i*.71+k,0);dummy.scale.set(1.15*sca.x,(1.2-k*.08)*sca.y,1.15*sca.z);dummy.updateMatrix();canopy.setMatrixAt(ci++,dummy.matrix)}}canopy.castShadow=true;canopy.receiveShadow=true;scene.add(canopy);
// rocks
makeInstances(new THREE.IcosahedronGeometry(1.4,1),new THREE.MeshStandardMaterial({color:0x77796f,roughness:.86}),520,()=>{const p=landPoint(2,120,.95);if(!p)return null;const s=.25+Math.pow(rand(),2)*3.8;return{...p,y:p.y+s*.45,s,sy:s*(.45+rand()*.35),ry:rand()*6.28,rx:rand()*.4}});
// grass blades in broad natural patches
const grassMat=new THREE.MeshStandardMaterial({color:0x55763a,roughness:1,side:THREE.DoubleSide});grassMat.onBeforeCompile=s=>{s.uniforms.uTime={value:0};grassMat.userData.shader=s;s.vertexShader=s.vertexShader.replace('void main() {','uniform float uTime; void main() {').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uTime*1.7 + instanceMatrix[3].x*.1)*uv.y*.12;');};
makeInstances(new THREE.PlaneGeometry(.16,1.1,1,2).translate(0,.55,0),grassMat,6500,()=>{const p=landPoint(7,70,.38);if(!p)return null;return{...p,s:.55+rand()*.75,ry:rand()*6.28}} ,false);
// reeds around lake
makeInstances(new THREE.CylinderGeometry(.025,.04,2.2,4),new THREE.MeshStandardMaterial({color:0x6d7c36,roughness:1}),480,()=>{const a=rand()*6.28,r=LAKE.r+5+(rand()-.5)*18,x=LAKE.x+Math.cos(a)*r,z=LAKE.z+Math.sin(a)*r,y=terrainHeight(x,z);return{x,y:y+1,z,s:.7+rand()*.5,ry:rand()*6.28}},false);
// driftwood
makeInstances(new THREE.CylinderGeometry(.16,.28,4,7),new THREE.MeshStandardMaterial({color:0x665947,roughness:1}),65,()=>{const a=rand()*6.28,r=coastRadius(a)-(4+rand()*17),x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z);return{x,y:y+.22,z,rx:Math.PI/2,rz:a+rand(),s:.6+rand()}},true);

// Cloud archipelago — layered, softly lit clumps --------------------------------
const cloudMat=new THREE.MeshStandardMaterial({color:0xf4f1e9,roughness:1,transparent:true,opacity:.68,depthWrite:false});
const cloudGeo=new THREE.IcosahedronGeometry(1,2),cloudGroup=new THREE.Group();
for(let c=0;c<16;c++){const g=new THREE.Group(),cx=(rand()-.5)*2300,cz=(rand()-.5)*1800,cy=260+rand()*190;for(let j=0;j<7+rand()*8;j++){const puff=new THREE.Mesh(cloudGeo,cloudMat);puff.position.set((rand()-.5)*90,(rand()-.5)*18,(rand()-.5)*35);puff.scale.set(28+rand()*38,12+rand()*18,18+rand()*28);g.add(puff)}g.position.set(cx,cy,cz);cloudGroup.add(g)}scene.add(cloudGroup);

// First-person exploration -------------------------------------------------------
let yaw=0,pitch=-.08,locked=false;const keys={};
function lock(){canvas.requestPointerLock?.()}
document.querySelector('#prompt').onclick=lock;canvas.addEventListener('click',()=>{if(!locked)lock()});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;document.querySelector('#prompt').style.display=locked?'none':'block'});
document.addEventListener('mousemove',e=>{if(!locked)return;yaw-=e.movementX*.0018;pitch=Math.max(-1.48,Math.min(1.48,pitch-e.movementY*.0016))});
document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyF')setFly(!flyMode);if(e.code==='KeyP')document.documentElement.classList.toggle('photo-mode')});document.addEventListener('keyup',e=>keys[e.code]=false);
function setFly(v){flyMode=v;document.querySelector('#fly').classList.toggle('active',v);document.querySelector('#walk').classList.toggle('active',!v)}
document.querySelector('#fly').onclick=()=>setFly(true);document.querySelector('#walk').onclick=()=>setFly(false);document.querySelector('#photo').onclick=()=>document.documentElement.classList.toggle('photo-mode');
document.querySelector('#sound').onclick=e=>e.currentTarget.classList.toggle('active');
document.querySelector('#time').oninput=e=>timeOfDay=+e.target.value;

function updateSun(){
  const ang=(timeOfDay-6)/24*Math.PI*2, elev=Math.sin(ang), az=ang*.45-1.2;const dir=new THREE.Vector3(Math.cos(az)*Math.cos(Math.asin(elev*.9)),elev*.9,Math.sin(az)*Math.cos(Math.asin(elev*.9))).normalize();
  sun.position.copy(camera.position).addScaledVector(dir,900);sun.target.position.copy(camera.position);sun.intensity=Math.max(0,elev)*4.2+.02;sun.color.set(elev<.25?0xff8a52:0xffedcf);hemi.intensity=.18+Math.max(0,elev)*1.2;
  const day=Math.max(0,elev);skyMat.uniforms.top.value.set(day>.05?0x2d6687:0x07101f);skyMat.uniforms.horizon.value.set(elev<.25?0xe68d68:0xadc7cd);skyMat.uniforms.bottom.value.set(day>.05?0x809a99:0x090b13);skyMat.uniforms.sunDir.value.copy(dir);skyMat.uniforms.sunColor.value.copy(sun.color);oceanMat.uniforms.sunDir.value.copy(dir);oceanMat.uniforms.sunColor.value.copy(sun.color);sunDisc.position.copy(camera.position).addScaledVector(dir,3200);sunDisc.visible=elev>-.1;scene.fog.color.copy(skyMat.uniforms.horizon.value);renderer.toneMappingExposure=.35+day*.85;
  const hh=Math.floor(timeOfDay)%24,mm=Math.floor((timeOfDay%1)*60);document.querySelector('#clock').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;document.querySelector('#period').textContent=hh<6?'TWILIGHT':hh<10?'MORNING':hh<15?'HIGH SUN':hh<19?'GOLDEN HOUR':'NIGHTFALL';
}
let hudTimer=0;
function update(dt){
  camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));let move=new THREE.Vector3();if(keys.KeyW)move.add(forward);if(keys.KeyS)move.sub(forward);if(keys.KeyD)move.add(right);if(keys.KeyA)move.sub(right);if(flyMode){if(keys.Space)move.y++;if(keys.ControlLeft||keys.KeyC)move.y--}if(move.lengthSq())move.normalize().multiplyScalar((keys.ShiftLeft?34:13)*dt);camera.position.add(move);
  const maxR=640;if(Math.hypot(camera.position.x,camera.position.z)>maxR&&!flyMode){const a=Math.atan2(camera.position.z,camera.position.x);camera.position.x=Math.cos(a)*maxR;camera.position.z=Math.sin(a)*maxR}
  if(!flyMode){const ground=Math.max(.35,terrainHeight(camera.position.x,camera.position.z))+1.78;camera.position.y=THREE.MathUtils.lerp(camera.position.y,ground,1-Math.exp(-dt*12))}
  oceanMat.uniforms.uTime.value=elapsed;lakeMat.uniforms.uTime.value=elapsed;if(grassMat.userData.shader)grassMat.userData.shader.uniforms.uTime.value=elapsed;cloudGroup.position.x=(elapsed*1.4)%700;
  updateSun();hudTimer-=dt;if(hudTimer<0){hudTimer=.2;document.querySelector('#alt').textContent=Math.max(0,Math.round(camera.position.y));let deg=(THREE.MathUtils.radToDeg(yaw)%360+360)%360,names=['N','NE','E','SE','S','SW','W','NW'];document.querySelector('#bearing').textContent=`${names[Math.round(deg/45)%8]} · ${Math.round(deg)}°`;document.querySelector('#biome').textContent=biomeAt(camera.position.x,camera.position.z)}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;update(dt);renderer.render(scene,camera)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75))});
window.__AURELIA_READY__=true;setTimeout(()=>{const l=document.querySelector('#loader');if(!l)return;l.style.opacity=0;setTimeout(()=>l.remove(),1100)},350);animate();

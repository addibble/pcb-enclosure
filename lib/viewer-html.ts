/** Generate a self-contained Three.js viewer with embedded STL layers. */
export interface ViewerLayer {
	name: string;
	stl: string;
	color: string;
	opacity: number;
	/** Unit direction (content Z-up frame) the part moves when exploding. */
	explode?: [number, number, number];
}

export const viewerHtml = (
	layers: ViewerLayer[],
	title = "Enclosure",
): string => {
	const data = layers
		.map((l) => `  ${JSON.stringify(l.name)}: ${JSON.stringify(l.stl)}`)
		.join(",\n");
	const meta = layers.map((l) => ({
		name: l.name,
		color: l.color,
		opacity: l.opacity,
		explode: l.explode ?? [0, 0, 0],
	}));
	return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  html,body{margin:0;height:100%;background:#1e1f23;color:#ddd;font:13px system-ui}
  #ui{position:fixed;top:10px;left:10px;background:#2a2c31;padding:12px 14px;border-radius:8px;box-shadow:0 2px 12px #0008}
  #ui h1{font-size:13px;margin:0 0 8px;font-weight:600}
  label{display:block;margin:3px 0;cursor:pointer;user-select:none}
  .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle}
  #exp{width:140px;vertical-align:middle}
  #hint{position:fixed;bottom:8px;left:10px;color:#888}
</style></head>
<body>
<div id="ui"><h1>${title} — layers</h1><div id="layers"></div>
  <label style="margin-top:8px">explode <input id="exp" type="range" min="0" max="60" value="0"></label>
</div>
<div id="hint">drag = orbit · scroll = zoom · toggle layers above</div>
<script type="importmap">{"imports":{
  "three":"https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const STLS = {
${data}
};
const META = ${JSON.stringify(meta)};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1f23);
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 5000);
camera.position.set(120, 110, 150);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(80,140,100); scene.add(d1);
const d2 = new THREE.DirectionalLight(0xffffff, 0.4); d2.position.set(-90,-40,-60); scene.add(d2);

// content is Z-up (mm); rotate so Z points up in the Y-up viewer
const group = new THREE.Group();
group.rotation.x = -Math.PI/2;
scene.add(group);

const loader = new STLLoader();
const meshes = {};
for (const {name, color, opacity} of META) {
  const geo = loader.parse(STLS[name]);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), transparent: opacity < 1, opacity,
    metalness: 0.1, roughness: 0.7, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.home = mesh.position.clone();
  meshes[name] = mesh; group.add(mesh);
}

// center the model
const bbox = new THREE.Box3().setFromObject(group);
const center = bbox.getCenter(new THREE.Vector3());
group.position.sub(center);
controls.target.set(0,0,0); controls.update();

// layer toggles
const layersEl = document.getElementById("layers");
for (const {name, color} of META) {
  const id = "ck_"+name;
  const row = document.createElement("label");
  row.innerHTML = '<input type="checkbox" id="'+id+'" checked> '
    + '<span class="sw" style="background:'+color+'"></span>' + name;
  layersEl.appendChild(row);
  row.querySelector("input").addEventListener("change", e => {
    meshes[name].visible = e.target.checked;
  });
}
document.getElementById("exp").addEventListener("input", e => {
  const d = Number(e.target.value);
  for (const {name, explode} of META) {
    const m = meshes[name]; if (!m) continue;
    m.position.set(
      m.userData.home.x + explode[0]*d,
      m.userData.home.y + explode[1]*d,
      m.userData.home.z + explode[2]*d);
  }
});

addEventListener("resize", () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
(function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();
</script>
</body></html>`;
};

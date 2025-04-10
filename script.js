// Assumes THREE is imported via a <script type="module"> in index.html
// Import Three.js and FontLoader
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

const preload = () => {
  const manager = new THREE.LoadingManager();
  manager.onLoad = () => {
    new Environment(typo, particle);
  };

  let typo = null;
  const loader = new FontLoader(manager);
  loader.load(
    'https://res.cloudinary.com/dydre7amr/raw/upload/v1612950355/font_zsd4dr.json',
    (font) => { typo = font; }
  );

  const particle = new THREE.TextureLoader(manager).load(
    'https://res.cloudinary.com/dfvtkoboz/image/upload/v1605013866/particle_a64uzf.png'
  );
};

if (
  document.readyState === "complete" ||
  (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  preload();
} else {
  document.addEventListener("DOMContentLoaded", preload);
}

class Environment {
  constructor(font, particle) {
    this.font = font;
    this.particle = particle;
    this.container = document.querySelector('#magic');
    this.scene = new THREE.Scene();
    this.createCamera();
    this.createRenderer();
    this.setup();
    this.bindEvents();
  }
  
  bindEvents() {
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  setup() {
    // Create foreground text effect.
    this.createParticles = new CreateParticles(
      this.scene,
      this.font,
      this.particle,
      this.camera,
      this.renderer
    );
    // Ensure text particles render above the grid.
    this.createParticles.particles.renderOrder = 1;
    
    // Create background grid with click-only smooth transition effect.
    this.backgroundGrid = new BackgroundGrid(this.scene, this.camera);
  }
  
  render() {
    this.backgroundGrid.update();
    this.createParticles.render();
    this.renderer.render(this.scene, this.camera);
  }
  
  createCamera() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / this.container.clientHeight,
      1,
      10000
    );
    this.camera.position.set(0, 0, 100);
  }
  
  createRenderer() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.setAnimationLoop(() => this.render());
  }
  
  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.backgroundGrid.rebuild();
  }
}

class CreateParticles {
  constructor(scene, font, particleImg, camera, renderer) {
    this.scene = scene;
    this.font = font;
    this.particleImg = particleImg;
    this.camera = camera;
    this.renderer = renderer;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-200, 200);
    
    this.data = {
      text: 'GREAT\nDESIGN',
      amount: 1500,
      particleSize: 1,
      textSize: 14,
      area: 250,
      ease: 0.05,
    };

    this.hoverActive = false;
    this.clickActive = false;
    this.clickTime = 0;
    this.buttom = false;

    this.setup();
    this.bindEvents();
  }
  
  setup() {
    const geometry = new THREE.PlaneGeometry(
      this.visibleWidthAtZDepth(100, this.camera),
      this.visibleHeightAtZDepth(100, this.camera)
    );
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true });
    this.planeArea = new THREE.Mesh(geometry, material);
    this.planeArea.visible = false;
    this.createText();
  }
  
  bindEvents() {
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('mouseover', () => { this.hoverActive = true; });
    document.addEventListener('mouseout', () => { this.hoverActive = false; });
  }
  
  onMouseDown(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    const vector = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    this.currenPosition = this.camera.position.clone().add(dir.multiplyScalar(distance));
    this.buttom = true;
    this.data.ease = 0.01;
    this.clickActive = true;
    this.clickTime = performance.now();
  }
  
  onMouseUp() {
    this.buttom = false;
    this.data.ease = 0.05;
    this.clickActive = false;
  }
  
  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  }
  
  createText() {
    const lines = this.data.text.split('\n');
    let allPoints = [];
    const numLines = lines.length;
    const pointsPerLine = Math.floor(this.data.amount / numLines);
    
    let lineWidths = [];
    let lineShapesArray = [];
    for (let i = 0; i < lines.length; i++) {
      let shapes = this.font.generateShapes(lines[i], this.data.textSize);
      let geom = new THREE.ShapeGeometry(shapes);
      geom.computeBoundingBox();
      let width = (geom.boundingBox) ? geom.boundingBox.max.x - geom.boundingBox.min.x : 0;
      lineWidths.push(width);
      lineShapesArray.push(shapes);
    }
    const maxWidth = Math.max(...lineWidths);
    for (let i = 0; i < lines.length; i++) {
      let shapes = lineShapesArray[i];
      let thisLineWidth = lineWidths[i];
      const xOffset = (maxWidth - thisLineWidth) / 2;
      const offsetY = -i * (this.data.textSize * 1.2);
      for (let j = 0; j < shapes.length; j++) {
        let pts = shapes[j].getSpacedPoints(pointsPerLine);
        pts = pts.map(pt => new THREE.Vector3(pt.x + xOffset, pt.y + offsetY, 0));
        allPoints = allPoints.concat(pts);
      }
    }
    let geoParticles = new THREE.BufferGeometry().setFromPoints(allPoints);
    geoParticles.computeBoundingBox();
    if (geoParticles.boundingBox) {
      const xCenter = -0.5 * (geoParticles.boundingBox.max.x - geoParticles.boundingBox.min.x);
      const yCenter = -0.5 * (geoParticles.boundingBox.max.y - geoParticles.boundingBox.min.y);
      geoParticles.translate(xCenter, yCenter, 0);
      geoParticles.translate(0, 30, 0);
    }
    let colors = [];
    let sizes = [];
    for (let i = 0; i < allPoints.length; i++) {
      colors.push(1, 1, 1);
      sizes.push(1);
    }
    geoParticles.setAttribute('customColor', new THREE.Float32BufferAttribute(colors, 3));
    geoParticles.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) },
        pointTexture: { value: this.particleImg }
      },
      vertexShader: document.getElementById('vertexshader').textContent,
      fragmentShader: document.getElementById('fragmentshader').textContent,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
    });
    
    this.particles = new THREE.Points(geoParticles, material);
    this.particles.renderOrder = 1;
    this.scene.add(this.particles);
    
    this.geometryCopy = new THREE.BufferGeometry();
    this.geometryCopy.copy(this.particles.geometry);
  }
  
  render() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.planeArea);
    if (intersects.length > 0) {
      const pos = this.particles.geometry.attributes.position;
      const copy = this.geometryCopy.attributes.position;
      const coulors = this.particles.geometry.attributes.customColor;
      const size = this.particles.geometry.attributes.size;
      const mx = intersects[0].point.x;
      const my = intersects[0].point.y;
      const white = new THREE.Color(0xffffff);
      const yellow = new THREE.Color(0xffff00);
      
      for (let i = 0, l = pos.count; i < l; i++) {
        const initX = copy.getX(i);
        const initY = copy.getY(i);
        const initZ = copy.getZ(i);
        let px = pos.getX(i);
        let py = pos.getY(i);
        let pz = pos.getZ(i);
        
        const mouseDistance = this.distance(mx, my, px, py);
        const factor = Math.min(1, mouseDistance / 100);
        const baseColor = white.clone().lerp(yellow, factor);
        if (this.hoverActive) {
          baseColor.lerp(new THREE.Color(0xffa500), 0.3);
        }
        coulors.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
        coulors.needsUpdate = true;
        
        let clickScale = 1;
        if (this.clickActive) {
          const elapsedClick = performance.now() - this.clickTime;
          clickScale = 1.5 - 0.5 * (elapsedClick / 300);
          if (clickScale < 1) clickScale = 1;
        }
        size.array[i] = this.data.particleSize * clickScale;
        size.needsUpdate = true;
        
        let dx = mx - px;
        let dy = my - py;
        const d = (dx * dx + dy * dy);
        const f = - this.data.area / d;
        
        if (this.buttom) {
          const t = Math.atan2(dy, dx);
          px -= f * Math.cos(t);
          py -= f * Math.sin(t);
        } else {
          if (mouseDistance < this.data.area) {
            if (i % 5 === 0) {
              const t = Math.atan2(dy, dx);
              px -= 0.03 * Math.cos(t);
              py -= 0.03 * Math.sin(t);
            } else {
              const t = Math.atan2(dy, dx);
              px += f * Math.cos(t);
              py += f * Math.sin(t);
              pos.setXYZ(i, px, py, pz);
              pos.needsUpdate = true;
            }
          }
        }
        
        px += (initX - px) * this.data.ease;
        py += (initY - py) * this.data.ease;
        pz += (initZ - pz) * this.data.ease;
        
        pos.setXYZ(i, px, py, pz);
        pos.needsUpdate = true;
      }
    }
  }

  visibleHeightAtZDepth(depth, camera) {
    const cameraOffset = camera.position.z;
    if (depth < cameraOffset) depth -= cameraOffset;
    else depth += cameraOffset;
    const vFOV = camera.fov * Math.PI / 180;
    return 2 * Math.tan(vFOV / 2) * Math.abs(depth);
  }

  visibleWidthAtZDepth(depth, camera) {
    const height = this.visibleHeightAtZDepth(depth, camera);
    return height * camera.aspect;
  }

  distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }
}

// ---------------------- BackgroundGrid with Click-Only Smooth Transition ----------------------
class BackgroundGrid {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.gridRows = 20;
    this.gridCols = 30;

    // Track mouse position (normalized device coordinates)
    this.mouse = new THREE.Vector2(0, 0);
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
    });

    // Track click events. Movement effect is activated only during a click.
    this.clickActive = false;
    this.clickTime = 0;
    this.clickOrigin = new THREE.Vector3();
    // clickSmooth is used to smoothly ramp into the warp effect.
    this.clickSmooth = 0;

    document.addEventListener('mousedown', (e) => {
      this.clickActive = true;
      this.clickTime = performance.now();
      // Compute click world position at grid depth (-150)
      let clickVec = new THREE.Vector3(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
        0.5
      );
      clickVec.unproject(this.camera);
      let dir = clickVec.sub(this.camera.position).normalize();
      let t = (-150 - this.camera.position.z) / dir.z;
      this.clickOrigin = this.camera.position.clone().add(dir.multiplyScalar(t));
    });
    document.addEventListener('mouseup', () => {
      this.clickActive = false;
    });

    this.buildGrid();
  }

  buildGrid() {
    if (this.points) {
      this.group.remove(this.points);
      this.points.geometry.dispose();
      this.points.material.dispose();
      this.points = null;
    }

    const depth = -150;
    const visibleWidth = this.visibleWidthAtZDepth(depth);
    const visibleHeight = this.visibleHeightAtZDepth(depth);

    const cellSpacingX = visibleWidth / (this.gridCols - 1);
    const cellSpacingY = visibleHeight / (this.gridRows - 1);

    const marginX = cellSpacingX / 2;
    const marginY = cellSpacingY / 2;
    const adjustedWidth = visibleWidth + marginX * 2;
    const adjustedHeight = visibleHeight + marginY * 2;

    const positions = [];
    for (let i = 0; i < this.gridRows; i++) {
      for (let j = 0; j < this.gridCols; j++) {
        const x = j / (this.gridCols - 1) * adjustedWidth - adjustedWidth / 2;
        const y = i / (this.gridRows - 1) * adjustedHeight - adjustedHeight / 2;
        const z = depth;
        positions.push(x, y, z);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.originalPositions = Float32Array.from(positions);

    const material = new THREE.PointsMaterial({
      size: 2,
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false
    });

    this.points = new THREE.Points(geometry, material);
    this.points.renderOrder = 0;
    this.group.add(this.points);
  }

  update() {
    if (!this.points) return;
    const positions = this.points.geometry.attributes.position.array;
    const warpLerp = 0.1; // Lerp factor for gradual transition

    // Smoothly update clickSmooth:
    if (this.clickActive) {
      // Slowly ramp up when clicking.
      this.clickSmooth = THREE.MathUtils.lerp(this.clickSmooth, 1, 0.05);
    } else {
      // Quickly ramp down when not clicking.
      this.clickSmooth = THREE.MathUtils.lerp(this.clickSmooth, 0, 0.8);
    }

    // When clickSmooth is near zero, smoothly reset positions.
    if (this.clickSmooth < 0.001) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = THREE.MathUtils.lerp(positions[i], this.originalPositions[i], warpLerp);
        positions[i + 1] = THREE.MathUtils.lerp(positions[i + 1], this.originalPositions[i + 1], warpLerp);
        positions[i + 2] = this.originalPositions[i + 2];
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      return;
    }

    // Project current mouse position into world space at grid depth.
    const depth = -150;
    const camPos = this.camera.position.clone();
    let mouseVec = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
    mouseVec.unproject(this.camera);
    let dir = mouseVec.sub(camPos).normalize();
    let t = (depth - camPos.z) / dir.z;
    let mouseWorldPos = camPos.add(dir.multiplyScalar(t));

    // Parameters for warp effect.
    const threshold = 300;       // Effect fades over 300 units.
    const mouseInfluence = 0.1;    // Maximum subtle warp offset.
    const maxRippleOffset = 0.1;   // Maximum additional ripple offset.

    for (let i = 0; i < positions.length; i += 3) {
      const origX = this.originalPositions[i];
      const origY = this.originalPositions[i + 1];
      const origZ = this.originalPositions[i + 2];

      // Compute base warp offset based on current mouse position.
      const dx = mouseWorldPos.x - origX;
      const dy = mouseWorldPos.y - origY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = Math.max(0, (threshold - dist) / threshold);
      const offsetX = dx * factor * mouseInfluence;
      const offsetY = dy * factor * mouseInfluence;

      // Compute ripple offset based on the clickOrigin.
      let rippleOffsetX = 0;
      let rippleOffsetY = 0;
      const rdx = origX - this.clickOrigin.x;
      const rdy = origY - this.clickOrigin.y;
      const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rdist > 0) {
        rippleOffsetX = (rdx / rdist) * this.clickSmooth * maxRippleOffset;
        rippleOffsetY = (rdy / rdist) * this.clickSmooth * maxRippleOffset;
      }

      // Calculate target positions.
      const targetX = origX + offsetX + rippleOffsetX;
      const targetY = origY + offsetY + rippleOffsetY;

      // Gradually interpolate from current position to target.
      positions[i] = THREE.MathUtils.lerp(positions[i], targetX, warpLerp);
      positions[i + 1] = THREE.MathUtils.lerp(positions[i + 1], targetY, warpLerp);
      positions[i + 2] = origZ;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  rebuild() {
    this.buildGrid();
  }

  visibleWidthAtZDepth(depth) {
    const cameraOffset = this.camera.position.z;
    let z = depth;
    if (z < cameraOffset) z -= cameraOffset; else z += cameraOffset;
    const vFOV = this.camera.fov * Math.PI / 180;
    const visibleHeight = 2 * Math.tan(vFOV / 2) * Math.abs(z);
    return visibleHeight * this.camera.aspect;
  }

  visibleHeightAtZDepth(depth) {
    const cameraOffset = this.camera.position.z;
    let z = depth;
    if (z < cameraOffset) z -= cameraOffset; else z += cameraOffset;
    const vFOV = this.camera.fov * Math.PI / 180;
    return 2 * Math.tan(vFOV / 2) * Math.abs(z);
  }
}
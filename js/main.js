import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// --- Configuration ---
// --- Configuration ---
const ROTATION_STEP = Math.PI / 2;
// Default Desktop Values
let ANIMATION_SPEED = 0.04;
let PARTICLE_COUNT = 600;
let TRAIL_COUNT = 10;

const PARTICLE_SIZE = 0.01;
const OBJECT_SCALE_MULTIPLIER = 1.1;

// --- Trail Configuration ---
const TRAIL_SEPARATION = 0.005;     // Separation between trails (lower = tighter)
const TRAIL_START_OPACITY = 0.2;   // Base opacity
const TRAIL_OPACITY_DECAY = 0.85;  // Decay per step (higher = longer visible tail)
const TRAIL_BLUR_DISPLACEMENT = 0.02; // "Wobble" / Vertex displacement (not straight lines)
const TRAIL_BLUR_AMOUNT = 0.02;     // Pixel blur / Noise grain strength

// --- State ---
let targetRotationY = 0;
let targetRotationX = 0;
let currentRotationY = 0;
let currentRotationX = 0;
let isAnimating = false;
let absoluteWheelOffset = 0;
let relativeWheelOffset = 0;

let currentScrollY = 0;
let currentScrollX = 0;

let scrollMultiplier = 1;

const MIN_WHEEL_OFFSET = -5400;
const MAX_WHEEL_OFFSET = 5400;
const MAX_SCROLL_PIXELS = 600;
const MAX_SCROLL_PIXELS_DOWN = 500;
const MAX_SCROLL_PIXELS_UP = 5400;
const SCROLL_VALUE_CENTERED = 700;

let mobileScrollVelocity = 14;
const MOBILE_SCROLL_FRICTION = 0.98; // closer to 1 = longer glide
const MOBILE_SCROLL_POWER = 1.4;     // finger strength

let daddedMinMaxWhell = 0;

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    scrollMultiplier = Math.min(15, window.innerHeight / 120);
    daddedMinMaxWhell = 1000;

    // Performance / Speed optimizations for Mobile
    ANIMATION_SPEED = 0.15;
    PARTICLE_COUNT = 100;
    TRAIL_COUNT = 3;
}

// Trail State
const trails = [];
let centerScrollAccumulator = 0;

// UI Elements
const labels = {
    center: document.getElementById('label-center'),
    back: document.getElementById('label-back'),
    left: document.getElementById('label-left'),
    right: document.getElementById('label-right'),
    up: document.getElementById('label-up'),
    down: document.getElementById('label-down')
};

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(1, 1, 2);
scene.add(directionalLight);

// Rotation Group
const pivot = new THREE.Group();
scene.add(pivot);

// Particles
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleOriginalPositions = new Float32Array(PARTICLE_COUNT * 3);
const particleNoiseOffsets = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = (Math.random() - 0.5) * 5;
    const y = (Math.random() - 0.5) * 5;
    const z = (Math.random() - 0.5) * 5;

    particlePositions[i * 3] = x;
    particlePositions[i * 3 + 1] = y;
    particlePositions[i * 3 + 2] = z;

    particleOriginalPositions[i * 3] = x;
    particleOriginalPositions[i * 3 + 1] = y;
    particleOriginalPositions[i * 3 + 2] = z;

    particleNoiseOffsets.push(Math.random() * 100);
}
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

const particleMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: PARTICLE_SIZE,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// --- Custom "Modern Noise Gradient" Shader ---
const brutalistGlassShader = {
    uniforms: {
        time: { value: 0 },
        fresnelBias: { value: 0.1 },
        fresnelScale: { value: 1.0 },
        fresnelPower: { value: 2.0 },
        opacity: { value: 1.0 },
        displacementStrength: { value: 0.0 }, // Vertex wobble
        blurStrength: { value: 0.0 }          // Pixel noise
    },
    vertexShader: `
        uniform float time;
        uniform float displacementStrength;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        // Simple vertex noise for "aura" shake
        float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
        float noise(vec2 x) {
            vec2 i = floor(x);
            vec2 f = fract(x);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            
            vec3 pos = position;
            // Add subtle noise displacement if strength > 0 (for ghosts)
            if (displacementStrength > 0.0) {
                float n = noise(pos.xy * 2.0 + time * 5.0);
                pos += normal * n * displacementStrength;
            }

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            vViewPosition = -mvPosition.xyz;
            vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float fresnelBias;
        uniform float fresnelScale;
        uniform float fresnelPower;
        uniform float opacity;
        uniform float blurStrength;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

        float noise(vec2 x) {
            vec2 i = floor(x);
            vec2 f = fract(x);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float fbm(vec2 x) {
            float v = 0.0;
            float a = 0.5;
            vec2 shift = vec2(100.0);
            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
            for (int i = 0; i < 3; ++i) {
                v += a * noise(x);
                x = rot * x * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        // High frequency noise for pixel blur grain
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);

            float t = time * 0.2;
            float n1 = fbm(vWorldPosition.xy * 0.5 + vec2(t, t * 0.5));
            float n2 = fbm(vWorldPosition.yz * 0.5 + vec2(-t * 0.5, t));
            
            vec3 c_green = vec3(0.0, 0.8, 0.2);
            vec3 c_yellow = vec3(1.0, 0.9, 0.1);
            vec3 c_red    = vec3(1.0, 0.2, 0.1);
            vec3 c_orange = vec3(1.0, 0.5, 0.0);
            vec3 c_blue   = vec3(0.0, 0.2, 0.9);
            vec3 c_soft   = vec3(0.4, 0.7, 1.0);
            vec3 c_violet = vec3(0.6, 0.0, 0.9);

            vec3 colA = mix(c_green, c_yellow, smoothstep(0.0, 0.5, n1));
            colA = mix(colA, c_red, smoothstep(0.5, 1.0, n1));
            
            vec3 colB = mix(c_blue, c_soft, smoothstep(0.0, 0.5, n2));
            colB = mix(colB, c_violet, smoothstep(0.5, 1.0, n2));
            
            float mixer = 0.5 + 0.5 * sin(t * 0.5 + vWorldPosition.x * 0.5);
            vec3 baseColor = mix(colA, colB, mixer);
            
            float highlight = smoothstep(0.7, 1.0, n1 * n2);
            baseColor = mix(baseColor, c_orange, highlight);

            float fresnel = fresnelBias + fresnelScale * pow(1.0 + dot(-viewDir, normal), fresnelPower);
            baseColor += vec3(fresnel * 0.5);
            
            // Add Blur/Grain if strength > 0
            if (blurStrength > 0.0) {
                float grain = random(gl_FragCoord.xy * time);
                // Mix base color with some randomized offset or just noise
                baseColor = mix(baseColor, baseColor * (0.8 + 0.4 * grain), blurStrength);
            }

            // Apply Opacity
            gl_FragColor = vec4(baseColor, opacity); 
        }
    `
};

const customMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        fresnelBias: { value: 0.1 },
        fresnelScale: { value: 1.0 },
        fresnelPower: { value: 2.0 },
        opacity: { value: 1.0 },
        displacementStrength: { value: 0.0 },
        blurStrength: { value: 0.0 }
    },
    vertexShader: brutalistGlassShader.vertexShader,
    fragmentShader: brutalistGlassShader.fragmentShader,
    side: THREE.DoubleSide,
    transparent: false // Opaque for main
});

// Load OBJ
const loader = new OBJLoader();
loader.load('assets/model.obj', (object) => {
    // Center and scale
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (2 / maxDim) * OBJECT_SCALE_MULTIPLIER; // Apply Multiplier

    // Config function to setup mesh
    const setupMesh = (obj, mat) => {
        obj.scale.set(scale, scale, scale);
        obj.position.sub(center.multiplyScalar(scale));
        obj.traverse((child) => {
            if (child.isMesh) {
                child.material = mat;
            }
        });
    };

    // 1. Setup Main Object
    setupMesh(object, customMaterial);
    pivot.add(object);

    // --- Inserted: Image Plane ---
    const texLoader = new THREE.TextureLoader();
    texLoader.load('assets/character/character03.png', (texture) => {
        // Adjust plane aspect ratio if needed, for now square 3x3 approx match visual
        const planeGeo = new THREE.PlaneGeometry(1.25, 2.5);
        const planeMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: false, // Ensure it draws ON TOP of everything else
            depthWrite: false
        });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.renderOrder = 999; // Draw last
        planeMesh.position.set(0, 0, 0.3);
        introPlane = planeMesh; // Assign to global for animation transparency
        pivot.add(planeMesh);
    });
    // -----------------------------

    // 2. Setup Ghost Trails
    for (let i = 0; i < TRAIL_COUNT; i++) {
        const ghostPivot = new THREE.Group();

        const speed = ANIMATION_SPEED * (1.0 - (i + 1) * TRAIL_SEPARATION);

        // Clone object geometry
        const ghostObj = object.clone();

        // Clone material for independent opacity/uniforms
        const ghostMat = customMaterial.clone();
        ghostMat.transparent = true;

        const op = TRAIL_START_OPACITY * Math.pow(TRAIL_OPACITY_DECAY, i);
        ghostMat.uniforms.opacity.value = op;

        const noiseFactor = 1.0 + (i * 0.2);
        ghostMat.uniforms.displacementStrength.value = TRAIL_BLUR_DISPLACEMENT * noiseFactor;
        ghostMat.uniforms.blurStrength.value = TRAIL_BLUR_AMOUNT * noiseFactor;

        setupMesh(ghostObj, ghostMat);

        ghostPivot.add(ghostObj);
        scene.add(ghostPivot);

        trails.push({
            group: ghostPivot,
            speed: Math.max(0.001, speed), // Clamp min speed
            material: ghostMat,
            currentRotX: 0,
            currentRotY: 0
        });
    }

    document.getElementById('loading').style.display = 'none';
    updateLabels();
}, undefined, (error) => {
    console.error('An error occurred loading the model:', error);
    document.getElementById('loading').textContent = 'Error carregant el model.';
});

// --- Interaction Logic ---

function rotate(xDelta, yDelta) {
    const upDownThreshold = Math.PI / 2 - 0.01;
    const isLockedVertical = Math.abs(targetRotationX) >= upDownThreshold;

    if (xDelta !== 0) { // Trying to pitch
        let newTargetX = targetRotationX + (xDelta * ROTATION_STEP);
        if (newTargetX > Math.PI / 2 + 0.01) return false; // Blocked Top
        if (newTargetX < -Math.PI / 2 - 0.01) return false; // Blocked Bottom
        targetRotationX = newTargetX;
    }

    // Horizontal Check (Yaw)
    if (yDelta !== 0) {
        let newTargetY = targetRotationY + (yDelta * ROTATION_STEP);

        // Let's use Segment logic to detect "Left" and "Right" states.
        const ry = targetRotationY % (Math.PI * 2);
        // Normalize
        let normRy = ry;
        if (normRy < 0) normRy += Math.PI * 2;
        const segment = Math.round(normRy / (Math.PI / 2)) % 4;

        if (newTargetY > Math.PI / 2 + 0.01) return false; // Block Right limit? (depends on axis)
        if (newTargetY < -Math.PI / 2 - 0.01) return false; // Block Left limit?

        targetRotationY = newTargetY;
    }

    relativeWheelOffset = 0;
    triggerParticles();
    return true; // Success
}

function triggerParticles() {
    particleMaterial.opacity = 0.8;
}

let startX = 0;
let startY = 0;
let isDragging = false;
let inputBlocked = false;

function onStart(x, y) {
    startX = x;
    startY = y;
    isDragging = true;
}

function onMove(x, y) {
    if (!isDragging || inputBlocked) return;
    console.log("onMove");
    const dx = x - startX;
    const dy = y - startY;
    const threshold = 50;

    if (isMobile && absY > absX) {
        mobileScrollVelocity += dy * MOBILE_SCROLL_POWER;
        return;
    }
    
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        let rotated = false;
        if (isHorizontal) {
            rotated = rotate(0, dx > 0 ? 1 : -1);
        } else {
            if (dy < 0) {
                console.log("Vertical Swipe Up");
                if (relativeWheelOffset >= 0) {
                    rotated = rotate(dy > 0 ? 1 : -1, 0);
                } else {
                    rotated = false;
                }
            } else if (dy > 0) {
                console.log("Vertical Swipe Down");
                if (relativeWheelOffset >= -30) {
                    rotated = rotate(dy > 0 ? 1 : -1, 0);
                } else {
                    rotated = false;
                }
            }
        }

        if (!rotated) {
            if (isHorizontal) {

                relativeWheelOffset += dx * 0.5;
            }
            else {
                // dy > 0 (Down Swipe). relativeOffset += dy.
                relativeWheelOffset += dy * 0.5;
            }

            // Clamp
            relativeWheelOffset = Math.max(MIN_WHEEL_OFFSET - daddedMinMaxWhell, Math.min(MAX_WHEEL_OFFSET + daddedMinMaxWhell, relativeWheelOffset));
        }

        inputBlocked = true;
        setTimeout(() => { inputBlocked = false; }, 400);
    }
}

function onEnd() {
    isDragging = false;
    inputBlocked = false;
}

// Event Listeners
window.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', onEnd);

window.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchend', onEnd);

window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowRight': rotate(0, 1); break;
        case 'ArrowLeft': rotate(0, -1); break;
        case 'ArrowUp': rotate(-1, 0); break;
        case 'ArrowDown': rotate(1, 0); break;
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mouse Wheel Tracking
window.addEventListener('wheel', (e) => {
    const eps = 0.1;
    const isCenteredX = Math.abs(targetRotationX) < eps; // Use target for immediate feedback responsiveness
    let ry = targetRotationY % (Math.PI * 2);
    if (ry < 0) ry += Math.PI * 2;
    const segment = Math.round(ry / (Math.PI / 2)) % 4;
    const isCenteredY = (segment === 0);
    const isCentered = isCenteredX && isCenteredY;

    if (isCentered) {
        centerScrollAccumulator -= e.deltaY;

        if (Math.abs(centerScrollAccumulator) > SCROLL_VALUE_CENTERED) {
            if (centerScrollAccumulator > 0) {
                // Positive Accumulator (caused by Scroll Up) -> Go Down
                rotate(1, 0);
            } else {
                // Negative Accumulator (caused by Scroll Down) -> Go Up
                rotate(-1, 0);
            }
            centerScrollAccumulator = 0; // Reset after trigger
        }
    } else {
        centerScrollAccumulator = 0; // Reset accumulator

        if (targetRotationX > 0.1) {
            relativeWheelOffset -= e.deltaY;
            absoluteWheelOffset -= e.deltaY;
        } else {
            relativeWheelOffset += e.deltaY;
            absoluteWheelOffset += e.deltaY;
        }

        relativeWheelOffset = Math.max(MIN_WHEEL_OFFSET - daddedMinMaxWhell, Math.min(MAX_WHEEL_OFFSET + daddedMinMaxWhell, relativeWheelOffset));
        checkAutoReturn();
    }
});


function checkAutoReturn() {
    if (relativeWheelOffset < 10) {
        const eps = 0.1;
        const isCenteredX = Math.abs(targetRotationX) < eps;

        let ry = targetRotationY % (Math.PI * 2);
        if (ry > 0) ry += Math.PI * 2;
        const segment = Math.round(ry / (Math.PI / 2)) % 4;
        const isCenteredY = (segment === 0);

        if (!isCenteredX || !isCenteredY) {
            returnToCenter();
        }
    }
}

function returnToCenter() {
    if (Math.abs(targetRotationX) > 0.1) {
        if (targetRotationX > 0) rotate(-1, 0);
        else rotate(1, 0);
        return; // Prioritize one move at a time
    }

    let currentY = targetRotationY;
    const PI_2 = Math.PI / 2;
    // Round to nearest 90 deg step to be safe
    const roundedY = Math.round(targetRotationY / PI_2) * PI_2;


    let index = Math.round(roundedY / PI_2);
    let ry = targetRotationY % (Math.PI * 2);
    if (ry < 0) ry += Math.PI * 2;
    const seg = Math.round(ry / (Math.PI / 2)) % 4;

    if (seg === 1) rotate(0, -1); // Left -> Go Right
    else if (seg === 3) rotate(0, 1); // Right -> Go Left
    else if (seg === 2) rotate(0, 1); // Back -> Go Left (arbitrary)

}

// UI Logic
function updateLabels() {
    Object.values(labels).forEach(l => l.classList.remove('visible'));

    const eps = 0.1;

    if (Math.abs(currentRotationX - Math.PI / 2) < eps) {
        labels.up.classList.add('visible');
        return;
    }
    if (Math.abs(currentRotationX + Math.PI / 2) < eps) {
        labels.down.classList.add('visible');
        return;
    }

    if (Math.abs(currentRotationX) < eps) {
        let ry = currentRotationY % (Math.PI * 2);
        if (ry < 0) ry += Math.PI * 2;

        const segment = Math.round(ry / (Math.PI / 2)) % 4;

        if (segment === 0) labels.center.classList.add('visible');
        else if (segment === 1) labels.left.classList.add('visible');
        else if (segment === 2) labels.back.classList.add('visible');
        else if (segment === 3) labels.right.classList.add('visible');
    }
}

let time = 0;
let introPlane = null; // Global reference for opacity animation

function animate() {
    requestAnimationFrame(animate);

    if (isMobile) {
        mobileScrollVelocity *= MOBILE_SCROLL_FRICTION;
    
        if (Math.abs(mobileScrollVelocity) < 0.05) {
            mobileScrollVelocity = 0;
        }
    
        relativeWheelOffset += mobileScrollVelocity;
    
        // Soft clamp (prevents hard stop)
        const limit = MAX_WHEEL_OFFSET + daddedMinMaxWhell;
        if (relativeWheelOffset > limit) {
            relativeWheelOffset = limit;
            mobileScrollVelocity *= 0.3; // absorb energy
        }
        if (relativeWheelOffset < -limit) {
            relativeWheelOffset = -limit;
            mobileScrollVelocity *= 0.3;
        }
    }
    
    time += 0.01;

    // Update Shader Uniforms
    customMaterial.uniforms.time.value = time;

    // Smooth Rotate Main Pivot
    currentRotationX += (targetRotationX - currentRotationX) * ANIMATION_SPEED;
    currentRotationY += (targetRotationY - currentRotationY) * ANIMATION_SPEED;

    pivot.rotation.x = currentRotationX;
    pivot.rotation.y = currentRotationY;

    // Update Trails
    trails.forEach(trail => {
        trail.currentRotX += (targetRotationX - trail.currentRotX) * trail.speed;
        trail.currentRotY += (targetRotationY - trail.currentRotY) * trail.speed;

        trail.group.rotation.x = trail.currentRotX;
        trail.group.rotation.y = trail.currentRotY;

        // Update ghost material time/uniforms
        trail.material.uniforms.time.value = time;
    });

    // Particle Animation
    if (particleMaterial.opacity > 0.0) {
        particleMaterial.opacity -= 0.005;
        if (particleMaterial.opacity < 0) particleMaterial.opacity = 0;
    }

    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const offset = particleNoiseOffsets[i];

        positions[ix] = particleOriginalPositions[ix] + Math.sin(time + offset) * 0.2;
        positions[ix + 1] = particleOriginalPositions[ix + 1] + Math.cos(time + offset * 0.5) * 0.2;
        positions[ix + 2] = particleOriginalPositions[ix + 2] + Math.sin(time * 0.5 + offset) * 0.2;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    updateLabels();

    // --- Body Scroll Transformation ---
    const eps = 0.1;
    const isCenteredX = Math.abs(currentRotationX) < eps;
    let ry = currentRotationY % (Math.PI * 2);
    if (ry < 0) ry += Math.PI * 2;
    const segment = Math.round(ry / (Math.PI / 2)) % 4;
    const isCenteredY = (segment === 0);
    const isCentered = isCenteredX && isCenteredY;

    // Check for Image Plane Opacity
    if (introPlane) {
        const distY = Math.abs(currentRotationY % (Math.PI * 2));
        const distY_norm = Math.min(distY, Math.PI * 2 - distY);
        const distX = Math.abs(currentRotationX);

        // Threshold for "Front View" visibility (approx 15 degrees)
        const isStrictlyFront = (distX < 0.25) && (distY_norm < 0.25);

        const targetOpacity = isStrictlyFront ? 1.0 : 0.0;

        // Split interpolation: Fast Fade Out, Smooth Fade In
        const currentOpacity = introPlane.material.opacity;
        const lerpFactor = (targetOpacity > currentOpacity) ? 0.03 : 0.25;

        introPlane.material.opacity += (targetOpacity - currentOpacity) * lerpFactor;

        // Hide completely if near zero to save performance/z-fighting
        introPlane.visible = introPlane.material.opacity > 0.01;
    }

    let targetScrollX = 0;
    let targetScrollY = 0;

    let verticalInHorizontal = false;

    if (!isCentered) {
        // Multiplier is now softer (0.3)
        const val = relativeWheelOffset * scrollMultiplier;

        if (Math.abs(currentRotationX - Math.PI / 2) < eps) {
            // UP View (Positive X)
            targetScrollY = val;
        }
        else if (Math.abs(currentRotationX + Math.PI / 2) < eps) {
            targetScrollY = val;
        }
        else {
            // Horizontal Views
            if (segment === 1) { // Left
                targetScrollX = val;

            } else if (segment === 3) { // Right
                targetScrollX = val;
            } else if (segment === 2) { // Back
                targetScrollY = val;
            }
        }
    }
    targetScrollX = Math.max(-MAX_SCROLL_PIXELS, Math.min(MAX_SCROLL_PIXELS, targetScrollX));

    if (Math.abs(currentRotationX + Math.PI / 2) < eps && relativeWheelOffset > 0) {
        targetScrollY *= -1;
    }

    if (segment === 3 && relativeWheelOffset > 0) {
        targetScrollX *= -1;
    }

    targetScrollY = Math.max(-MAX_SCROLL_PIXELS_UP - daddedMinMaxWhell, Math.min(MAX_SCROLL_PIXELS_DOWN, targetScrollY));

    const lerpFactor = isMobile ? 0.5 : 0.12;
    currentScrollY += (targetScrollY - currentScrollY) * lerpFactor;
    currentScrollX += (targetScrollX - currentScrollX) * lerpFactor;


    // Check if Down View
    const isDownView = Math.abs(currentRotationX + Math.PI / 2) < 0.1;

    // Default: Move Canvas
    document.getElementById('canvas-container').style.transform = `translate(${currentScrollX}px, ${currentScrollY}px)`;

    // Explicitly Handle 'scroll-container-down' scrolling
    const scrollContainerDown = document.getElementById('scroll-container-down');
    if (scrollContainerDown) {
        if (isDownView) {
            scrollContainerDown.style.transform = `translateY(${currentScrollY}px)`;
        } else {
            scrollContainerDown.style.transform = `translateY(0px)`;
        }
    }
    renderer.render(scene, camera);
}

// --- UI Animation Trigger ---
setTimeout(() => {
    const centerLabel = document.getElementById('label-center');
    if (centerLabel) {
        centerLabel.classList.add('slide-open');
    }
}, 2000); // 2 seconds delay

animate();






import * as THREE from "three";
import * as CANNON from "cannon-es";

/** A constrained chain of rigid bodies in a 3D gravity field, rendered as real geometry. */
export function mountHanging(host: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.7, 1.7, 0.08, -9.32, 0.1, 40);
  camera.position.set(0, 0, 18);
  scene.add(new THREE.HemisphereLight(0xfff6df, 0x7f949d, 2.5));
  const key = new THREE.DirectionalLight(0xffe6b0, 3.5);
  key.position.set(-3, 4, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 2);
  rim.position.set(4, -2, 3);
  scene.add(rim);

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0), allowSleep: true });
  const solver = world.solver as CANNON.GSSolver;
  solver.iterations = 14;
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a45, metalness: 0.72, roughness: 0.3 });
  const darkBrass = new THREE.MeshStandardMaterial({ color: 0x785224, metalness: 0.6, roughness: 0.4 });
  const saffron = new THREE.MeshStandardMaterial({ color: 0xedac32, roughness: 0.85 });
  const golden = new THREE.MeshStandardMaterial({ color: 0xf4c452, roughness: 0.9 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x35775b, roughness: 0.75, side: THREE.DoubleSide });
  const sphere = new THREE.SphereGeometry(1, 8, 6);
  const petal = new THREE.SphereGeometry(1, 6, 4);
  const cordGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);
  const torus = new THREE.TorusGeometry(0.2, 0.035, 6, 24);
  const bellProfile = [new THREE.Vector2(0.02, 0.31), new THREE.Vector2(0.075, 0.29), new THREE.Vector2(0.1, 0.2), new THREE.Vector2(0.13, 0.02), new THREE.Vector2(0.2, -0.1), new THREE.Vector2(0.22, -0.13), new THREE.Vector2(0.18, -0.15)];
  const bellGeometry = new THREE.LatheGeometry(bellProfile, 28);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(-0.3, -0.12, -0.32, -0.48, 0, -0.75);
  leafShape.bezierCurveTo(0.23, -0.39, 0.26, -0.14, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape);
  const links: { body: CANNON.Body; mesh: THREE.Group }[] = [];
  const pendants: CANNON.Body[] = [];
  const cords: { a: CANNON.Body; b: CANNON.Body; mesh: THREE.Mesh }[] = [];
  const addMesh = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const flower = (group: THREE.Group, alternate: boolean) => {
    addMesh(group, sphere, saffron).scale.setScalar(0.15);
    // Two staggered whorls of petals give the marigolds volume from every angle.
    for (let ring = 0; ring < 2; ring++) for (let n = 0; n < 9; n++) {
      const angle = (n / 9) * Math.PI * 2 + ring * 0.35;
      const mesh = addMesh(group, petal, alternate ? golden : saffron, Math.cos(angle) * 0.13, Math.sin(angle) * 0.12, ring ? 0.08 : -0.07);
      mesh.scale.set(0.105, 0.105, 0.12);
    }
  };

  for (const [strand, config] of [{ x: -0.72, count: 10 }, { x: 0.02, count: 14 }, { x: 0.69, count: 11 }].entries()) {
    let previous = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(config.x, 0.06, 0) });
    world.addBody(previous);
    for (let n = 0; n < config.count; n++) {
      const length = 0.53;
      const body = new CANNON.Body({ mass: n === config.count - 1 ? 0.16 : 0.035, shape: new CANNON.Sphere(0.12), position: new CANNON.Vec3(config.x, 0.06 - (n + 1) * length, 0), linearDamping: 0.35, angularDamping: 0.7 });
      // Adjacent ornaments never collide; gravity and distance joints govern each chain.
      body.collisionFilterMask = 0;
      world.addBody(body);
      world.addConstraint(new CANNON.DistanceConstraint(previous, body, length, 60));
      const group = new THREE.Group();
      scene.add(group);
      if ([2, 3, 4, config.count - 3, config.count - 2].includes(n)) flower(group, n % 2 === 0);
      else if (n === 5 || n === 6) {
        const leaf = addMesh(group, leafGeometry, leafMaterial);
        leaf.rotation.set(0.15, n % 2 ? -0.3 : 0.3, n % 2 ? -0.65 : 0.65);
        addMesh(group, sphere, brass).scale.setScalar(0.045);
      } else if (n === config.count - 1) {
        addMesh(group, bellGeometry, brass);
        const lip = addMesh(group, torus, brass, 0, -0.13);
        lip.rotation.x = Math.PI / 2;
        const clapper = addMesh(group, sphere, darkBrass, 0, -0.27);
        clapper.scale.setScalar(0.055);
        addMesh(group, cordGeometry, darkBrass, 0, -0.16).scale.y = 0.22;
        const loop = addMesh(group, torus, brass, 0, 0.34);
        loop.scale.setScalar(0.35);
      } else addMesh(group, sphere, brass).scale.setScalar(0.055);
      links.push({ body, mesh: group });
      const cord = new THREE.Mesh(cordGeometry, brass);
      scene.add(cord);
      cords.push({ a: previous, b: body, mesh: cord });
      previous = body;
    }
    previous.applyImpulse(new CANNON.Vec3(strand % 2 ? -0.035 : 0.025, 0, 0.018));
    pendants.push(previous);
  }

  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  let frame = 0;
  let lastTime = 0;
  let visible = true;
  let disposed = false;
  const draw = (time: number) => {
    if (disposed || !visible || document.hidden) { frame = 0; return; }
    // Fixed physics timestep, bounded catch-up. Render at 30fps for a small ornament.
    if (time - lastTime >= 1000 / 30) {
      world.step(1 / 60, Math.min((time - (lastTime || time)) / 1000, 0.06), 4);
      lastTime = time;
      for (const { body, mesh } of links) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }
      for (const { a, b, mesh } of cords) {
        start.copy(a.position); end.copy(b.position);
        direction.subVectors(end, start);
        mesh.position.copy(start).add(end).multiplyScalar(0.5);
        mesh.scale.y = direction.length();
        mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      }
      renderer.render(scene, camera);
      host.dataset.ready = "true";
    }
    frame = requestAnimationFrame(draw);
  };
  const resume = () => { if (!frame && visible && !document.hidden) { lastTime = 0; frame = requestAnimationFrame(draw); } };
  const resize = new ResizeObserver(() => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    resume();
  });
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
  let lastNudge = 0;
  let previousScroll = window.scrollY;
  const nudge = (event: PointerEvent) => {
    if (!visible || document.hidden) return;
    if (event.timeStamp - lastNudge < 32 || event.pointerType === "touch") return;
    const bounds = host.getBoundingClientRect();
    if (event.clientX > bounds.left - 30 && event.clientX < bounds.right + 60 && event.clientY > bounds.top && event.clientY < bounds.bottom) {
      lastNudge = event.timeStamp;
      // A capped impulse, rather than cursor-driven transforms, preserves physical momentum.
      pendants.forEach((body, i) => body.applyImpulse(new CANNON.Vec3(Math.max(-0.006, Math.min(0.006, event.movementX * 0.0007)) * (1 - i * 0.15), 0, Math.max(-0.003, Math.min(0.003, event.movementY * 0.0003)))));
    }
  };
  const scrollNudge = () => {
    const delta = window.scrollY - previousScroll;
    previousScroll = window.scrollY;
    if (!visible || document.hidden) return;
    const impulse = Math.max(-0.009, Math.min(0.009, delta * 0.0003));
    pendants.forEach((body, i) => body.applyImpulse(new CANNON.Vec3(impulse * (i % 2 ? -0.65 : 0.8), 0, impulse * 0.5)));
  };
  const contextLost = (event: Event) => { event.preventDefault(); dispose(); };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect(); intersection.disconnect();
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("pointermove", nudge);
    window.removeEventListener("scroll", scrollNudge);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    scene.traverse((object) => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    geometries.forEach((geometry) => geometry.dispose());
    [brass, darkBrass, saffron, golden, leafMaterial].forEach((material) => material.dispose());
    renderer.dispose(); renderer.domElement.remove();
    delete host.dataset.ready;
  };
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  resize.observe(host); intersection.observe(host);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pointermove", nudge, { passive: true });
  window.addEventListener("scroll", scrollNudge, { passive: true });
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resume();
  return dispose;
}

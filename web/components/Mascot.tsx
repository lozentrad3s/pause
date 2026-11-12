"use client";

// Pip, the Pause mascot: a small clay guardian whose eyes are the two pause
// bars, wearing the amber hold ring. `Pip` is the flat drawing used around the
// site. `Pip3D` is the same character built in three.js: it watches the
// pointer, blinks, and ducks when pressed. The drawing shows first and stays
// if WebGL is not available.

import { useEffect, useRef, useState } from "react";

export function Pip({ size = 120, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg className={`pip ${className}`} width={size} height={size} viewBox="0 0 200 200" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id="pip-body" cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#8f74ff" />
          <stop offset="0.55" stopColor="#5b36ee" />
          <stop offset="1" stopColor="#3a1fb8" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="186" rx="52" ry="7" fill="#0b0a1f" opacity="0.14" />
      <path d="M28 128 A76 30 0 0 0 172 128" fill="none" stroke="#b56d06" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
      <ellipse cx="74" cy="176" rx="22" ry="10" fill="#3a1fb8" />
      <ellipse cx="126" cy="176" rx="22" ry="10" fill="#3a1fb8" />
      <ellipse cx="100" cy="104" rx="66" ry="72" fill="url(#pip-body)" />
      <ellipse cx="78" cy="62" rx="22" ry="12" fill="#ffffff" opacity="0.2" transform="rotate(-24 78 62)" />
      <rect x="76" y="74" width="15" height="44" rx="7.5" fill="#ffffff" />
      <rect x="109" y="74" width="15" height="44" rx="7.5" fill="#ffffff" />
      <path d="M90 134 Q100 142 110 134" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 122 A80 32 0 0 0 178 122" fill="none" stroke="#e8930c" strokeWidth="9" strokeLinecap="round" />
      <circle cx="36" cy="124" r="14" fill="#6a45ff" />
      <circle cx="164" cy="124" r="14" fill="#6a45ff" />
    </svg>
  );
}

export function Pip3D({ className = "", label = "Pip, the Pause mascot. Move the pointer and it watches you." }: { className?: string; label?: string }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stop = () => {};
    let cancelled = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("three").then((THREE) => {
      if (cancelled) return;
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // No WebGL: the drawing stays.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      const canvas = renderer.domElement;
      canvas.setAttribute("aria-hidden", "true");
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0.2, 9);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x6a4dd8, 1.25));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(3, 5, 6);
      scene.add(key);
      const warm = new THREE.DirectionalLight(0xffb347, 1.4);
      warm.position.set(-5, 1.5, -2);
      scene.add(warm);

      const clay = new THREE.MeshPhysicalMaterial({ color: 0x5b36ee, roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xb9a6ff), sheenRoughness: 0.5 });
      const deep = clay.clone();
      deep.color.set(0x3a1fb8);
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
      const amber = new THREE.MeshStandardMaterial({ color: 0xe8930c, roughness: 0.4, metalness: 0.1 });

      const pip = new THREE.Group();
      scene.add(pip);
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.3, 64, 48), clay);
      body.scale.set(1, 1.1, 0.95);
      pip.add(body);

      const eyes = new THREE.Group();
      const eyeGeo = new THREE.CapsuleGeometry(0.125, 0.4, 8, 24);
      for (const x of [-0.3, 0.3]) {
        const eye = new THREE.Mesh(eyeGeo, white);
        eye.position.set(x, 0.28, 1.16);
        eye.rotation.x = -0.12;
        eyes.add(eye);
      }
      pip.add(eyes);

      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 12, 32, Math.PI), white);
      smile.position.set(0, -0.3, 1.19);
      smile.rotation.set(0.2, 0, Math.PI);
      pip.add(smile);

      for (const x of [-1, 1]) {
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 24), clay);
        hand.position.set(x * 1.42, -0.2, 0.25);
        pip.add(hand);
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), deep);
        foot.scale.set(1, 0.5, 1.25);
        foot.position.set(x * 0.5, -1.42, 0.15);
        pip.add(foot);
      }

      // The hold ring: three quarters full, like a payment that is waiting.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.085, 20, 140, Math.PI * 1.5), amber);
      ring.rotation.x = Math.PI / 2 - 0.32;
      const ringPivot = new THREE.Group();
      ringPivot.add(ring);
      ringPivot.position.y = -0.1;
      scene.add(ringPivot);

      const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ color: 0x0b0a1f, transparent: true, opacity: 0.16 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(1, 0.55, 1);
      shadow.position.y = -1.66;
      scene.add(shadow);

      const size = () => {
        const w = el.clientWidth || 300;
        const h = el.clientHeight || 300;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(el);

      // Where the pointer is, relative to Pip, from -1 to 1.
      const aim = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        aim.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
        aim.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      };
      let duck = 0;
      const onPress = () => (duck = 1);
      window.addEventListener("pointermove", onMove, { passive: true });
      el.addEventListener("pointerdown", onPress);

      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !still) loop();
      });
      io.observe(el);

      let raf = 0;
      let last = performance.now();
      let nextBlink = last + 2200;
      let blink = 0;
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const ease = 1 - Math.exp(-dt * 7);
        pip.rotation.y += (aim.x * 0.6 - pip.rotation.y) * ease;
        pip.rotation.x += (aim.y * 0.35 - pip.rotation.x) * ease;
        pip.position.y = Math.sin(now / 900) * 0.06 - duck * 0.18;
        duck += (0 - duck) * (1 - Math.exp(-dt * 5));
        pip.scale.set(1 + duck * 0.08, 1 - duck * 0.14, 1 + duck * 0.08);
        if (now > nextBlink) {
          blink = 1;
          nextBlink = now + 2600 + Math.random() * 2600;
        }
        blink += (0 - blink) * (1 - Math.exp(-dt * 16));
        eyes.scale.y = 1 - blink * 0.88;
        ringPivot.rotation.y += dt * (0.5 + duck * 6);
        renderer.render(scene, camera);
      };
      const loop = () => {
        cancelAnimationFrame(raf);
        const step = (now: number) => {
          frame(now);
          if (visible && !document.hidden) raf = requestAnimationFrame(step);
        };
        last = performance.now();
        raf = requestAnimationFrame(step);
      };
      const onVisibility = () => !document.hidden && visible && !still && loop();
      document.addEventListener("visibilitychange", onVisibility);

      frame(performance.now());
      if (!still) loop();
      setLive(true);

      stop = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerdown", onPress);
        document.removeEventListener("visibilitychange", onVisibility);
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose();
        });
        [clay, deep, white, amber].forEach((m) => m.dispose());
        renderer.dispose();
        canvas.remove();
      };
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <div ref={host} className={`pip3d ${live ? "live" : ""} ${className}`} role="img" aria-label={label}>
      <Pip size={260} className="pip3d-fallback" />
    </div>
  );
}

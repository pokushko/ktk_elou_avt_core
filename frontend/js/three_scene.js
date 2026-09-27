/**
 * three_scene.js — Интерактивная 3D-мнемосхема ЭЛОУ-АВТ-5/5 на Three.js (WebGL)
 * ISA-101 High Performance HMI в режиме Modern 3D
 */

let threeScene, threeCamera, threeRenderer, threeAnimId;
let equipment3D = {};
let particleSystems = {};
let isThreeInitialized = false;

function initThreeScene(container) {
    if (isThreeInitialized) return;
    
    const width = container.clientWidth || 960;
    const height = container.clientHeight || 500;

    // Сцена
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x080e1a);
    threeScene.fog = new THREE.FogExp2(0x080e1a, 0.008);

    // Камера (перспективная)
    threeCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    threeCamera.position.set(0, 12, 28);
    threeCamera.lookAt(0, 2, 0);

    // Рендерер
    const canvas = document.getElementById('three-canvas');
    threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    threeRenderer.setSize(width, height);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.shadowMap.enabled = true;
    threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    threeRenderer.toneMappingExposure = 1.2;

    // Освещение
    const ambientLight = new THREE.AmbientLight(0x334466, 0.6);
    threeScene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    threeScene.add(dirLight);

    const pointLight1 = new THREE.PointLight(0x00f2fe, 0.5, 50);
    pointLight1.position.set(-5, 8, 5);
    threeScene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff4c4c, 0.4, 40);
    pointLight2.position.set(-10, 4, 0);
    threeScene.add(pointLight2);

    // Пол (промышленная площадка)
    const floorGeom = new THREE.PlaneGeometry(60, 40);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a2e, roughness: 0.9, metalness: 0.1 
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    threeScene.add(floor);

    // Сетка на полу
    const gridHelper = new THREE.GridHelper(60, 30, 0x1a3a5a, 0x0a1a2a);
    gridHelper.position.y = 0;
    threeScene.add(gridHelper);

    // ============ ОБОРУДОВАНИЕ ============

    // Насос Н-1 (цилиндр горизонтальный + сфера)
    const pumpGroup = new THREE.Group();
    const pumpBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 1.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8, roughness: 0.3 })
    );
    pumpBody.rotation.z = Math.PI / 2;
    pumpBody.position.y = 0.8;
    pumpBody.castShadow = true;
    pumpGroup.add(pumpBody);
    
    const pumpHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x10ac84, metalness: 0.6, roughness: 0.4, emissive: 0x10ac84, emissiveIntensity: 0.2 })
    );
    pumpHead.position.set(0.9, 0.8, 0);
    pumpGroup.add(pumpHead);
    
    pumpGroup.position.set(-16, 0, 2);
    threeScene.add(pumpGroup);
    equipment3D['H-1'] = { group: pumpGroup, head: pumpHead, body: pumpBody };

    // Добавляем подпись
    addLabel('Н-1', -16, 2.2, 2);

    // ЭЛОУ (горизонтальный цилиндр)
    const elouGroup = new THREE.Group();
    const elouBody = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 5, 20),
        new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.7, roughness: 0.35 })
    );
    elouBody.rotation.z = Math.PI / 2;
    elouBody.position.y = 2;
    elouBody.castShadow = true;
    elouGroup.add(elouBody);

    // Электроды ЭЛОУ (жёлтые полоски)
    for (let i = -1.5; i <= 1.5; i += 1.0) {
        const electrode = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 2.2, 2.2),
            new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffa500, emissiveIntensity: 0.3 })
        );
        electrode.position.set(i, 2, 0);
        elouGroup.add(electrode);
    }
    elouGroup.position.set(-8, 0, 2);
    threeScene.add(elouGroup);
    equipment3D['ELOU'] = { group: elouGroup, body: elouBody };
    addLabel('ЭЛОУ', -8, 4, 2);

    // Печь П-1 (коробчатая конструкция с огнём)
    const furnaceGroup = new THREE.Group();
    const furnaceBody = new THREE.Mesh(
        new THREE.BoxGeometry(3, 4, 3),
        new THREE.MeshStandardMaterial({ color: 0x4a3728, metalness: 0.5, roughness: 0.6 })
    );
    furnaceBody.position.y = 2;
    furnaceBody.castShadow = true;
    furnaceGroup.add(furnaceBody);

    // Труба дымовая
    const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 3, 12),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 })
    );
    chimney.position.set(0, 5.5, 0);
    furnaceGroup.add(chimney);

    // Огонь (точечный свет + сфера)
    const fireSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 12),
        new THREE.MeshStandardMaterial({ 
            color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1.5, transparent: true, opacity: 0.7 
        })
    );
    fireSphere.position.set(0, 1, 0);
    furnaceGroup.add(fireSphere);

    const fireLight = new THREE.PointLight(0xff4400, 2, 10);
    fireLight.position.set(0, 1.5, 0);
    furnaceGroup.add(fireLight);

    furnaceGroup.position.set(-2, 0, -3);
    threeScene.add(furnaceGroup);
    equipment3D['P-1'] = { group: furnaceGroup, body: furnaceBody, fire: fireSphere, fireLight: fireLight };
    addLabel('П-1', -2, 5, -3);

    // Атмосферная колонна К-1 (высокий цилиндр с тарелками)
    const k1Group = new THREE.Group();
    const k1Body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.4, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x243b55, metalness: 0.8, roughness: 0.25 })
    );
    k1Body.position.y = 6;
    k1Body.castShadow = true;
    k1Group.add(k1Body);

    // Ректификационные тарелки (горизонтальные диски внутри колонны)
    for (let y = 1.5; y < 11; y += 1.2) {
        const tray = new THREE.Mesh(
            new THREE.CylinderGeometry(1.15, 1.15, 0.05, 24),
            new THREE.MeshStandardMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.15, emissive: 0x00f2fe, emissiveIntensity: 0.1 })
        );
        tray.position.y = y;
        k1Group.add(tray);
    }

    // Верхняя крышка
    const k1Top = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x3a6073, metalness: 0.8, roughness: 0.3 })
    );
    k1Top.position.y = 12;
    k1Group.add(k1Top);

    k1Group.position.set(6, 0, 0);
    threeScene.add(k1Group);
    equipment3D['K-1'] = { group: k1Group, body: k1Body };
    addLabel('К-1', 6, 13.5, 0);

    // Вакуумная колонна К-2 (ещё выше)
    const k2Group = new THREE.Group();
    const k2Body = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.6, 14, 24),
        new THREE.MeshStandardMaterial({ color: 0x2c1f5e, metalness: 0.8, roughness: 0.25 })
    );
    k2Body.position.y = 7;
    k2Body.castShadow = true;
    k2Group.add(k2Body);

    for (let y = 1.5; y < 13; y += 2.0) {
        const tray = new THREE.Mesh(
            new THREE.CylinderGeometry(1.35, 1.35, 0.05, 24),
            new THREE.MeshStandardMaterial({ color: 0xa29bfe, transparent: true, opacity: 0.12, emissive: 0xa29bfe, emissiveIntensity: 0.1 })
        );
        tray.position.y = y;
        k2Group.add(tray);
    }

    const k2Top = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4a3d8f, metalness: 0.8, roughness: 0.3 })
    );
    k2Top.position.y = 14;
    k2Group.add(k2Top);

    k2Group.position.set(14, 0, 0);
    threeScene.add(k2Group);
    equipment3D['K-2'] = { group: k2Group, body: k2Body };
    addLabel('К-2', 14, 15.5, 0);

    // ============ ТРУБОПРОВОДЫ ============
    createPipe([-16, 1, 2], [-8, 1, 2], 0x66fcf1);    // H-1 → ELOU
    createPipe([-5.5, 1.5, 2], [-2, 1.5, -1.5], 0x66fcf1);  // ELOU → P-1
    createPipe([-0.5, 3, -3], [6, 3, 0], 0xff6633);    // P-1 → K-1 (hot)
    createPipe([7.2, 2, 0], [14, 2, 0], 0xa29bfe);     // K-1 → K-2

    // ============ ПОТОЧНЫЕ ЧАСТИЦЫ ============
    createFlowParticles([-16, 1.5, 2], [-8, 1.5, 2], 0x00f2fe, 'flow_raw');
    createFlowParticles([-5.5, 2, 2], [-2, 2, -1.5], 0x66fcf1, 'flow_des');
    createFlowParticles([-0.5, 3.5, -3], [6, 3.5, 0], 0xff6633, 'flow_hot');

    isThreeInitialized = true;
    animateThreeScene();
}

function createPipe(from, to, color) {
    const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
    const curve = new THREE.LineCurve3(points[0], points[1]);
    const tubeGeom = new THREE.TubeGeometry(curve, 10, 0.12, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.7, roughness: 0.3 });
    const pipe = new THREE.Mesh(tubeGeom, tubeMat);
    pipe.castShadow = true;
    threeScene.add(pipe);
}

function createFlowParticles(from, to, color, id) {
    const count = 20;
    const positions = new Float32Array(count * 3);
    const geom = new THREE.BufferGeometry();
    
    for (let i = 0; i < count; i++) {
        const t = i / count;
        positions[i * 3] = from[0] + (to[0] - from[0]) * t;
        positions[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
        positions[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({ 
        color: color, size: 0.15, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const pts = new THREE.Points(geom, mat);
    threeScene.add(pts);
    particleSystems[id] = { points: pts, from: from, to: to, count: count };
}

function addLabel(text, x, y, z) {
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 256;
    canvas2d.height = 64;
    const ctx = canvas2d.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 36px Inter, Arial, sans-serif';
    ctx.fillStyle = '#66fcf1';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 44);

    const texture = new THREE.CanvasTexture(canvas2d);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3, 0.75, 1);
    sprite.position.set(x, y, z);
    threeScene.add(sprite);
}

function animateThreeScene() {
    threeAnimId = requestAnimationFrame(animateThreeScene);
    const time = performance.now() * 0.001;

    // Медленное вращение камеры
    threeCamera.position.x = 22 * Math.sin(time * 0.08);
    threeCamera.position.z = 22 * Math.cos(time * 0.08) + 6;
    threeCamera.lookAt(0, 4, 0);

    // Анимация частиц потока
    for (const [id, ps] of Object.entries(particleSystems)) {
        const posArr = ps.points.geometry.attributes.position.array;
        for (let i = 0; i < ps.count; i++) {
            let t = ((time * 0.5 + i / ps.count) % 1.0);
            posArr[i * 3] = ps.from[0] + (ps.to[0] - ps.from[0]) * t;
            posArr[i * 3 + 1] = ps.from[1] + (ps.to[1] - ps.from[1]) * t + Math.sin(t * Math.PI * 4) * 0.05;
            posArr[i * 3 + 2] = ps.from[2] + (ps.to[2] - ps.from[2]) * t;
        }
        ps.points.geometry.attributes.position.needsUpdate = true;
    }

    // Мерцание огня в печи
    if (equipment3D['P-1'] && equipment3D['P-1'].fire) {
        const fireScale = 0.8 + Math.sin(time * 8) * 0.2 + Math.sin(time * 13) * 0.1;
        equipment3D['P-1'].fire.scale.set(fireScale, fireScale * 1.3, fireScale);
        equipment3D['P-1'].fireLight.intensity = 1.5 + Math.sin(time * 6) * 0.8;
    }

    threeRenderer.render(threeScene, threeCamera);
}

function updateThreeTelemetry(state) {
    if (!isThreeInitialized || !state) return;

    const emType = window.activeEmergencyState ? window.activeEmergencyState.type : null;
    const time = performance.now() * 0.005;
    const pulseFactor = 0.5 + 0.5 * Math.sin(time * 6); // Пульсация аварийной подсветки

    // 1. Насос Н-1 (зелёный = норма/работает, ярко-красный = авария КОМПАКС / останов)
    if (equipment3D['H-1']) {
        const isCompaksAlarm = (emType === 'vibration_compaks' && !window.compaksInspected) || 
                               (emType === 'power_blackout' && (!state.pumps || !state.pumps[0] || !state.pumps[0].is_running));
        const isRunning = (state.pumps && state.pumps[0] && state.pumps[0].is_running) && !isCompaksAlarm;
        
        if (isCompaksAlarm || !isRunning) {
            equipment3D['H-1'].head.material.color.setHex(0xff0000);
            equipment3D['H-1'].head.material.emissive.setHex(0xff0000);
            equipment3D['H-1'].head.material.emissiveIntensity = 0.6 + 0.4 * pulseFactor;
            equipment3D['H-1'].body.material.emissive.setHex(0xaa0000);
            equipment3D['H-1'].body.material.emissiveIntensity = 0.4 * pulseFactor;
        } else {
            equipment3D['H-1'].head.material.color.setHex(0x10ac84);
            equipment3D['H-1'].head.material.emissive.setHex(0x10ac84);
            equipment3D['H-1'].head.material.emissiveIntensity = 0.2;
            equipment3D['H-1'].body.material.emissive.setHex(0x000000);
            equipment3D['H-1'].body.material.emissiveIntensity = 0;
        }
    }

    // 2. ЭЛОУ (синий = норма, ярко-красный/оранжевый = прорыв солей > 10 мг/л)
    if (equipment3D['ELOU']) {
        const isElouAlarm = (state.desalter && state.desalter.outlet_salt_content > 10.0);
        if (isElouAlarm) {
            equipment3D['ELOU'].body.material.color.setHex(0xff3838);
            equipment3D['ELOU'].body.material.emissive.setHex(0xff0055);
            equipment3D['ELOU'].body.material.emissiveIntensity = 0.6 + 0.4 * pulseFactor;
        } else {
            equipment3D['ELOU'].body.material.color.setHex(0x34495e);
            equipment3D['ELOU'].body.material.emissive.setHex(0x000000);
            equipment3D['ELOU'].body.material.emissiveIntensity = 0;
        }
    }

    // 3. Печь П-1 (горение огня + перегрев)
    if (equipment3D['P-1'] && state.furnace) {
        const fuelRatio = (state.furnace.fuel_gas_flow || 50) / 500.0;
        if (equipment3D['P-1'].fire) {
            equipment3D['P-1'].fire.material.opacity = Math.min(0.95, Math.max(0.2, fuelRatio));
            equipment3D['P-1'].fireLight.intensity = Math.max(0.5, fuelRatio * 2.8);
        }
        const isFurnaceAlarm = (state.furnace.outlet_temperature > 390.0 || state.furnace.tube_skin_temp > 460.0);
        if (isFurnaceAlarm) {
            equipment3D['P-1'].body.material.color.setHex(0xff2222);
            equipment3D['P-1'].body.material.emissive.setHex(0xff0000);
            equipment3D['P-1'].body.material.emissiveIntensity = 0.6 + 0.4 * pulseFactor;
        } else {
            equipment3D['P-1'].body.material.color.setHex(0x4a3728);
            equipment3D['P-1'].body.material.emissive.setHex(0x000000);
            equipment3D['P-1'].body.material.emissiveIntensity = 0;
        }
    }

    // 4. Атмосферная колонна К-1 (синий = норма, ярко-красный = превышение давления > 0.18 МПа или T > 135°C)
    if (equipment3D['K-1']) {
        const isK1Alarm = state.atm_column && (state.atm_column.top_pressure > 0.18 || state.atm_column.top_temperature > 135.0);
        if (isK1Alarm) {
            equipment3D['K-1'].body.material.color.setHex(0xff3838);
            equipment3D['K-1'].body.material.emissive.setHex(0xff0000);
            equipment3D['K-1'].body.material.emissiveIntensity = 0.7 + 0.3 * pulseFactor;
        } else {
            equipment3D['K-1'].body.material.color.setHex(0x243b55);
            equipment3D['K-1'].body.material.emissive.setHex(0x000000);
            equipment3D['K-1'].body.material.emissiveIntensity = 0;
        }
    }

    // 5. Вакуумная колонна К-2 (фиолетовый = норма, ярко-оранжевый/красный = срыв вакуума > 0.035 МПа)
    if (equipment3D['K-2']) {
        const isK2Alarm = state.vac_column && (state.vac_column.top_pressure > 0.035);
        if (isK2Alarm) {
            equipment3D['K-2'].body.material.color.setHex(0xff6b6b);
            equipment3D['K-2'].body.material.emissive.setHex(0xff5500);
            equipment3D['K-2'].body.material.emissiveIntensity = 0.7 + 0.3 * pulseFactor;
        } else {
            equipment3D['K-2'].body.material.color.setHex(0x2c1f5e);
            equipment3D['K-2'].body.material.emissive.setHex(0x000000);
            equipment3D['K-2'].body.material.emissiveIntensity = 0;
        }
    }
}

function stopThreeScene() {
    if (threeAnimId) {
        cancelAnimationFrame(threeAnimId);
        threeAnimId = null;
    }
}

function resumeThreeScene() {
    if (isThreeInitialized && !threeAnimId) {
        animateThreeScene();
    }
}

// Экспорт
window.initThreeScene = initThreeScene;
window.updateThreeTelemetry = updateThreeTelemetry;
window.stopThreeScene = stopThreeScene;
window.resumeThreeScene = resumeThreeScene;

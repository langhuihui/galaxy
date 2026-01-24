import * as THREE from 'three';

/**
 * 3D 星空类
 * 使用粒子系统创建真实的 3D 星空背景
 */
export class Starfield3D {
  constructor(options = {}) {
    const config = {
      starCount: options.starCount || 5000,
      radius: options.radius || 150,
      starSize: options.starSize || 1.0,
      starColor: options.starColor || 0xffffff,
      brightness: options.brightness || 1.0
    };

    this.stars = null;
    this.material = null;
    this.geometry = null;

    this.create(config);
  }

  create(config) {
    // 创建几何体
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.starCount * 3);
    const colors = new Float32Array(config.starCount * 3);
    const sizes = new Float32Array(config.starCount);

    const color = new THREE.Color(config.starColor);

    for (let i = 0; i < config.starCount; i++) {
      // 在球面上随机分布星星
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = config.radius * Math.sin(phi) * Math.cos(theta);
      const y = config.radius * Math.sin(phi) * Math.sin(theta);
      const z = config.radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 随机颜色变化
      const brightnessVariation = 0.5 + Math.random() * 0.5;
      colors[i * 3] = color.r * brightnessVariation;
      colors[i * 3 + 1] = color.g * brightnessVariation;
      colors[i * 3 + 2] = color.b * brightnessVariation;

      // 随机大小
      sizes[i] = (0.5 + Math.random() * 1.5) * config.starSize;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 创建着色器材质
    const vertexShader = `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      void main() {
        float r = distance(gl_PointCoord, vec2(0.5));
        if (r > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.3, 0.5, r);
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        brightness: { value: config.brightness }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.stars = new THREE.Points(this.geometry, this.material);
    this.stars.renderOrder = -1;
  }

  setBrightness(brightness) {
    if (this.material) {
      this.material.uniforms.brightness.value = brightness;
    }
  }

  getMesh() {
    return this.stars;
  }

  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}

/**
 * 3D 星云类
 * 使用真实星云纹理创建体积云效果
 */
export class Nebula3D {
  constructor(options = {}) {
    const config = {
      nebulaCount: options.nebulaCount || 6,
      radius: options.radius || 120,
      opacity: options.opacity || 0.8
    };

    this.nebulae = null;
    this.materials = [];
    this.geometries = [];
    this.textures = [];

    this.create(config);
  }

  create(config) {
    this.nebulae = new THREE.Group();
    this.nebulae.renderOrder = -2; // 在星星之前渲染

    // 使用本地 assets 文件夹中的星云图片
    const nebulaTextures = [
      '/assets/nebula-10-1530144_1280.png',
      '/assets/nebula-6672283_1280.jpg',
      '/assets/rosette-nebula-7616742_1280.jpg',
      '/assets/christmas-background-11107_1280.jpg'
    ];

    const loader = new THREE.TextureLoader();

    // 使用球面点分布算法确保星云均匀分散
    const nebulaPositions = [];
    for (let i = 0; i < config.nebulaCount; i++) {
      // 使用斐波那契球体分布算法确保均匀分布
      const offset = 2 / config.nebulaCount;
      const increment = Math.PI * (3 - Math.sqrt(5));

      const y = ((i * offset) - 1) + (offset / 2);
      const r = Math.sqrt(1 - Math.pow(y, 2));
      const phi = (i % config.nebulaCount) * increment;

      const theta = phi;
      const phi_angle = Math.acos(y);

      // 增大半径范围,让星云更分散
      const radius = config.radius + 30 + Math.random() * 50;

      nebulaPositions.push({
        x: radius * Math.sin(phi_angle) * Math.cos(theta),
        y: radius * Math.sin(phi_angle) * Math.sin(theta),
        z: radius * Math.cos(phi_angle)
      });
    }

    for (let i = 0; i < config.nebulaCount; i++) {
      const textureUrl = nebulaTextures[i % nebulaTextures.length];
      const texture = loader.load(textureUrl);

      // 创建平面几何体
      const nebulaGeometry = new THREE.PlaneGeometry(80, 80);

      // 星云着色器 - 使用纹理贴图
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `;

      const fragmentShader = `
        uniform sampler2D map;
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          vec4 texColor = texture2D(map, vUv);
          // 边缘淡出：JPG 无透明通道，用径向渐变隐藏轮廓
          float distFromCenter = distance(vUv, vec2(0.5));
          float edgeFade = 1.0 - smoothstep(0.15, 0.55, distFromCenter);
          float alpha = texColor.a * opacity * edgeFade;
          gl_FragColor = vec4(texColor.rgb, alpha);
        }
      `;

      const nebulaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: texture },
          opacity: { value: config.opacity }
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });

      const nebulaMesh = new THREE.Mesh(nebulaGeometry, nebulaMaterial);

      // 使用预计算的位置确保均匀分布
      const pos = nebulaPositions[i];
      nebulaMesh.position.x = pos.x;
      nebulaMesh.position.y = pos.y;
      nebulaMesh.position.z = pos.z;

      // 面向中心
      nebulaMesh.lookAt(0, 0, 0);

      // 随机旋转
      nebulaMesh.rotation.z += Math.random() * Math.PI;

      this.nebulae.add(nebulaMesh);

      this.materials.push(nebulaMaterial);
      this.geometries.push(nebulaGeometry);
      this.textures.push(texture);
    }
  }

  /**
   * 程序化生成星云纹理
   */
  generateNebulaTexture(baseColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 创建渐变背景
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, `rgba(${Math.floor(baseColor.r * 255)}, ${Math.floor(baseColor.g * 255)}, ${Math.floor(baseColor.b * 255)}, 0.8)`);
    gradient.addColorStop(0.3, `rgba(${Math.floor(baseColor.r * 200)}, ${Math.floor(baseColor.g * 200)}, ${Math.floor(baseColor.b * 200)}, 0.5)`);
    gradient.addColorStop(0.6, `rgba(${Math.floor(baseColor.r * 150)}, ${Math.floor(baseColor.g * 150)}, ${Math.floor(baseColor.b * 150)}, 0.2)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // 添加噪点
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = Math.random() * 20 + 5;
      const alpha = Math.random() * 0.3;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    // 添加更多细节
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = Math.random() * 5 + 1;
      const alpha = Math.random() * 0.5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.floor(baseColor.r * 255)}, ${Math.floor(baseColor.g * 255)}, ${Math.floor(baseColor.b * 255)}, ${alpha})`;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  setOpacity(opacity) {
    this.materials.forEach(material => {
      material.uniforms.opacity.value = opacity;
    });
  }

  getMesh() {
    return this.nebulae;
  }

  dispose() {
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
  }
}

/**
 * 创建星空背景
 * @param {Object} options - 配置选项
 * @returns {THREE.Points} 星空粒子系统
 */
export function create3DStarfield(options = {}) {
  const starfield = new Starfield3D(options);
  return starfield.getMesh();
}

/**
 * 创建星云背景
 * @param {Object} options - 配置选项
 * @returns {THREE.Group} 星云组
 */
export function create3DNebula(options = {}) {
  const nebula = new Nebula3D(options);
  return nebula.getMesh();
}


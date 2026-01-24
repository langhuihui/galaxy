import * as THREE from 'three';

/**
 * 星空纹理生成器
 * 使用程序化生成方式创建高质量星空纹理
 */
export class StarfieldTextureGenerator {
  constructor() {
    this.starCount = 5000;
    this.textureSize = 2048;
  }

  /**
   * 生成星空纹理
   * @param {Object} options - 配置选项
   * @param {number} options.starCount - 星星数量
   * @param {number} options.size - 纹理尺寸
   * @param {number} options.brightness - 亮度 (0-1)
   * @param {boolean} options.includeNebulae - 是否包含星云
   * @returns {THREE.CanvasTexture}
   */
  generateTexture(options = {}) {
    const config = {
      starCount: options.starCount || this.starCount,
      size: options.size || this.textureSize,
      brightness: options.brightness || 1.0,
      includeNebulae: options.includeNebulae !== undefined ? options.includeNebulae : true
    };

    const canvas = document.createElement('canvas');
    canvas.width = config.size;
    canvas.height = config.size;

    const ctx = canvas.getContext('2d');

    // 填充深色背景
    const gradient = ctx.createRadialGradient(
      config.size / 2, config.size / 2, 0,
      config.size / 2, config.size / 2, config.size / 2
    );
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#050510');
    gradient.addColorStop(1, '#000005');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.size, config.size);

    // 添加星云背景（如果启用）
    if (config.includeNebulae) {
      this.addNebulae(ctx, config);
    }

    // 生成星星
    this.addStars(ctx, config);

    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    return texture;
  }

  /**
   * 添加星云效果
   */
  addNebulae(ctx, config) {
    // 使用多层半透明圆形创建星云效果
    const nebulaCount = 15;

    const nebulaColors = [
      'rgba(100, 50, 150, 0.08)',  // 紫色
      'rgba(50, 100, 150, 0.08)',  // 蓝色
      'rgba(150, 100, 50, 0.05)',  // 橙色
      'rgba(50, 150, 100, 0.05)'   // 绿色
    ];

    for (let i = 0; i < nebulaCount; i++) {
      const x = Math.random() * config.size;
      const y = Math.random() * config.size;
      const radius = 100 + Math.random() * 300;

      const nebulaGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];

      nebulaGradient.addColorStop(0, color);
      nebulaGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = nebulaGradient;
      ctx.fillRect(0, 0, config.size, config.size);
    }
  }

  /**
   * 添加星星
   */
  addStars(ctx, config) {
    for (let i = 0; i < config.starCount; i++) {
      const x = Math.random() * config.size;
      const y = Math.random() * config.size;

      // 不同的星星大小和亮度
      const starType = Math.random();
      let size, brightness, color;

      if (starType < 0.6) {
        // 小星星
        size = 1.5 + Math.random() * 1.5;
        brightness = 0.5 + Math.random() * 0.5;
        color = this.getStarColor('white');
      } else if (starType < 0.9) {
        // 中等星星
        size = 2 + Math.random() * 2;
        brightness = 0.7 + Math.random() * 0.3;
        color = this.getStarColor(['blue', 'white']);
      } else {
        // 大亮星
        size = 3 + Math.random() * 4;
        brightness = 0.8 + Math.random() * 0.2;
        color = this.getStarColor(['yellow', 'orange', 'red']);
      }

      // 应用整体亮度控制
      brightness *= config.brightness;

      // 绘制星星
      const starGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      starGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${brightness})`);
      starGradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${brightness * 0.5})`);
      starGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = starGradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // 为大亮星添加光晕效果
      if (size > 3.5) {
        this.addStarHalo(ctx, x, y, size, color, brightness);
      }
    }
  }

  /**
   * 添加星星光晕
   */
  addStarHalo(ctx, x, y, size, color, brightness) {
    const haloSize = size * 4;
    const haloGradient = ctx.createRadialGradient(x, y, size, x, y, haloSize);
    haloGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${brightness * 0.2})`);
    haloGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(x, y, haloSize, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 获取星星颜色
   */
  getStarColor(type) {
    const colors = {
      white: { r: 255, g: 255, b: 255 },
      blue: { r: 200, g: 220, b: 255 },
      yellow: { r: 255, g: 250, b: 220 },
      orange: { r: 255, g: 220, b: 180 },
      red: { r: 255, g: 200, b: 200 }
    };

    if (Array.isArray(type)) {
      return colors[type[Math.floor(Math.random() * type.length)]];
    }
    return colors[type] || colors.white;
  }
}

/**
 * 创建天空盒子
 * @param {Object} options - 配置选项
 * @returns {THREE.Mesh} 天空盒子网格
 */
export function createSkybox(options = {}) {
  const config = {
    starCount: options.starCount || 5000,
    size: options.size || 200,
    brightness: options.brightness || 1.0,
    includeNebulae: options.includeNebulae !== undefined ? options.includeNebulae : true
  };

  // 创建星空纹理生成器
  const textureGenerator = new StarfieldTextureGenerator();

  // 生成纹理
  const texture = textureGenerator.generateTexture({
    starCount: config.starCount,
    brightness: config.brightness,
    includeNebulae: config.includeNebulae
  });

  // 创建天空盒子材质（所有面使用相同纹理）
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide, // 渲染立方体内部
    depthWrite: false, // 不写入深度缓冲区
    fog: false
  });

  // 创建天空盒子几何体
  const geometry = new THREE.BoxGeometry(config.size, config.size, config.size);

  // 创建天空盒子网格
  const skybox = new THREE.Mesh(geometry, material);

  // 设置渲染顺序，确保天空盒子在其他物体之前渲染
  skybox.renderOrder = -1;

  return skybox;
}

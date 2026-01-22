import * as THREE from 'three';

/**
 * 银河系类 - 生成符合天文观测的螺旋星系
 */
export class Galaxy {
  constructor(parameters = {}) {
    // 参数配置
    this.parameters = {
      count: parameters.count || 50000,
      size: parameters.size || 10,
      radius: parameters.radius || 5,
      armCount: parameters.armCount || 3, // 统一使用 armCount，删除 branches
      spin: parameters.spin || 1,
      randomness: parameters.randomness || 0.5,
      randomnessPower: parameters.randomnessPower || 3,
      insideColor: parameters.insideColor || '#ff6030',
      outsideColor: parameters.outsideColor || '#1b3984',
      glowIntensity: parameters.glowIntensity || 2.0,
      haloSize: parameters.haloSize || 0.5,
      densityPower: parameters.densityPower || 0.25,
      // 旋臂参数
      armTightness: parameters.armTightness || 1.0,
      armDensity: parameters.armDensity || 2.0,
      armWidth: parameters.armWidth || 0.3,
      // 曲线函数
      rotationCurveFn: parameters.rotationCurveFn || null,
      densityCurveFn: parameters.densityCurveFn || null,
      // 粘滞效果参数（密度高的区域速度减慢）
      viscosity: parameters.viscosity || 0.0, // 0.0-1.0，0表示无粘滞，1表示最大粘滞
      // 云雾效果参数
      cloudRatio: parameters.cloudRatio || 0.08, // 云雾粒子比例（8%）
      cloudHaloMultiplier: parameters.cloudHaloMultiplier || 3.0, // 云雾粒子光晕倍数
      // 随机亮度参数
      randomBrightness: parameters.randomBrightness !== undefined ? parameters.randomBrightness : true, // 是否启用随机亮度
      brightnessRange: parameters.brightnessRange || [0.6, 1.4], // 亮度范围 [min, max]
      // 旋转方向参数
      rotationDirection: parameters.rotationDirection !== undefined ? parameters.rotationDirection : 1, // 1为顺时针，-1为逆时针
      ...parameters
    };

    // 几何体和材质
    this.geometry = null;
    this.material = null;
    this.points = null;

    // 时间偏移量（用于平滑切换旋转方向）
    this.timeOffset = 0;

    // 旋转速度参数（符合天文观测的旋转曲线）
    this.rotationParams = {
      rPeak: parameters.rPeak || 2.0,      // 峰值半径 (kpc)
      rFlat: parameters.rFlat || 8.0,      // 平坦区域结束半径 (kpc)
      vMax: parameters.rotationSpeedMax || 220.0,  // 使用 rotationSpeedMax 参数作为最大旋转速度
      scale: 0.1       // 缩放因子（将 kpc 转换为场景单位）
    };

    this.generate();
  }

  /**
   * 计算旋转速度（支持贝塞尔曲线或传统方法）
   * @param {number} r - 距离中心的距离
   * @param {number} angle - 粒子的角度（用于判断是否在旋臂上）
   * @returns {number} 旋转速度
   */
  calculateRotationSpeed(r, angle) {
    // 确保输入值有效
    if (isNaN(r) || r < 0) {
      return 0;
    }

    const { scale } = this.rotationParams;
    const rScaled = r / scale; // 转换为 kpc
    // 使用实际的星系半径（转换为 kpc）作为最大半径，确保从中心到边缘全部应用曲线
    const maxRadiusKpc = this.parameters.radius / scale;
    // 归一化半径到 [0, 1] 范围，确保所有粒子都能正确应用曲线
    const normalizedR = Math.min(1, rScaled / maxRadiusKpc);

    // 计算基础旋转速度
    let speed;
    if (this.parameters.rotationCurveFn) {
      // 使用贝塞尔曲线（已经应用了极值范围）
      // rotationCurveFn 返回的是 km/s 单位的值（已经应用了极值范围）
      speed = this.parameters.rotationCurveFn(normalizedR);
    } else {
      // 使用传统方法（向后兼容）
      // 确保使用 rotationSpeedMax 参数作为最大旋转速度
      const { rPeak, rFlat } = this.rotationParams;
      const vMax = this.parameters.rotationSpeedMax || 220.0; // 优先使用传入的参数，默认220.0 km/s
      if (rScaled < rPeak) {
        speed = vMax * (rScaled / rPeak);
      } else if (rScaled < rFlat) {
        speed = vMax;
      } else {
        speed = vMax * Math.sqrt(rFlat / rScaled);
      }
    }

    // 应用粘滞效果：旋臂区域速度减慢，维持旋臂稳定
    if (this.parameters.viscosity > 0 && this.parameters.armCount > 0) {
      // 计算粒子是否在旋臂附近
      // 使用与生成旋臂相同的对数螺旋线公式
      const spiralAngle = Math.log(r + 0.1) * this.parameters.armTightness;
      const branchAngle = (Math.PI * 2 / this.parameters.armCount);

      // 计算到最近旋臂的角度距离
      let minAngleDist = Infinity;
      for (let arm = 0; arm < this.parameters.armCount; arm++) {
        const armAngle = spiralAngle + branchAngle * arm;
        // 计算角度差（考虑周期性）
        let angleDiff = Math.abs(angle - armAngle);
        angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        minAngleDist = Math.min(minAngleDist, angleDiff);
      }

      // 归一化角度距离（0-1），0表示在旋臂上，1表示远离旋臂
      const normalizedAngleDist = minAngleDist / (Math.PI / this.parameters.armCount);

      // 使用高斯函数计算旋臂影响因子
      // 在旋臂上（normalizedAngleDist接近0）影响最大，远离旋臂影响减小
      const armInfluence = Math.exp(-Math.pow(normalizedAngleDist / (this.parameters.armWidth * 0.7), 2));

      // 根据旋臂影响和粘滞系数调整速度
      // 在旋臂上的粒子速度减慢，维持旋臂稳定
      const viscosityFactor = 1.0 - this.parameters.viscosity * armInfluence;
      speed = speed * viscosityFactor;
    }

    // 确保返回值有效
    if (isNaN(speed) || speed < 0) {
      return 0;
    }

    return speed; // 返回 km/s 单位
  }

  /**
   * 生成银河系粒子
   */
  generate() {
    // 创建几何体
    this.geometry = new THREE.BufferGeometry();

    // 数据数组
    const positions = new Float32Array(this.parameters.count * 3);
    const colors = new Float32Array(this.parameters.count * 3);
    const sizes = new Float32Array(this.parameters.count);
    const distances = new Float32Array(this.parameters.count);
    const angles = new Float32Array(this.parameters.count);
    const rotationSpeeds = new Float32Array(this.parameters.count);
    const haloSizes = new Float32Array(this.parameters.count); // 每个粒子的光晕大小
    const brightnesses = new Float32Array(this.parameters.count); // 每个粒子的随机亮度

    // 颜色插值
    const insideColor = new THREE.Color(this.parameters.insideColor);
    const outsideColor = new THREE.Color(this.parameters.outsideColor);

    // 生成粒子 - 扁平盘状分布，无旋臂结构
    // 使用平滑的密度分布函数，中心密度高，边缘密度低
    let i = 0;
    while (i < this.parameters.count) {
      const i3 = i * 3;

      // 在XZ平面上分布（盘状结构）
      // 使用贝塞尔曲线或幂函数控制密度分布
      let radius;
      if (this.parameters.densityCurveFn) {
        // 使用贝塞尔曲线作为概率密度函数（PDF）
        // 密度曲线的x轴表示归一化距离（0=中心，1=边缘）
        // y轴表示在该距离处的密度值（单位面积的粒子数）
        // 
        // 对于2D圆盘分布，需要考虑面积效应：
        // - 半径为r的圆环面积为 2πr dr
        // - 在半径r处的粒子数 ∝ density(r_norm) * r_norm
        // - 使用拒绝采样来生成符合密度分布的半径

        const maxAttempts = 100;
        let attempts = 0;
        let accepted = false;

        // 预计算最大概率密度（用于归一化）
        // 概率密度 = density(r_norm) * r_norm（考虑2D圆盘面积效应）
        let maxProbability = 0;
        for (let i = 1; i <= 100; i++) {
          const rNorm = i / 100;
          const density = this.parameters.densityCurveFn(rNorm);
          const probability = density * rNorm; // 考虑面积效应
          maxProbability = Math.max(maxProbability, probability);
        }
        // 确保 maxProbability > 0，避免除零错误
        maxProbability = Math.max(maxProbability, 0.001);

        while (!accepted && attempts < maxAttempts) {
          attempts++;
          // 生成候选半径（归一化到0-1）
          const candidateRadiusNorm = Math.random();

          // 获取该半径处的密度值
          const densityAtRadius = this.parameters.densityCurveFn(candidateRadiusNorm);

          // 计算概率密度（考虑面积效应）
          // 对于 r_norm = 0，使用一个小的非零值来避免概率为0
          const rNormForProbability = Math.max(candidateRadiusNorm, 0.001);
          const probabilityDensity = densityAtRadius * rNormForProbability;

          // 使用拒绝采样：以概率密度/最大概率密度的概率接受
          const acceptProbability = Math.min(1.0, probabilityDensity / maxProbability);
          if (Math.random() < acceptProbability) {
            radius = candidateRadiusNorm * this.parameters.radius;
            accepted = true;
          }
        }

        // 如果拒绝采样失败（理论上不应该发生），使用均匀分布作为后备
        if (!accepted) {
          radius = Math.random() * this.parameters.radius;
        }
      } else {
        // 使用幂函数（向后兼容）
        const radiusPower = this.parameters.densityPower;
        radius = (1 - Math.pow(1 - Math.random(), radiusPower)) * this.parameters.radius;
      }

      // 在XY平面上的角度（均匀分布）
      let angle = Math.random() * Math.PI * 2;

      // 应用旋臂密度波（如果启用）
      let shouldKeep = true;
      if (this.parameters.armCount > 0 && this.parameters.armDensity > 1.0) {
        // 对数螺旋线：θ = a * ln(r) + b
        // 使用紧密度参数控制螺旋的紧密程度
        const spiralAngle = Math.log(radius + 0.1) * this.parameters.armTightness;
        const branchAngle = (Math.PI * 2 / this.parameters.armCount);

        // 计算到最近旋臂的角度距离
        let minAngleDist = Infinity;
        for (let arm = 0; arm < this.parameters.armCount; arm++) {
          const armAngle = spiralAngle + branchAngle * arm;
          // 计算角度差（考虑周期性）
          let angleDiff = Math.abs(angle - armAngle);
          angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
          minAngleDist = Math.min(minAngleDist, angleDiff);
        }

        // 归一化角度距离（0-1）
        const normalizedAngleDist = minAngleDist / (Math.PI / this.parameters.armCount);

        // 根据到旋臂的距离计算密度增强因子
        // 使用高斯函数：在旋臂上密度高，远离旋臂密度低
        const armInfluence = Math.exp(-Math.pow(normalizedAngleDist / (this.parameters.armWidth * 0.7), 2));
        const densityBoost = 1.0 + (this.parameters.armDensity - 1.0) * armInfluence;

        // 使用密度增强来决定是否保留这个粒子
        // 提高保留概率，让旋臂更明显
        const keepProb = Math.min(1.0, 0.15 + (densityBoost - 1.0) * 0.8 + 0.2);
        shouldKeep = Math.random() <= keepProb;
      }

      if (!shouldKeep) {
        continue;
      }

      // XY平面上的位置
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);

      // Y轴（垂直方向）：使用高斯分布创建薄盘
      // 使用Box-Muller变换生成高斯分布
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const diskThickness = 0.3; // 盘的厚度（相对于半径）
      const y = gaussian * diskThickness * (1 - radius / this.parameters.radius * 0.5);
      // 中心区域更薄，边缘稍厚

      // 添加少量随机偏移使分布更自然
      const randomX = (Math.random() - 0.5) * this.parameters.randomness * 0.1;
      const randomY = (Math.random() - 0.5) * this.parameters.randomness * 0.05; // Y轴随机性更小
      const randomZ = (Math.random() - 0.5) * this.parameters.randomness * 0.1;

      positions[i3] = x + randomX;
      positions[i3 + 1] = y + randomY;
      positions[i3 + 2] = z + randomZ;

      // 计算距离中心的距离（在XZ平面上的投影距离，用于旋转）
      const distance = Math.sqrt((x + randomX) ** 2 + (z + randomZ) ** 2);
      distances[i] = distance;

      // 存储初始角度（在XZ平面上的角度）
      const finalAngle = Math.atan2(z + randomZ, x + randomX);
      angles[i] = finalAngle;

      // 计算旋转速度（传入角度以判断是否在旋臂上）
      rotationSpeeds[i] = this.calculateRotationSpeed(distance, finalAngle);

      // 颜色：根据距离中心的位置插值
      const mixedColor = insideColor.clone();
      mixedColor.lerp(outsideColor, distance / this.parameters.radius);
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;

      // 大小：保持固定大小，不根据距离调整
      const baseSize = this.parameters.size;
      const sizeVariation = baseSize * 0.3; // 30% 的变化范围
      sizes[i] = baseSize + (Math.random() - 0.5) * sizeVariation;

      // 云雾效果：随机选择一部分粒子作为云雾粒子，给它们更大的光晕
      const isCloud = Math.random() < this.parameters.cloudRatio;
      if (isCloud) {
        // 云雾粒子：光晕大小是基础光晕的倍数
        haloSizes[i] = this.parameters.haloSize * this.parameters.cloudHaloMultiplier;
        // 云雾粒子：增加亮度使其更明显（2-3倍亮度）
        if (this.parameters.randomBrightness) {
          const [brightnessMin, brightnessMax] = this.parameters.brightnessRange;
          const baseBrightness = brightnessMin + Math.random() * (brightnessMax - brightnessMin);
          brightnesses[i] = baseBrightness * 2.5; // 云雾粒子亮度是普通粒子的2.5倍
        } else {
          brightnesses[i] = 2.5; // 云雾粒子默认亮度2.5倍
        }
      } else {
        // 普通粒子：使用基础光晕大小，可以有一些随机变化
        haloSizes[i] = this.parameters.haloSize * (0.8 + Math.random() * 0.4); // 0.8-1.2倍
        // 随机亮度：为每个粒子添加随机亮度因子
        if (this.parameters.randomBrightness) {
          const [brightnessMin, brightnessMax] = this.parameters.brightnessRange;
          brightnesses[i] = brightnessMin + Math.random() * (brightnessMax - brightnessMin);
        } else {
          brightnesses[i] = 1.0; // 不启用随机亮度时，使用默认值1.0
        }
      }

      // 粒子创建成功，继续下一个
      i++;
    }

    // 验证并修复 NaN 值
    for (let i = 0; i < this.parameters.count; i++) {
      const i3 = i * 3;
      if (isNaN(positions[i3]) || isNaN(positions[i3 + 1]) || isNaN(positions[i3 + 2])) {
        // 如果位置有 NaN，设置为中心
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;
      }
      if (isNaN(colors[i3]) || isNaN(colors[i3 + 1]) || isNaN(colors[i3 + 2])) {
        // 如果颜色有 NaN，设置为默认色
        colors[i3] = 0.5;
        colors[i3 + 1] = 0.5;
        colors[i3 + 2] = 0.5;
      }
      if (isNaN(sizes[i])) {
        sizes[i] = this.parameters.size;
      }
      if (isNaN(distances[i])) {
        distances[i] = 0;
      }
      if (isNaN(angles[i])) {
        angles[i] = 0;
      }
      if (isNaN(rotationSpeeds[i])) {
        rotationSpeeds[i] = 0;
      }
      if (isNaN(haloSizes[i])) {
        haloSizes[i] = this.parameters.haloSize;
      }
      if (isNaN(brightnesses[i])) {
        brightnesses[i] = 1.0;
      }
    }

    // 设置几何体属性
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('distance', new THREE.BufferAttribute(distances, 1));
    this.geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
    this.geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    this.geometry.setAttribute('haloSize', new THREE.BufferAttribute(haloSizes, 1));
    this.geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));

    // 手动计算 bounding sphere 并处理可能的 NaN 值
    try {
      this.geometry.computeBoundingSphere();
    } catch (error) {
      console.warn('计算 bounding sphere 失败，手动设置默认值:', error);
      // 手动设置一个默认的 bounding sphere
      this.geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, 0, 0),
        this.parameters.radius * 2
      );
    }

    // 创建材质
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTimeOffset: { value: 0 }, // 时间偏移量，用于平滑切换旋转方向
        uSize: { value: this.parameters.size },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uGlowIntensity: { value: this.parameters.glowIntensity || 2.0 },
        uHaloSize: { value: this.parameters.haloSize || 0.5 }, // 保留作为默认值，但着色器中会优先使用每个粒子的haloSize属性
        uRotationDirection: { value: this.parameters.rotationDirection || 1 } // 旋转方向：1为顺时针，-1为逆时针
      },
      // 禁用材质的 tone mapping，让材质不受渲染器 tone mapping 影响
      // 这可能有助于匹配 r160 的行为
      tonemapped: false,
      vertexShader: `
                uniform float uTime;
                uniform float uTimeOffset;
                uniform float uSize;
                uniform float uPixelRatio;
                uniform float uRotationDirection;

                attribute float size;
                attribute float distance;
                attribute float angle;
                attribute float rotationSpeed;
                attribute float haloSize;
                attribute float brightness;
                // color attribute is automatically provided by Three.js when vertexColors: true

                varying vec3 vColor;
                varying float vDistance;
                varying float vHaloSize;
                varying float vBrightness;

                void main() {
                    // 先获取原始位置
                    vec3 originalPos = position;
                    
                    // 计算在XZ平面上的半径（用于旋转）
                    float radius = sqrt(originalPos.x * originalPos.x + originalPos.z * originalPos.z);
                    
                    // 使用预计算的旋转速度（已经应用了贝塞尔曲线和极值范围）
                    // rotationSpeed 单位是 km/s，需要转换为场景单位
                    // 使用较小的系数使整体旋转更慢，速度差异更不明显
                    float speedInSceneUnits = rotationSpeed * 0.01;
                    
                    // 计算当前角度（根据旋转速度和方向）
                    // uRotationDirection: 1为顺时针，-1为逆时针
                    // 使用 uTimeOffset 来平滑切换旋转方向
                    float adjustedTime = uTime + uTimeOffset;
                    float currentAngle = angle + adjustedTime * speedInSceneUnits * uRotationDirection;
                    
                    // 重新计算XZ平面上的位置（保持半径和Y坐标不变）
                    vec3 rotatedPos = vec3(
                        cos(currentAngle) * radius,
                        originalPos.y,  // Y坐标保持不变
                        sin(currentAngle) * radius
                    );
                    
                    vec4 modelPosition = modelMatrix * vec4(rotatedPos, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectedPosition = projectionMatrix * viewPosition;

                    gl_Position = projectedPosition;
                    
                    // 保持固定大小，不根据距离调整
                    gl_PointSize = size * uSize * uPixelRatio;
                    gl_PointSize *= (1.0 / -viewPosition.z);

                    vColor = color;
                    vDistance = distance;
                    vHaloSize = haloSize;
                    vBrightness = brightness;
                }
            `,
      fragmentShader: `
                uniform float uGlowIntensity;
                uniform float uHaloSize;
                
                varying vec3 vColor;
                varying float vDistance;
                varying float vHaloSize;
                varying float vBrightness;

                void main() {
                    // 计算到粒子中心的距离
                    vec2 center = vec2(0.5);
                    vec2 coord = gl_PointCoord - center;
                    float distanceToCenter = length(coord);
                    
                    // 创建发光的圆形粒子效果
                    // 使用每个粒子的光晕大小（如果为0则使用默认值）
                    float radius = vHaloSize > 0.0 ? vHaloSize : uHaloSize;
                    
                    // 确保圆形遮罩：如果距离超过0.5（点精灵的边界），则丢弃片段
                    // 这样可以防止方形边缘出现
                    if (distanceToCenter > 0.5) {
                        discard;
                    }
                    
                    // 核心亮度（中心最亮）
                    float core = 1.0 - smoothstep(0.0, 0.15, distanceToCenter);
                    
                    // 外圈光晕（更柔和的光晕效果）
                    // 限制光晕半径不超过0.5，确保不会超出圆形边界
                    float haloRadius = min(radius, 0.5);
                    float halo = 1.0 - smoothstep(0.15, haloRadius, distanceToCenter);
                    halo = pow(halo, 2.0); // 使光晕更柔和
                    
                    // 组合强度
                    // 增加粒子基础亮度，但减少中心区域的过度叠加
                    float strength = core + halo * 0.6;
                    
                    // 根据距离中心的距离，减少中心区域的强度叠加
                    // 在中心区域（vDistance 小），降低强度以避免过度叠加
                    float centerAttenuation = 1.0;
                    if (vDistance < 1.0) {
                        // 在中心区域，根据距离衰减强度，避免过度叠加
                        centerAttenuation = 0.5 + vDistance * 0.5; // 从 0.5 到 1.0
                    }
                    
                    // 使用可控制的发光强度，并应用中心区域衰减和随机亮度
                    vec3 finalColor = vColor * strength * uGlowIntensity * centerAttenuation * vBrightness;
                    
                    // 根据恒星类型调整颜色（模拟不同年龄的恒星）
                    float ageFactor = clamp(vDistance / 5.0, 0.0, 1.0);
                    vec3 youngStarColor = vec3(0.9, 0.95, 1.0); // 蓝白色
                    vec3 oldStarColor = vec3(1.0, 0.85, 0.7);   // 黄色
                    vec3 starColor = mix(youngStarColor, oldStarColor, ageFactor);
                    
                    finalColor = mix(finalColor, finalColor * starColor, 0.15);
                    
                    // Alpha 值：核心完全不透明，光晕逐渐透明
                    float alpha = core + halo * 0.4;
                    alpha = clamp(alpha, 0.2, 1.0);
                    
                    // 云雾粒子：如果光晕大小明显大于基础光晕，增加不透明度
                    // 判断是否为云雾粒子（光晕大小是基础光晕的2倍以上）
                    if (radius > uHaloSize * 1.5) {
                        // 云雾粒子：增加不透明度，使其更明显
                        alpha = core + halo * 0.8; // 从0.4增加到0.8，使光晕更不透明
                        alpha = clamp(alpha, 0.5, 1.0); // 最小alpha从0.2提高到0.5
                    }
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    // 创建点系统
    this.points = new THREE.Points(this.geometry, this.material);
  }

  /**
   * 更新动画
   * @param {number} elapsedTime - 经过的时间（秒）
   */
  update(elapsedTime) {
    if (this.material) {
      this.material.uniforms.uTime.value = elapsedTime;
      // 保持时间偏移量，用于平滑切换旋转方向
      this.material.uniforms.uTimeOffset.value = this.timeOffset;
    }
  }

  /**
   * 更新旋转速度
   * @param {number} speed - 速度倍数
   */
  setRotationSpeed(speed) {
    if (this.material) {
      this.material.uniforms.uTime.value *= speed;
    }
  }

  /**
   * 更新发光强度
   * @param {number} intensity - 发光强度
   */
  setGlowIntensity(intensity) {
    if (this.material) {
      this.material.uniforms.uGlowIntensity.value = intensity;
    }
  }

  /**
   * 更新光晕大小
   * @param {number} size - 光晕大小
   */
  setHaloSize(size) {
    if (this.material) {
      this.material.uniforms.uHaloSize.value = size;
    }
  }

  /**
   * 更新旋转方向
   * @param {number} direction - 旋转方向：1为顺时针，-1为逆时针
   */
  setRotationDirection(direction) {
    const oldDirection = this.parameters.rotationDirection || 1;

    // 如果方向改变了，计算时间偏移量以保持粒子在当前角度
    if (oldDirection !== direction && this.material && this.material.uniforms.uTime) {
      const currentTime = this.material.uniforms.uTime.value;
      const currentOffset = this.timeOffset;

      // 当前角度 = angle + (currentTime + currentOffset) * speed * oldDirection
      // 改变方向后，我们希望：当前角度 = angle + (currentTime + newOffset) * speed * newDirection
      // 所以：(currentTime + currentOffset) * oldDirection = (currentTime + newOffset) * newDirection
      // 展开：currentTime * oldDirection + currentOffset * oldDirection = currentTime * newDirection + newOffset * newDirection
      // 移项：newOffset * newDirection = currentTime * oldDirection + currentOffset * oldDirection - currentTime * newDirection
      // 所以：newOffset = (currentTime * oldDirection + currentOffset * oldDirection - currentTime * newDirection) / newDirection
      // 由于 oldDirection 和 newDirection 只是符号不同（1 和 -1），所以 oldDirection / newDirection = -1
      // 所以：newOffset = (currentTime * oldDirection + currentOffset * oldDirection) / newDirection - currentTime
      //     = (currentTime * oldDirection + currentOffset * oldDirection) * (-1) - currentTime
      //     = -currentTime * oldDirection - currentOffset * oldDirection - currentTime
      // 如果 oldDirection = 1, newDirection = -1:
      //     newOffset = -currentTime - currentOffset - currentTime = -2 * currentTime - currentOffset
      // 如果 oldDirection = -1, newDirection = 1:
      //     newOffset = currentTime + currentOffset - currentTime = currentOffset
      // 统一公式：
      this.timeOffset = (currentTime * oldDirection + currentOffset * oldDirection) / direction - currentTime;
    }

    this.parameters.rotationDirection = direction;

    if (this.material) {
      this.material.uniforms.uRotationDirection.value = direction;
      this.material.uniforms.uTimeOffset.value = this.timeOffset;
    }
  }

  /**
   * 更新旋转速度曲线参数
   * @param {number} rPeak - 峰值半径
   * @param {number} rFlat - 平坦区域结束半径
   * @param {number} vMax - 最大旋转速度
   */
  setRotationCurve(rPeak, rFlat, vMax) {
    if (this.material) {
      this.material.uniforms.uRPeak.value = rPeak;
      this.material.uniforms.uRFlat.value = rFlat;
      this.material.uniforms.uVMax.value = vMax;
    }
    // 同时更新内部参数
    this.rotationParams.rPeak = rPeak;
    this.rotationParams.rFlat = rFlat;
    this.rotationParams.vMax = vMax;
  }

  /**
   * 获取 Three.js 对象
   * @returns {THREE.Points}
   */
  getPoints() {
    return this.points;
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}

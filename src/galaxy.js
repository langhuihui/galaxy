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
            ...parameters
        };

        // 几何体和材质
        this.geometry = null;
        this.material = null;
        this.points = null;

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

        // 颜色插值
        const insideColor = new THREE.Color(this.parameters.insideColor);
        const outsideColor = new THREE.Color(this.parameters.outsideColor);

        // 生成粒子 - 扁平盘状分布，无旋臂结构
        // 使用平滑的密度分布函数，中心密度高，边缘密度低
        for (let i = 0; i < this.parameters.count; i++) {
            const i3 = i * 3;

            // 在XZ平面上分布（盘状结构）
            // 使用贝塞尔曲线或幂函数控制密度分布
            let radius;
            if (this.parameters.densityCurveFn) {
                // 使用贝塞尔曲线
                const randomValue = Math.random();
                const densityFactor = this.parameters.densityCurveFn(randomValue);
                // 调整密度计算，使 densityMax 参数更敏感
                // 当 densityMax 增大时，粒子更集中在中心区域
                const densityMax = this.parameters.densityMax || 10.0;
                const effectiveDensity = 1 - Math.pow(1 - densityFactor, 1 / densityMax);
                const normalizedDensity = Math.max(0, Math.min(1, effectiveDensity));
                radius = normalizedDensity * this.parameters.radius;
            } else {
                // 使用幂函数（向后兼容）
                const radiusPower = this.parameters.densityPower;
                radius = (1 - Math.pow(1 - Math.random(), radiusPower)) * this.parameters.radius;
            }
            
            // 在XY平面上的角度（均匀分布）
            let angle = Math.random() * Math.PI * 2;
            
            // 应用旋臂密度波（如果启用）
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
                if (Math.random() > keepProb) {
                    // 跳过这个粒子，重新生成
                    i--;
                    continue;
                }
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
        }

        // 设置几何体属性
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('distance', new THREE.BufferAttribute(distances, 1));
        this.geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
        this.geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));

        // 创建材质
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uSize: { value: this.parameters.size },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uGlowIntensity: { value: this.parameters.glowIntensity || 2.0 },
                uHaloSize: { value: this.parameters.haloSize || 0.5 }
            },
            vertexShader: `
                uniform float uTime;
                uniform float uSize;
                uniform float uPixelRatio;

                attribute float size;
                attribute float distance;
                attribute float angle;
                attribute float rotationSpeed;
                // color attribute is automatically provided by Three.js when vertexColors: true

                varying vec3 vColor;
                varying float vDistance;

                void main() {
                    // 先获取原始位置
                    vec3 originalPos = position;
                    
                    // 计算在XZ平面上的半径（用于旋转）
                    float radius = sqrt(originalPos.x * originalPos.x + originalPos.z * originalPos.z);
                    
                    // 使用预计算的旋转速度（已经应用了贝塞尔曲线和极值范围）
                    // rotationSpeed 单位是 km/s，需要转换为场景单位
                    // 使用较小的系数使整体旋转更慢，速度差异更不明显
                    float speedInSceneUnits = rotationSpeed * 0.01;
                    
                    // 计算当前角度（根据旋转速度）
                    float currentAngle = angle + uTime * speedInSceneUnits;
                    
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
                }
            `,
            fragmentShader: `
                uniform float uGlowIntensity;
                uniform float uHaloSize;
                
                varying vec3 vColor;
                varying float vDistance;

                void main() {
                    // 计算到粒子中心的距离
                    vec2 center = vec2(0.5);
                    vec2 coord = gl_PointCoord - center;
                    float distanceToCenter = length(coord);
                    
                    // 创建发光的圆形粒子效果
                    // 使用可控制的光晕大小
                    float radius = uHaloSize;
                    
                    // 核心亮度（中心最亮）
                    float core = 1.0 - smoothstep(0.0, 0.15, distanceToCenter);
                    
                    // 外圈光晕（更柔和的光晕效果）
                    float halo = 1.0 - smoothstep(0.15, radius, distanceToCenter);
                    halo = pow(halo, 2.0); // 使光晕更柔和
                    
                    // 组合强度
                    float strength = core + halo * 0.6;
                    
                    // 使用可控制的发光强度
                    vec3 finalColor = vColor * strength * uGlowIntensity;
                    
                    // 根据恒星类型调整颜色（模拟不同年龄的恒星）
                    float ageFactor = clamp(vDistance / 5.0, 0.0, 1.0);
                    vec3 youngStarColor = vec3(0.9, 0.95, 1.0); // 蓝白色
                    vec3 oldStarColor = vec3(1.0, 0.85, 0.7);   // 黄色
                    vec3 starColor = mix(youngStarColor, oldStarColor, ageFactor);
                    
                    finalColor = mix(finalColor, finalColor * starColor, 0.15);
                    
                    // Alpha 值：核心完全不透明，光晕逐渐透明
                    float alpha = core + halo * 0.4;
                    alpha = clamp(alpha, 0.2, 1.0);
                    
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

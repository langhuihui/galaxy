import * as THREE from 'three';
import { Galaxy } from './galaxy.js';

/**
 * 银河系 WebGPU 子类 - 支持异步生成和 WebGPU 渲染
 */
export class GalaxyWebGPU extends Galaxy {
    constructor(parameters = {}) {
        // 调用父类构造函数
        // 注意：父类会在构造函数中调用 generate()，生成 WebGL 版本
        // 我们需要清理这些资源，然后使用异步的 generate() 生成 WebGPU 版本
        super({ ...parameters });
        
        // WebGPU 模式下的多层渲染（光晕层和核心层）
        this.haloSprites = null;  // Sprite 组
        this.coreMaterial = null;
        this.corePoints = null;
        
        // 光晕纹理和材质
        this.glowTexture = null;
        this.spriteMaterial = null;
        
        // NodeMaterial uniforms
        this.nodeMaterialUniforms = null;
        
        // 粒子数据（用于创建光晕 Sprite）
        this.particleData = null;
        
        // 清理父类构造函数中同步生成的 WebGL 资源
        // 因为我们需要异步生成 WebGPU 版本
        if (this.points) {
            this.points = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        // 清理几何体，因为我们需要重新生成（使用正确的密度分布逻辑）
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }
    }

    /**
     * 生成银河系粒子（WebGPU 异步版本）
     */
    async generate() {
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

        // 生成粒子（复用父类的生成逻辑）
        let i = 0;
        while (i < this.parameters.count) {
            const i3 = i * 3;

            // 在XZ平面上分布（盘状结构）
            let radius;
            if (this.parameters.densityCurveFn) {
                // 使用贝塞尔曲线作为概率密度函数（PDF）
                const maxAttempts = 100;
                let attempts = 0;
                let accepted = false;
                
                let maxProbability = 0;
                for (let i = 1; i <= 100; i++) {
                    const rNorm = i / 100;
                    const density = this.parameters.densityCurveFn(rNorm);
                    const probability = density * rNorm; // 考虑面积效应
                    maxProbability = Math.max(maxProbability, probability);
                }
                maxProbability = Math.max(maxProbability, 0.001);
                
                while (!accepted && attempts < maxAttempts) {
                    attempts++;
                    const candidateRadiusNorm = Math.random();
                    const densityAtRadius = this.parameters.densityCurveFn(candidateRadiusNorm);
                    const rNormForProbability = Math.max(candidateRadiusNorm, 0.001);
                    const probabilityDensity = densityAtRadius * rNormForProbability;
                    const acceptProbability = Math.min(1.0, probabilityDensity / maxProbability);
                    if (Math.random() < acceptProbability) {
                        radius = candidateRadiusNorm * this.parameters.radius;
                        accepted = true;
                    }
                }
                
                if (!accepted) {
                    radius = Math.random() * this.parameters.radius;
                }
            } else {
                const radiusPower = this.parameters.densityPower;
                radius = (1 - Math.pow(1 - Math.random(), radiusPower)) * this.parameters.radius;
            }
            
            let angle = Math.random() * Math.PI * 2;
            
            let shouldKeep = true;
            if (this.parameters.armCount > 0 && this.parameters.armDensity > 1.0) {
                const spiralAngle = Math.log(radius + 0.1) * this.parameters.armTightness;
                const branchAngle = (Math.PI * 2 / this.parameters.armCount);
                
                let minAngleDist = Infinity;
                for (let arm = 0; arm < this.parameters.armCount; arm++) {
                    const armAngle = spiralAngle + branchAngle * arm;
                    let angleDiff = Math.abs(angle - armAngle);
                    angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
                    minAngleDist = Math.min(minAngleDist, angleDiff);
                }
                
                const normalizedAngleDist = minAngleDist / (Math.PI / this.parameters.armCount);
                const armInfluence = Math.exp(-Math.pow(normalizedAngleDist / (this.parameters.armWidth * 0.7), 2));
                const densityBoost = 1.0 + (this.parameters.armDensity - 1.0) * armInfluence;
                const keepProb = Math.min(1.0, 0.15 + (densityBoost - 1.0) * 0.8 + 0.2);
                shouldKeep = Math.random() <= keepProb;
            }
            
            if (!shouldKeep) {
                continue;
            }
            
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);
            
            const u1 = Math.random();
            const u2 = Math.random();
            const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            const diskThickness = 0.3;
            const y = gaussian * diskThickness * (1 - radius / this.parameters.radius * 0.5);
            
            const randomX = (Math.random() - 0.5) * this.parameters.randomness * 0.1;
            const randomY = (Math.random() - 0.5) * this.parameters.randomness * 0.05;
            const randomZ = (Math.random() - 0.5) * this.parameters.randomness * 0.1;

            positions[i3] = x + randomX;
            positions[i3 + 1] = y + randomY;
            positions[i3 + 2] = z + randomZ;

            const distance = Math.sqrt((x + randomX) ** 2 + (z + randomZ) ** 2);
            distances[i] = distance;

            const finalAngle = Math.atan2(z + randomZ, x + randomX);
            angles[i] = finalAngle;

            rotationSpeeds[i] = this.calculateRotationSpeed(distance, finalAngle);

            const mixedColor = insideColor.clone();
            mixedColor.lerp(outsideColor, distance / this.parameters.radius);
            colors[i3] = mixedColor.r;
            colors[i3 + 1] = mixedColor.g;
            colors[i3 + 2] = mixedColor.b;

            const baseSize = this.parameters.size;
            const sizeVariation = baseSize * 0.3;
            sizes[i] = baseSize + (Math.random() - 0.5) * sizeVariation;
            
            i++;
        }

        // 验证并修复 NaN 值
        for (let i = 0; i < this.parameters.count; i++) {
            const i3 = i * 3;
            if (isNaN(positions[i3]) || isNaN(positions[i3 + 1]) || isNaN(positions[i3 + 2])) {
                positions[i3] = 0;
                positions[i3 + 1] = 0;
                positions[i3 + 2] = 0;
            }
            if (isNaN(colors[i3]) || isNaN(colors[i3 + 1]) || isNaN(colors[i3 + 2])) {
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
        }

        // 设置几何体属性
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('distance', new THREE.BufferAttribute(distances, 1));
        this.geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
        this.geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
        
        // 存储粒子数据
        this.particleData = {
            positions,
            colors,
            sizes,
            distances,
            angles,
            rotationSpeeds
        };

        // 计算 bounding sphere
        try {
            this.geometry.computeBoundingSphere();
        } catch (error) {
            console.warn('计算 bounding sphere 失败，手动设置默认值:', error);
            this.geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(0, 0, 0), 
                this.parameters.radius * 2
            );
        }

        // 创建 WebGPU 材质（异步）
        console.log('使用 WebGPU 模式，创建多层渲染（光晕层 + 核心层）...');
        await this.createWebGPUMultiLayerMaterials();

        // 创建点系统
        this.corePoints = new THREE.Points(this.geometry, this.coreMaterial);
        this.haloSprites = new THREE.Group();
        this.points = this.corePoints;
        
        // 创建光晕 Sprite
        if (this.spriteMaterial && this.glowTexture && this.particleData) {
            this.createHaloSprites(
                this.particleData.positions,
                this.particleData.colors,
                this.particleData.sizes,
                this.particleData.distances,
                this.particleData.angles,
                this.particleData.rotationSpeeds
            );
        }
    }

    /**
     * 创建光晕纹理（圆形渐变）
     */
    createGlowTexture(size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 创建径向渐变
        const center = size / 2;
        const gradientRadius = center * 0.4; // 只使用 40% 的半径
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, gradientRadius);
        
        // 中心较亮，快速衰减到透明
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * 创建光晕 Sprite（用于 WebGPU 模式）
     */
    createHaloSprites(positions, colors, sizes, distances, angles, rotationSpeeds) {
        if (!this.spriteMaterial || !this.glowTexture) {
            return;
        }
        
        this.haloSprites = new THREE.Group();
        
        // 为了性能考虑，我们只为部分粒子创建光晕 Sprite
        const step = Math.max(1, Math.floor(this.parameters.count / 3000)); // 最多创建 3000 个光晕
        
        for (let i = 0; i < this.parameters.count; i += step) {
            const i3 = i * 3;
            
            // 创建 Sprite
            const sprite = new THREE.Sprite(this.spriteMaterial.clone());
            
            // 设置位置
            sprite.position.set(
                positions[i3],
                positions[i3 + 1],
                positions[i3 + 2]
            );
            
            // 设置大小
            const baseSize = sizes[i];
            const haloSize = baseSize * (1.0 + this.parameters.haloSize * 0.05);
            sprite.scale.set(haloSize, haloSize, 1);
            
            // 设置颜色
            const colorIntensity = this.parameters.glowIntensity * 0.15;
            sprite.material.color.setRGB(
                colors[i3] * colorIntensity,
                colors[i3 + 1] * colorIntensity,
                colors[i3 + 2] * colorIntensity
            );
            
            // 设置透明度
            const normalizedDistance = distances[i] / this.parameters.radius;
            const distanceFactor = 1.0 - normalizedDistance * 0.2;
            sprite.material.opacity = (0.05 + this.parameters.haloSize * 0.05) * distanceFactor;
            
            // 存储粒子数据以便后续更新
            sprite.userData = {
                distance: distances[i],
                angle: angles[i],
                rotationSpeed: rotationSpeeds[i],
                originalIndex: i,
                baseSize: baseSize
            };
            
            this.haloSprites.add(sprite);
        }
        
        console.log(`创建了 ${this.haloSprites.children.length} 个光晕 Sprite`);
    }

    /**
     * 创建 WebGPU 多层材质（使用 Sprite 和纹理实现真正的光晕效果）
     */
    async createWebGPUMultiLayerMaterials() {
        try {
            // 创建光晕纹理
            this.glowTexture = this.createGlowTexture(128);
            
            const webgpuModule = await import('three/webgpu');
            const tslModule = await import('three/tsl');
            
            const { PointsNodeMaterial } = webgpuModule;
            
            // 从 TSL 模块获取函数
            const { 
                uniform, 
                attribute, 
                positionLocal, 
                vec2,
                vec3,
                vec4,
                float,
                sin,
                cos,
                sqrt,
                length,
                smoothstep,
                pow,
                clamp,
                mix
            } = tslModule;

            // 创建 uniforms
            const uTime = uniform(0);
            const uSize = uniform(this.parameters.size);
            const uPixelRatio = uniform(Math.min(window.devicePixelRatio, 2));
            const uGlowIntensity = uniform(this.parameters.glowIntensity || 2.0);
            const uHaloSize = uniform(this.parameters.haloSize || 0.5);
            const uMaxDistance = uniform(this.parameters.radius || 5.0);

            // 存储 uniforms 以便后续更新
            this.nodeMaterialUniforms = {
                uTime,
                uSize,
                uPixelRatio,
                uGlowIntensity,
                uHaloSize,
                uMaxDistance
            };

            // 获取属性
            const sizeAttr = attribute('size');
            const distanceAttr = attribute('distance');
            const angleAttr = attribute('angle');
            const rotationSpeedAttr = attribute('rotationSpeed');
            const colorAttr = attribute('color');

            // 顶点着色器逻辑：计算旋转后的位置
            const originalPos = positionLocal;
            const radius = sqrt(originalPos.x.mul(originalPos.x).add(originalPos.z.mul(originalPos.z)));
            const speedInSceneUnits = rotationSpeedAttr.mul(0.01);
            const currentAngle = angleAttr.add(uTime.mul(speedInSceneUnits));
            const rotatedPos = vec3(
                cos(currentAngle).mul(radius),
                originalPos.y,
                sin(currentAngle).mul(radius)
            );

            // 创建核心层材质
            const coreMaterial = new PointsNodeMaterial({
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true
            });

            coreMaterial.positionNode = rotatedPos;
            
            // 核心层使用正常尺寸
            const corePointSize = sizeAttr.mul(uSize).mul(uPixelRatio);
            coreMaterial.sizeNode = corePointSize;
            coreMaterial.sizeAttenuation = true;

            // 核心层颜色和透明度
            const normalizedDistance = clamp(distanceAttr.div(uMaxDistance), float(0.0), float(1.0));
            const distanceAttenuation = float(1.0).sub(normalizedDistance.mul(float(0.1)));
            
            const coreColorIntensity = uGlowIntensity.mul(float(1.0));
            const coreColor = colorAttr.mul(coreColorIntensity).mul(distanceAttenuation);
            
            // 根据恒星类型调整核心颜色
            const ageFactor = clamp(distanceAttr.div(float(5.0)), float(0.0), float(1.0));
            const youngStarColor = vec3(0.9, 0.95, 1.0);
            const oldStarColor = vec3(1.0, 0.85, 0.7);
            const starColor = mix(youngStarColor, oldStarColor, ageFactor);
            const coreColorWithAge = mix(coreColor, coreColor.mul(starColor), float(0.15));
            
            coreMaterial.colorNode = coreColorWithAge;
            
            // 核心层透明度
            const coreAlphaBase = float(0.9);
            const coreAlphaDistance = float(1.0).sub(normalizedDistance.mul(float(0.1)));
            const coreAlpha = clamp(coreAlphaBase.mul(coreAlphaDistance), float(0.7), float(1.0));
            coreMaterial.opacityNode = coreAlpha;

            // 存储材质
            this.coreMaterial = coreMaterial;
            
            // 创建 Sprite 材质用于光晕层
            this.spriteMaterial = new THREE.SpriteMaterial({
                map: this.glowTexture,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: 0.5
            });
            
            console.log('WebGPU 材质创建成功（Sprite 光晕 + Points 核心）');
        } catch (error) {
            console.error('无法创建 WebGPU 多层材质:', error);
            throw new Error('WebGPU 模式下无法创建多层材质: ' + (error.message || error));
        }
    }

    /**
     * 获取 Three.js 对象（WebGPU 模式）
     * @returns {THREE.Points|THREE.Group|null} 返回包含光晕 Sprite 和核心层的组
     */
    getPoints() {
        if (!this.corePoints) {
            return null;
        }
        
        if (this.haloSprites && this.haloSprites.children && this.haloSprites.children.length > 0) {
            const group = new THREE.Group();
            group.add(this.haloSprites);
            group.add(this.corePoints);
            return group;
        }
        
        return this.corePoints;
    }

    /**
     * 更新动画
     * @param {number} elapsedTime - 经过的时间（秒）
     */
    update(elapsedTime) {
        // 更新 WebGPU NodeMaterial 的 uniforms（核心层）
        if (this.nodeMaterialUniforms) {
            this.nodeMaterialUniforms.uTime.value = elapsedTime;
            
            // 更新光晕 Sprite 的位置（根据旋转速度）
            if (this.haloSprites) {
                this.haloSprites.children.forEach(sprite => {
                    const { distance, angle, rotationSpeed } = sprite.userData;
                    const speedInSceneUnits = rotationSpeed * 0.01;
                    const currentAngle = angle + elapsedTime * speedInSceneUnits;
                    
                    // 更新位置（在 XZ 平面上旋转）
                    sprite.position.x = Math.cos(currentAngle) * distance;
                    sprite.position.z = Math.sin(currentAngle) * distance;
                    // Y 坐标保持不变
                });
            }
        }
    }

    /**
     * 更新发光强度
     * @param {number} intensity - 发光强度
     */
    setGlowIntensity(intensity) {
        this.parameters.glowIntensity = intensity;
        
        // 更新 uniforms
        if (this.nodeMaterialUniforms) {
            this.nodeMaterialUniforms.uGlowIntensity.value = intensity;
        }
        
        // 更新所有光晕 Sprite 的颜色强度
        if (this.haloSprites && this.geometry) {
            const colorAttr = this.geometry.getAttribute('color');
            
            this.haloSprites.children.forEach(sprite => {
                const { originalIndex } = sprite.userData;
                
                if (originalIndex !== undefined && colorAttr) {
                    const i3 = originalIndex * 3;
                    const colorIntensity = intensity * 0.15;
                    sprite.material.color.setRGB(
                        colorAttr.array[i3] * colorIntensity,
                        colorAttr.array[i3 + 1] * colorIntensity,
                        colorAttr.array[i3 + 2] * colorIntensity
                    );
                }
            });
        }
    }

    /**
     * 更新光晕大小
     * @param {number} size - 光晕大小
     */
    setHaloSize(size) {
        this.parameters.haloSize = size;
        
        // 更新 uniforms
        if (this.nodeMaterialUniforms) {
            this.nodeMaterialUniforms.uHaloSize.value = size;
        }
        
        // 更新所有光晕 Sprite 的大小和透明度
        if (this.haloSprites && this.haloSprites.children.length > 0) {
            this.haloSprites.children.forEach(sprite => {
                const { baseSize, distance } = sprite.userData;
                
                if (baseSize !== undefined && baseSize > 0 && distance !== undefined) {
                    // 更新光晕大小
                    const haloSize = baseSize * (1.0 + size * 0.05);
                    sprite.scale.x = haloSize;
                    sprite.scale.y = haloSize;
                    sprite.scale.z = 1;
                    
                    // 更新透明度
                    const normalizedDistance = distance / this.parameters.radius;
                    const distanceFactor = 1.0 - normalizedDistance * 0.2;
                    sprite.material.opacity = (0.05 + size * 0.05) * distanceFactor;
                }
            });
            
            // 强制更新矩阵
            this.haloSprites.updateMatrixWorld(true);
        }
    }

    /**
     * 销毁（WebGPU 模式）
     */
    dispose() {
        // 调用父类方法
        super.dispose();
        
        // 销毁 WebGPU 特定资源
        if (this.haloSprites) {
            if (this.haloSprites.children) {
                this.haloSprites.children.forEach(sprite => {
                    if (sprite && sprite.material) {
                        sprite.material.dispose();
                    }
                });
            }
            this.haloSprites.clear();
        }
        if (this.coreMaterial) {
            this.coreMaterial.dispose();
        }
        if (this.corePoints) {
            this.corePoints = null;
        }
        if (this.spriteMaterial) {
            this.spriteMaterial.dispose();
        }
        if (this.glowTexture) {
            this.glowTexture.dispose();
        }
    }
}

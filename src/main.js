import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Galaxy } from './galaxy.js';
import { CurveEditor } from './curveEditor.js';

/**
 * 银河系模拟主应用
 */
class GalaxySimulation {
  // 默认参数配置对象
  static DEFAULT_PARAMS = {
    // 基础参数
    rotationSpeed: 0.1,
    particleCount: 50000,
    particleSize: 4.0,
    galaxyRadius: 6.5,
    randomness: 0.3,
    glowIntensity: 8.0,
    viscosity: 0.0,
    insideColor: '#ffaa44',
    outsideColor: '#4488ff',
    cloudRatio: 0.08,
    cloudHaloMultiplier: 3.0,
    randomBrightness: true,
    brightnessRange: [0.6, 1.4],
    randomSize: true,
    sizeRange: [4.0, 40.0],
    rotationDirection: 1, // 1为顺时针，-1为逆时针

    // Bloom 参数
    bloomStrength: 0.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,

    // 极值范围
    rotationSpeedMin: 0,
    rotationSpeedMax: 150,
    densityMin: 0.0,
    densityMax: 2.0,

    // 旋臂参数
    armCount: 3,
    armTightness: 1.0,
    armDensity: 2.0,
    armWidth: 0.3,

    // 曲线控制点（凹形曲线，中间控制点靠近左下角）
    rotationCurvePoints: [
      { x: 0, y: 1 },
      { x: 0.2, y: 0.2 },
      { x: 0.2, y: 0.1 },
      { x: 1, y: 0 }
    ],
    densityCurvePoints: [
      { x: 0, y: 1 },
      { x: 0.2, y: 0.2 },
      { x: 0.2, y: 0.1 },
      { x: 1, y: 0 }
    ]
  };

  constructor() {
    // 场景元素
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.composer = null;
    this.bloomPass = null;

    // 银河系对象
    this.galaxy = null;

    // 动画参数
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;
    this.rotationSpeedMultiplier = GalaxySimulation.DEFAULT_PARAMS.rotationSpeed; // 使用默认参数

    // UI 元素
    this.rotationSpeedSlider = document.getElementById('rotation-speed');
    this.particleCountSlider = document.getElementById('particle-count');
    this.particleSizeSlider = document.getElementById('particle-size');
    this.galaxyRadiusSlider = document.getElementById('galaxy-radius');
    this.randomnessSlider = document.getElementById('randomness');
    this.rotationSpeedMinSlider = document.getElementById('rotation-speed-min');
    this.rotationSpeedMaxSlider = document.getElementById('rotation-speed-max');
    this.densityMinSlider = document.getElementById('density-min');
    this.densityMaxSlider = document.getElementById('density-max');
    this.armCountSlider = document.getElementById('arm-count');
    this.armTightnessSlider = document.getElementById('arm-tightness');
    this.armDensitySlider = document.getElementById('arm-density');
    this.armWidthSlider = document.getElementById('arm-width');
    this.glowIntensitySlider = document.getElementById('glow-intensity');
    this.viscositySlider = document.getElementById('viscosity');
    this.insideColorInput = document.getElementById('inside-color');
    this.outsideColorInput = document.getElementById('outside-color');
    this.cloudRatioSlider = document.getElementById('cloud-ratio');
    this.cloudHaloMultiplierSlider = document.getElementById('cloud-halo-multiplier');
    this.randomBrightnessCheckbox = document.getElementById('random-brightness');
    this.brightnessMinSlider = document.getElementById('brightness-min');
    this.brightnessMaxSlider = document.getElementById('brightness-max');
    this.randomSizeCheckbox = document.getElementById('random-size');
    this.sizeMinSlider = document.getElementById('size-min');
    this.sizeMaxSlider = document.getElementById('size-max');
    this.rotationDirectionCwBtn = document.getElementById('rotation-direction-cw');
    this.rotationDirectionCcwBtn = document.getElementById('rotation-direction-ccw');
    this.rotationCurveBtn = document.getElementById('rotation-curve-btn');
    this.densityCurveBtn = document.getElementById('density-curve-btn');

    // Bloom 参数 UI 元素
    this.bloomStrengthSlider = document.getElementById('bloom-strength');
    this.bloomRadiusSlider = document.getElementById('bloom-radius');
    this.bloomThresholdSlider = document.getElementById('bloom-threshold');
    this.bloomStrengthValue = document.getElementById('bloom-strength-value');
    this.bloomRadiusValue = document.getElementById('bloom-radius-value');
    this.bloomThresholdValue = document.getElementById('bloom-threshold-value');

    // 曲线编辑器
    this.rotationCurveEditor = null;
    this.densityCurveEditor = null;

    this.rotationSpeedValue = document.getElementById('rotation-speed-value');
    this.particleCountValue = document.getElementById('particle-count-value');
    this.galaxyRadiusValue = document.getElementById('galaxy-radius-value');
    this.randomnessValue = document.getElementById('randomness-value');
    this.glowIntensityValue = document.getElementById('glow-intensity-value');
    this.viscosityValue = document.getElementById('viscosity-value');
    this.cloudRatioValue = document.getElementById('cloud-ratio-value');
    this.cloudHaloMultiplierValue = document.getElementById('cloud-halo-multiplier-value');
    this.brightnessMinValue = document.getElementById('brightness-min-value');
    this.brightnessMaxValue = document.getElementById('brightness-max-value');
    this.sizeMinValue = document.getElementById('size-min-value');
    this.sizeMaxValue = document.getElementById('size-max-value');

    // 视角按钮
    this.viewTopBtn = document.getElementById('view-top');
    this.viewSideBtn = document.getElementById('view-side');
    this.view45Btn = document.getElementById('view-45');
    this.resetBtn = document.getElementById('reset-params');
    this.exportBtn = document.getElementById('export-params');
    this.importBtn = document.getElementById('import-params');
    this.importFileInput = document.getElementById('import-file');

    this.initializeDefaultValues(); // 先初始化默认值

    this.init();
    this.initCurveEditors(); // 初始化曲线编辑器
    // 重新创建银河系，确保使用正确的曲线参数
    this.createGalaxy();
    this.setupControls();
    this.setupDialogCloseOnClickOutside(); // 设置对话框点击外部关闭
    this.hideLoadingScreen(); // 隐藏加载画面
    this.animate();
  }

  /**
   * 初始化场景
   */
  init() {
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // 创建相机
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    // 创建渲染器
    // 显式设置所有参数以确保与旧版本行为一致
    // r182 中 alpha 默认值从 false 改为 true，这里显式设置为 false 以匹配旧版本
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,  // 显式设置为 false，匹配旧版本默认值
      preserveDrawingBuffer: false,  // 显式设置默认值
      powerPreference: "high-performance"  // 性能偏好
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // 尝试不同的 tone mapping 设置以匹配 r160
    // 提高 exposure 让粒子更亮，但通过着色器中的中心区域衰减来控制中心过亮
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;  // 提高到 0.7，让粒子更亮
    // r160 默认是 SRGBColorSpace
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 设置清除颜色为黑色（确保背景一致）
    this.renderer.setClearColor(0x000000, 1.0);
    container.appendChild(this.renderer.domElement);

    // 创建轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 30;

    // 创建银河系
    this.createGalaxy();

    // 设置后处理
    this.setupPostProcessing();

    // 窗口大小调整
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * 初始化曲线编辑器（在对话框中）
   */
  initCurveEditors() {
    // 旋转速度曲线编辑器（在对话框中初始化）
    const rotationCanvas = document.getElementById('rotation-curve-canvas-dialog');
    if (rotationCanvas) {
      this.rotationCurveEditor = new CurveEditor('rotation-curve-canvas-dialog', {
        controlPoints: GalaxySimulation.DEFAULT_PARAMS.rotationCurvePoints,
        onUpdate: (curveFn) => {
          if (this.galaxy) {
            this.galaxy.parameters.rotationCurveFn = curveFn;
            // 重建银河系以应用新曲线
            clearTimeout(this.rebuildTimeout);
            this.rebuildTimeout = setTimeout(() => {
              this.createGalaxy();
            }, 300);
          }
        }
      });
    }

    // 密度分布曲线编辑器（在对话框中初始化）
    const densityCanvas = document.getElementById('density-curve-canvas-dialog');
    if (densityCanvas) {
      this.densityCurveEditor = new CurveEditor('density-curve-canvas-dialog', {
        controlPoints: GalaxySimulation.DEFAULT_PARAMS.densityCurvePoints,
        onUpdate: (curveFn) => {
          if (this.galaxy) {
            this.galaxy.parameters.densityCurveFn = curveFn;
            // 重建银河系以应用新曲线
            clearTimeout(this.rebuildTimeout);
            this.rebuildTimeout = setTimeout(() => {
              this.createGalaxy();
            }, 300);
          }
        }
      });
    }
  }

  /**
   * 显示曲线编辑对话框
   * @param {string} type - 'rotation' 或 'density'
   */
  showCurveDialog(type) {
    const dialogId = type === 'rotation' ? 'rotation-curve-dialog' : 'density-curve-dialog';
    const dialog = document.getElementById(dialogId);
    if (dialog) {
      dialog.style.display = 'flex';

      // 重新初始化编辑器以适应对话框大小
      // 需要等待对话框显示后，canvas 才能获取正确的尺寸
      setTimeout(() => {
        if (type === 'rotation' && this.rotationCurveEditor) {
          this.rotationCurveEditor.init();
        } else if (type === 'density' && this.densityCurveEditor) {
          this.densityCurveEditor.init();
        }
      }, 100);
    }
  }

  /**
   * 关闭曲线编辑对话框
   * @param {string} type - 'rotation' 或 'density'
   */
  closeCurveDialog(type) {
    const dialogId = type === 'rotation' ? 'rotation-curve-dialog' : 'density-curve-dialog';
    const dialog = document.getElementById(dialogId);
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  /**
   * 点击对话框外部关闭对话框
   */
  setupDialogCloseOnClickOutside() {
    const rotationDialog = document.getElementById('rotation-curve-dialog');
    const densityDialog = document.getElementById('density-curve-dialog');

    if (rotationDialog) {
      rotationDialog.addEventListener('click', (e) => {
        if (e.target === rotationDialog) {
          this.closeCurveDialog('rotation');
        }
      });
    }

    if (densityDialog) {
      densityDialog.addEventListener('click', (e) => {
        if (e.target === densityDialog) {
          this.closeCurveDialog('density');
        }
      });
    }
  }

  /**
   * 创建银河系
   */
  createGalaxy() {
    // 如果已存在，先销毁
    if (this.galaxy) {
      const oldPoints = this.galaxy.getPoints();
      if (oldPoints) {
        this.scene.remove(oldPoints);
      }
      this.galaxy.dispose();
    }

    const params = GalaxySimulation.DEFAULT_PARAMS;
    const particleCount = parseInt(this.particleCountSlider?.value || params.particleCount);
    const particleSize = parseFloat(this.particleSizeSlider?.value || params.particleSize);
    const galaxyRadius = parseFloat(this.galaxyRadiusSlider?.value || params.galaxyRadius);
    const randomness = parseFloat(this.randomnessSlider?.value || params.randomness);
    const glowIntensity = parseFloat(this.glowIntensitySlider?.value || params.glowIntensity);
    const viscosity = parseFloat(this.viscositySlider?.value || params.viscosity);
    const insideColor = this.insideColorInput?.value || params.insideColor;
    const outsideColor = this.outsideColorInput?.value || params.outsideColor;
    const cloudRatio = parseFloat(this.cloudRatioSlider?.value || params.cloudRatio);
    const cloudHaloMultiplier = parseFloat(this.cloudHaloMultiplierSlider?.value || params.cloudHaloMultiplier);
    const randomBrightness = this.randomBrightnessCheckbox?.checked !== undefined ? this.randomBrightnessCheckbox.checked : params.randomBrightness;
    const brightnessMin = parseFloat(this.brightnessMinSlider?.value || params.brightnessRange[0]);
    const brightnessMax = parseFloat(this.brightnessMaxSlider?.value || params.brightnessRange[1]);
    const randomSize = this.randomSizeCheckbox?.checked !== undefined ? this.randomSizeCheckbox.checked : params.randomSize;
    const sizeMin = parseFloat(this.sizeMinSlider?.value || params.sizeRange[0]);
    const sizeMax = parseFloat(this.sizeMaxSlider?.value || params.sizeRange[1]);
    // 获取旋转方向：从按钮状态获取，默认顺时针
    let rotationDirection = params.rotationDirection;
    if (this.rotationDirectionCwBtn?.classList.contains('active')) {
      rotationDirection = 1;
    } else if (this.rotationDirectionCcwBtn?.classList.contains('active')) {
      rotationDirection = -1;
    }

    // 旋臂参数
    const armCount = parseInt(this.armCountSlider?.value || params.armCount);
    const armTightness = parseFloat(this.armTightnessSlider?.value || params.armTightness);
    const armDensity = parseFloat(this.armDensitySlider?.value || params.armDensity);
    const armWidth = parseFloat(this.armWidthSlider?.value || params.armWidth);

    // 极值范围
    const rotationSpeedMin = parseFloat(this.rotationSpeedMinSlider?.value || params.rotationSpeedMin);
    const rotationSpeedMax = parseFloat(this.rotationSpeedMaxSlider?.value || params.rotationSpeedMax);
    const densityMin = parseFloat(this.densityMinSlider?.value || params.densityMin);
    const densityMax = parseFloat(this.densityMaxSlider?.value || params.densityMax);

    // 获取曲线函数并应用极值范围
    const baseRotationCurveFn = this.rotationCurveEditor?.getCurve() || null;
    const baseDensityCurveFn = this.densityCurveEditor?.getCurve() || null;

    // 应用极值范围缩放
    let rotationCurveFn = null;
    if (baseRotationCurveFn) {
      rotationCurveFn = (x) => {
        const normalized = baseRotationCurveFn(x); // 0-1范围
        return rotationSpeedMin + normalized * (rotationSpeedMax - rotationSpeedMin);
      };
    }

    let densityCurveFn = null;
    if (baseDensityCurveFn) {
      densityCurveFn = (x) => {
        const normalized = baseDensityCurveFn(x); // 0-1范围
        // 应用密度范围缩放
        return densityMin + normalized * (densityMax - densityMin);
      };
    }

    this.galaxy = new Galaxy({
      count: particleCount,
      size: particleSize,
      radius: galaxyRadius,
      armCount: armCount, // 统一使用 armCount，删除硬编码的 branches
      spin: 1,
      randomness: randomness,
      randomnessPower: 3,
      insideColor: insideColor,
      outsideColor: outsideColor,
      glowIntensity: glowIntensity,
      viscosity: viscosity,
      rotationCurveFn: rotationCurveFn,
      densityCurveFn: densityCurveFn,
      armTightness: armTightness,
      armDensity: armDensity,
      armWidth: armWidth,
      rotationSpeedMin: rotationSpeedMin,
      rotationSpeedMax: rotationSpeedMax,
      densityMin: densityMin,
      densityMax: densityMax,
      cloudRatio: cloudRatio,
      cloudHaloMultiplier: cloudHaloMultiplier,
      randomBrightness: randomBrightness,
      brightnessRange: [brightnessMin, brightnessMax],
      randomSize: randomSize,
      sizeRange: [sizeMin, sizeMax],
      rotationDirection: rotationDirection
    });

    // 同步生成银河系（WebGL 模式）
    this.galaxy.generate();
    this.scene.add(this.galaxy.getPoints());
  }

  /**
   * 设置后处理效果
   */
  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);

    // 渲染通道
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 泛光效果（优化阈值和半径，减少闪烁）
    // 降低阈值、增大半径，减少亚像素亮度跳变导致的阈值闪烁
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,  // 强度：从 0.7 降低到 0.5，避免过度放大亚像素抖动
      0.4,  // 半径：从 0.3 提高到 0.4，让泛光更平滑
      0.85  // 阈值：从 0.95 降低到 0.85，减少亮度在阈值附近跳变
    );
    this.composer.addPass(this.bloomPass);
  }

  /**
   * 导出参数
   */
  exportParameters() {
    const params = {
      // 基础参数
      rotationSpeed: parseFloat(this.rotationSpeedSlider.value),
      particleCount: parseInt(this.particleCountSlider.value),
      galaxyRadius: parseFloat(this.galaxyRadiusSlider.value),
      randomness: parseFloat(this.randomnessSlider.value),
      glowIntensity: parseFloat(this.glowIntensitySlider.value),
      viscosity: parseFloat(this.viscositySlider.value),
      insideColor: this.insideColorInput.value,
      outsideColor: this.outsideColorInput.value,
      cloudRatio: parseFloat(this.cloudRatioSlider.value),
      cloudHaloMultiplier: parseFloat(this.cloudHaloMultiplierSlider.value),
      randomBrightness: this.randomBrightnessCheckbox.checked,
      brightnessRange: [
        parseFloat(this.brightnessMinSlider.value),
        parseFloat(this.brightnessMaxSlider.value)
      ],
      randomSize: this.randomSizeCheckbox.checked,
      sizeRange: [
        parseFloat(this.sizeMinSlider.value),
        parseFloat(this.sizeMaxSlider.value)
      ],
      rotationDirection: this.rotationDirectionCwBtn?.classList.contains('active') ? 1 : -1,

      // Bloom 参数
      bloomStrength: parseFloat(this.bloomStrengthSlider.value),
      bloomRadius: parseFloat(this.bloomRadiusSlider.value),
      bloomThreshold: parseFloat(this.bloomThresholdSlider.value),

      // 曲线参数
      rotationSpeedMin: parseFloat(this.rotationSpeedMinSlider.value),
      rotationSpeedMax: parseFloat(this.rotationSpeedMaxSlider.value),
      densityMin: parseFloat(this.densityMinSlider.value),
      densityMax: parseFloat(this.densityMaxSlider.value),

      // 旋臂参数
      armCount: parseInt(this.armCountSlider.value),
      armTightness: parseFloat(this.armTightnessSlider.value),
      armDensity: parseFloat(this.armDensitySlider.value),
      armWidth: parseFloat(this.armWidthSlider.value),

      // 曲线控制点
      rotationCurvePoints: this.rotationCurveEditor.getControlPoints(),
      densityCurvePoints: this.densityCurveEditor.getControlPoints()
    };

    // 创建下载链接
    const dataStr = JSON.stringify(params, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `galaxy-params-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  /**
   * 导入参数
   */
  importParameters(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const params = JSON.parse(e.target.result);

        // 设置基础参数
        if (params.rotationSpeed !== undefined) {
          this.rotationSpeedSlider.value = params.rotationSpeed;
          this.rotationSpeedMultiplier = parseFloat(params.rotationSpeed);
          this.rotationSpeedValue.textContent = params.rotationSpeed.toFixed(2);
        }

        if (params.particleCount !== undefined) {
          this.particleCountSlider.value = params.particleCount;
          this.particleCountValue.textContent = params.particleCount.toLocaleString();
        }

        if (params.galaxyRadius !== undefined) {
          this.galaxyRadiusSlider.value = params.galaxyRadius;
          this.galaxyRadiusValue.textContent = params.galaxyRadius.toFixed(1);
        }

        if (params.randomness !== undefined) {
          this.randomnessSlider.value = params.randomness;
          this.randomnessValue.textContent = params.randomness.toFixed(2);
        }

        if (params.glowIntensity !== undefined) {
          this.glowIntensitySlider.value = params.glowIntensity;
          this.glowIntensityValue.textContent = params.glowIntensity.toFixed(1);
        }

        if (params.viscosity !== undefined) {
          this.viscositySlider.value = params.viscosity;
          this.viscosityValue.textContent = params.viscosity.toFixed(2);
        }

        if (params.insideColor !== undefined) {
          this.insideColorInput.value = params.insideColor;
        }

        if (params.outsideColor !== undefined) {
          this.outsideColorInput.value = params.outsideColor;
        }

        // 设置云雾和亮度参数
        if (params.cloudRatio !== undefined) {
          this.cloudRatioSlider.value = params.cloudRatio;
          if (this.cloudRatioValue) {
            this.cloudRatioValue.textContent = (params.cloudRatio * 100).toFixed(1) + '%';
          }
        }

        if (params.cloudHaloMultiplier !== undefined) {
          this.cloudHaloMultiplierSlider.value = params.cloudHaloMultiplier;
          if (this.cloudHaloMultiplierValue) {
            this.cloudHaloMultiplierValue.textContent = params.cloudHaloMultiplier.toFixed(1);
          }
        }

        if (params.randomBrightness !== undefined) {
          this.randomBrightnessCheckbox.checked = params.randomBrightness;
        }

        if (params.brightnessRange !== undefined) {
          if (params.brightnessRange[0] !== undefined) {
            this.brightnessMinSlider.value = params.brightnessRange[0];
            if (this.brightnessMinValue) {
              this.brightnessMinValue.textContent = params.brightnessRange[0].toFixed(2);
            }
          }
          if (params.brightnessRange[1] !== undefined) {
            this.brightnessMaxSlider.value = params.brightnessRange[1];
            if (this.brightnessMaxValue) {
              this.brightnessMaxValue.textContent = params.brightnessRange[1].toFixed(2);
            }
          }
        }

        if (params.randomSize !== undefined) {
          this.randomSizeCheckbox.checked = params.randomSize;
        }

        if (params.sizeRange !== undefined) {
          if (params.sizeRange[0] !== undefined) {
            this.sizeMinSlider.value = params.sizeRange[0];
            if (this.sizeMinValue) {
              this.sizeMinValue.textContent = params.sizeRange[0].toFixed(2);
            }
          }
          if (params.sizeRange[1] !== undefined) {
            this.sizeMaxSlider.value = params.sizeRange[1];
            if (this.sizeMaxValue) {
              this.sizeMaxValue.textContent = params.sizeRange[1].toFixed(2);
            }
          }
        }

        if (params.rotationDirection !== undefined) {
          if (params.rotationDirection === 1) {
            if (this.rotationDirectionCwBtn) this.rotationDirectionCwBtn.classList.add('active');
            if (this.rotationDirectionCcwBtn) this.rotationDirectionCcwBtn.classList.remove('active');
          } else {
            if (this.rotationDirectionCcwBtn) this.rotationDirectionCcwBtn.classList.add('active');
            if (this.rotationDirectionCwBtn) this.rotationDirectionCwBtn.classList.remove('active');
          }
          // 更新银河系旋转方向
          if (this.galaxy) {
            this.galaxy.setRotationDirection(params.rotationDirection);
          }
        }

        // 设置 Bloom 参数
        if (params.bloomStrength !== undefined) {
          this.bloomStrengthSlider.value = params.bloomStrength;
          if (this.bloomStrengthValue) {
            this.bloomStrengthValue.textContent = params.bloomStrength.toFixed(2);
          }
        }
        if (params.bloomRadius !== undefined) {
          this.bloomRadiusSlider.value = params.bloomRadius;
          if (this.bloomRadiusValue) {
            this.bloomRadiusValue.textContent = params.bloomRadius.toFixed(2);
          }
        }
        if (params.bloomThreshold !== undefined) {
          this.bloomThresholdSlider.value = params.bloomThreshold;
          if (this.bloomThresholdValue) {
            this.bloomThresholdValue.textContent = params.bloomThreshold.toFixed(2);
          }
        }

        // 设置曲线参数
        if (params.rotationSpeedMin !== undefined) {
          this.rotationSpeedMinSlider.value = params.rotationSpeedMin;
          document.getElementById('rotation-speed-min-value').textContent = params.rotationSpeedMin.toFixed(0);
        }

        if (params.rotationSpeedMax !== undefined) {
          this.rotationSpeedMaxSlider.value = params.rotationSpeedMax;
          document.getElementById('rotation-speed-max-value').textContent = params.rotationSpeedMax.toFixed(0);
        }

        if (params.densityMin !== undefined) {
          this.densityMinSlider.value = params.densityMin;
          document.getElementById('density-min-value').textContent = params.densityMin.toFixed(1);
        }

        if (params.densityMax !== undefined) {
          this.densityMaxSlider.value = params.densityMax;
          document.getElementById('density-max-value').textContent = params.densityMax.toFixed(1);
        }

        // 设置旋臂参数
        if (params.armCount !== undefined) {
          this.armCountSlider.value = params.armCount;
          document.getElementById('arm-count-value').textContent = params.armCount;
        }

        if (params.armTightness !== undefined) {
          this.armTightnessSlider.value = params.armTightness;
          document.getElementById('arm-tightness-value').textContent = params.armTightness.toFixed(1);
        }

        if (params.armDensity !== undefined) {
          this.armDensitySlider.value = params.armDensity;
          document.getElementById('arm-density-value').textContent = params.armDensity.toFixed(1);
        }

        if (params.armWidth !== undefined) {
          this.armWidthSlider.value = params.armWidth;
          document.getElementById('arm-width-value').textContent = params.armWidth.toFixed(2);
        }

        // 设置曲线控制点
        if (params.rotationCurvePoints) {
          this.rotationCurveEditor.setControlPoints(params.rotationCurvePoints);
        }

        if (params.densityCurvePoints) {
          this.densityCurveEditor.setControlPoints(params.densityCurvePoints);
        }

        // 重建银河系
        this.createGalaxy();

        console.log('参数导入成功');
      } catch (error) {
        console.error('参数导入失败:', error);
        alert('参数导入失败，请确保文件格式正确');
      }
    };
    reader.readAsText(file);
  }

  /**
   * 初始化 UI 元素的默认值
   */
  initializeDefaultValues() {
    const params = GalaxySimulation.DEFAULT_PARAMS;

    // 基础参数
    if (this.rotationSpeedSlider) {
      this.rotationSpeedSlider.value = params.rotationSpeed;
    }
    if (this.particleCountSlider) {
      this.particleCountSlider.value = params.particleCount;
    }
    if (this.galaxyRadiusSlider) {
      this.galaxyRadiusSlider.value = params.galaxyRadius;
    }
    if (this.randomnessSlider) {
      this.randomnessSlider.value = params.randomness;
    }

    // Bloom 参数
    if (this.bloomStrengthSlider) {
      this.bloomStrengthSlider.value = params.bloomStrength;
    }
    if (this.bloomRadiusSlider) {
      this.bloomRadiusSlider.value = params.bloomRadius;
    }
    if (this.bloomThresholdSlider) {
      this.bloomThresholdSlider.value = params.bloomThreshold;
    }

    // 颜色
    if (this.insideColorInput) {
      this.insideColorInput.value = params.insideColor;
    }
    if (this.outsideColorInput) {
      this.outsideColorInput.value = params.outsideColor;
    }

    // 发光强度
    if (this.glowIntensitySlider) {
      this.glowIntensitySlider.value = params.glowIntensity;
    }

    // 随机大小
    if (this.randomSizeCheckbox) {
      this.randomSizeCheckbox.checked = params.randomSize;
    }
    if (this.sizeMinSlider) {
      this.sizeMinSlider.value = params.sizeRange[0];
    }
    if (this.sizeMaxSlider) {
      this.sizeMaxSlider.value = params.sizeRange[1];
    }

    // 随机亮度
    if (this.randomBrightnessCheckbox) {
      this.randomBrightnessCheckbox.checked = params.randomBrightness;
    }
    if (this.brightnessMinSlider) {
      this.brightnessMinSlider.value = params.brightnessRange[0];
    }
    if (this.brightnessMaxSlider) {
      this.brightnessMaxSlider.value = params.brightnessRange[1];
    }

    // 云雾效果
    if (this.cloudRatioSlider) {
      this.cloudRatioSlider.value = params.cloudRatio;
    }
    if (this.cloudHaloMultiplierSlider) {
      this.cloudHaloMultiplierSlider.value = params.cloudHaloMultiplier;
    }

    // 旋转方向
    if (params.rotationDirection === 1) {
      if (this.rotationDirectionCwBtn) this.rotationDirectionCwBtn.classList.add('active');
      if (this.rotationDirectionCcwBtn) this.rotationDirectionCcwBtn.classList.remove('active');
    } else {
      if (this.rotationDirectionCcwBtn) this.rotationDirectionCcwBtn.classList.add('active');
      if (this.rotationDirectionCwBtn) this.rotationDirectionCwBtn.classList.remove('active');
    }

    // 曲线参数
    if (this.rotationSpeedMinSlider) {
      this.rotationSpeedMinSlider.value = params.rotationSpeedMin;
    }
    if (this.rotationSpeedMaxSlider) {
      this.rotationSpeedMaxSlider.value = params.rotationSpeedMax;
    }
    if (this.densityMinSlider) {
      this.densityMinSlider.value = params.densityMin;
    }
    if (this.densityMaxSlider) {
      this.densityMaxSlider.value = params.densityMax;
    }

    // 旋臂参数
    if (this.armCountSlider) {
      this.armCountSlider.value = params.armCount;
    }
    if (this.armTightnessSlider) {
      this.armTightnessSlider.value = params.armTightness;
    }
    if (this.armDensitySlider) {
      this.armDensitySlider.value = params.armDensity;
    }
    if (this.armWidthSlider) {
      this.armWidthSlider.value = params.armWidth;
    }

    // 粘滞效果
    if (this.viscositySlider) {
      this.viscositySlider.value = params.viscosity;
    }

    // 更新所有值显示
    this.updateValueDisplays();
  }

  /**
   * 更新所有值显示
   */
  updateValueDisplays() {
    const params = GalaxySimulation.DEFAULT_PARAMS;

    if (this.rotationSpeedValue) {
      this.rotationSpeedValue.textContent = parseFloat(this.rotationSpeedSlider.value).toFixed(2);
    }
    if (this.particleCountValue) {
      this.particleCountValue.textContent = parseInt(this.particleCountSlider.value).toLocaleString();
    }
    if (this.galaxyRadiusValue) {
      this.galaxyRadiusValue.textContent = parseFloat(this.galaxyRadiusSlider.value).toFixed(1);
    }
    if (this.randomnessValue) {
      this.randomnessValue.textContent = parseFloat(this.randomnessSlider.value).toFixed(2);
    }
    if (this.bloomStrengthValue) {
      this.bloomStrengthValue.textContent = parseFloat(this.bloomStrengthSlider.value).toFixed(2);
    }
    if (this.bloomRadiusValue) {
      this.bloomRadiusValue.textContent = parseFloat(this.bloomRadiusSlider.value).toFixed(2);
    }
    if (this.bloomThresholdValue) {
      this.bloomThresholdValue.textContent = parseFloat(this.bloomThresholdSlider.value).toFixed(2);
    }
    if (this.glowIntensityValue) {
      this.glowIntensityValue.textContent = parseFloat(this.glowIntensitySlider.value).toFixed(1);
    }
    if (this.sizeMinValue) {
      this.sizeMinValue.textContent = parseFloat(this.sizeMinSlider.value).toFixed(2);
    }
    if (this.sizeMaxValue) {
      this.sizeMaxValue.textContent = parseFloat(this.sizeMaxSlider.value).toFixed(2);
    }
    if (this.brightnessMinValue) {
      this.brightnessMinValue.textContent = parseFloat(this.brightnessMinSlider.value).toFixed(2);
    }
    if (this.brightnessMaxValue) {
      this.brightnessMaxValue.textContent = parseFloat(this.brightnessMaxSlider.value).toFixed(2);
    }
    if (this.cloudRatioValue) {
      this.cloudRatioValue.textContent = (parseFloat(this.cloudRatioSlider.value) * 100).toFixed(1) + '%';
    }
    if (this.cloudHaloMultiplierValue) {
      this.cloudHaloMultiplierValue.textContent = parseFloat(this.cloudHaloMultiplierSlider.value).toFixed(1);
    }
  }

  /**
   * 设置 UI 控制
   */
  setupControls() {
    // 旋转速度控制
    if (this.rotationSpeedSlider) {
      // 设置初始值
      this.rotationSpeedSlider.value = this.rotationSpeedMultiplier;
      if (this.rotationSpeedValue) {
        this.rotationSpeedValue.textContent = this.rotationSpeedMultiplier.toFixed(2);
      }

      this.rotationSpeedSlider.addEventListener('input', (e) => {
        this.rotationSpeedMultiplier = parseFloat(e.target.value);
        if (this.rotationSpeedValue) {
          this.rotationSpeedValue.textContent = this.rotationSpeedMultiplier.toFixed(2);
        }
      });
    }

    // 粒子数量控制
    if (this.particleCountSlider) {
      this.particleCountSlider.addEventListener('input', (e) => {
        const count = parseInt(e.target.value);
        if (this.particleCountValue) {
          this.particleCountValue.textContent = count.toLocaleString();
        }
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 星系半径控制
    if (this.galaxyRadiusSlider) {
      this.galaxyRadiusSlider.addEventListener('input', (e) => {
        const radius = parseFloat(e.target.value);
        if (this.galaxyRadiusValue) {
          this.galaxyRadiusValue.textContent = radius.toFixed(1);
        }
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 随机性控制
    if (this.randomnessSlider) {
      this.randomnessSlider.addEventListener('input', (e) => {
        const randomness = parseFloat(e.target.value);
        if (this.randomnessValue) {
          this.randomnessValue.textContent = randomness.toFixed(2);
        }
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 密度分布曲线控制
    if (this.densityPowerSlider) {
      this.densityPowerSlider.addEventListener('input', (e) => {
        const densityPower = parseFloat(e.target.value);
        if (this.densityPowerValue) {
          this.densityPowerValue.textContent = densityPower.toFixed(2);
        }
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 旋转速度极值范围控制
    if (this.rotationSpeedMinSlider) {
      this.rotationSpeedMinSlider.addEventListener('input', (e) => {
        const min = parseFloat(e.target.value);
        if (document.getElementById('rotation-speed-min-value')) {
          document.getElementById('rotation-speed-min-value').textContent = min.toFixed(0);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.rotationSpeedMaxSlider) {
      this.rotationSpeedMaxSlider.addEventListener('input', (e) => {
        const max = parseFloat(e.target.value);
        if (document.getElementById('rotation-speed-max-value')) {
          document.getElementById('rotation-speed-max-value').textContent = max.toFixed(0);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 密度极值范围控制
    if (this.densityMinSlider) {
      this.densityMinSlider.addEventListener('input', (e) => {
        const min = parseFloat(e.target.value);
        if (document.getElementById('density-min-value')) {
          document.getElementById('density-min-value').textContent = min.toFixed(1);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.densityMaxSlider) {
      this.densityMaxSlider.addEventListener('input', (e) => {
        const max = parseFloat(e.target.value);
        if (document.getElementById('density-max-value')) {
          document.getElementById('density-max-value').textContent = max.toFixed(1);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 旋臂控制
    if (this.armCountSlider) {
      this.armCountSlider.addEventListener('input', (e) => {
        const count = parseInt(e.target.value);
        if (document.getElementById('arm-count-value')) {
          document.getElementById('arm-count-value').textContent = count;
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.armTightnessSlider) {
      this.armTightnessSlider.addEventListener('input', (e) => {
        const tightness = parseFloat(e.target.value);
        if (document.getElementById('arm-tightness-value')) {
          document.getElementById('arm-tightness-value').textContent = tightness.toFixed(1);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.armDensitySlider) {
      this.armDensitySlider.addEventListener('input', (e) => {
        const density = parseFloat(e.target.value);
        if (document.getElementById('arm-density-value')) {
          document.getElementById('arm-density-value').textContent = density.toFixed(1);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.armWidthSlider) {
      this.armWidthSlider.addEventListener('input', (e) => {
        const width = parseFloat(e.target.value);
        if (document.getElementById('arm-width-value')) {
          document.getElementById('arm-width-value').textContent = width.toFixed(2);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 中心颜色控制
    if (this.insideColorInput) {
      this.insideColorInput.addEventListener('input', (e) => {
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 边缘颜色控制
    if (this.outsideColorInput) {
      this.outsideColorInput.addEventListener('input', (e) => {
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 发光强度控制（实时更新，不需要重建）
    if (this.glowIntensitySlider) {
      this.glowIntensitySlider.addEventListener('input', (e) => {
        const intensity = parseFloat(e.target.value);
        if (this.glowIntensityValue) {
          this.glowIntensityValue.textContent = intensity.toFixed(1);
        }
        if (this.galaxy) {
          this.galaxy.setGlowIntensity(intensity);
        }
      });
    }

    // Bloom 参数控制（实时更新，无需重建）
    if (this.bloomStrengthSlider) {
      this.bloomStrengthSlider.addEventListener('input', (e) => {
        const strength = parseFloat(e.target.value);
        if (this.bloomStrengthValue) {
          this.bloomStrengthValue.textContent = strength.toFixed(2);
        }
        if (this.bloomPass) {
          this.bloomPass.strength = strength;
        }
      });
    }

    if (this.bloomRadiusSlider) {
      this.bloomRadiusSlider.addEventListener('input', (e) => {
        const radius = parseFloat(e.target.value);
        if (this.bloomRadiusValue) {
          this.bloomRadiusValue.textContent = radius.toFixed(2);
        }
        if (this.bloomPass) {
          this.bloomPass.radius = radius;
        }
      });
    }

    if (this.bloomThresholdSlider) {
      this.bloomThresholdSlider.addEventListener('input', (e) => {
        const threshold = parseFloat(e.target.value);
        if (this.bloomThresholdValue) {
          this.bloomThresholdValue.textContent = threshold.toFixed(2);
        }
        if (this.bloomPass) {
          this.bloomPass.threshold = threshold;
        }
      });
    }

    // 粘滞效果控制（需要重建以更新旋转速度）
    if (this.viscositySlider) {
      this.viscositySlider.addEventListener('input', (e) => {
        const viscosity = parseFloat(e.target.value);
        if (this.viscosityValue) {
          this.viscosityValue.textContent = viscosity.toFixed(2);
        }
        // 延迟重建以优化性能
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 云雾比例控制（需要重建）
    if (this.cloudRatioSlider) {
      this.cloudRatioSlider.addEventListener('input', (e) => {
        const ratio = parseFloat(e.target.value);
        if (this.cloudRatioValue) {
          this.cloudRatioValue.textContent = (ratio * 100).toFixed(1) + '%';
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 云雾光晕倍数控制（需要重建）
    if (this.cloudHaloMultiplierSlider) {
      this.cloudHaloMultiplierSlider.addEventListener('input', (e) => {
        const multiplier = parseFloat(e.target.value);
        if (this.cloudHaloMultiplierValue) {
          this.cloudHaloMultiplierValue.textContent = multiplier.toFixed(1);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 随机亮度开关控制（需要重建）
    if (this.randomBrightnessCheckbox) {
      this.randomBrightnessCheckbox.addEventListener('change', (e) => {
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 亮度范围控制（需要重建）
    if (this.brightnessMinSlider) {
      this.brightnessMinSlider.addEventListener('input', (e) => {
        const min = parseFloat(e.target.value);
        if (this.brightnessMinValue) {
          this.brightnessMinValue.textContent = min.toFixed(2);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.brightnessMaxSlider) {
      this.brightnessMaxSlider.addEventListener('input', (e) => {
        const max = parseFloat(e.target.value);
        if (this.brightnessMaxValue) {
          this.brightnessMaxValue.textContent = max.toFixed(2);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 随机大小开关控制（需要重建）
    if (this.randomSizeCheckbox) {
      this.randomSizeCheckbox.addEventListener('change', (e) => {
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 大小范围控制（需要重建）
    if (this.sizeMinSlider) {
      this.sizeMinSlider.addEventListener('input', (e) => {
        const min = parseFloat(e.target.value);
        if (this.sizeMinValue) {
          this.sizeMinValue.textContent = min.toFixed(2);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    if (this.sizeMaxSlider) {
      this.sizeMaxSlider.addEventListener('input', (e) => {
        const max = parseFloat(e.target.value);
        if (this.sizeMaxValue) {
          this.sizeMaxValue.textContent = max.toFixed(2);
        }
        clearTimeout(this.rebuildTimeout);
        this.rebuildTimeout = setTimeout(() => {
          this.createGalaxy();
        }, 300);
      });
    }

    // 旋转方向控制（实时更新，不需要重建）
    // 按钮点击事件在 HTML 的 setRotationDirection 函数中处理

    // 曲线编辑器按钮
    if (this.rotationCurveBtn) {
      this.rotationCurveBtn.addEventListener('click', () => {
        this.showCurveDialog('rotation');
      });
    }

    if (this.densityCurveBtn) {
      this.densityCurveBtn.addEventListener('click', () => {
        this.showCurveDialog('density');
      });
    }

    // 导出参数按钮
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => {
        this.exportParameters();
      });
    }

    // 导入参数按钮
    if (this.importBtn) {
      this.importBtn.addEventListener('click', () => {
        this.importFileInput.click();
      });
    }

    if (this.importFileInput) {
      this.importFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.importParameters(e.target.files[0]);
          // 清空文件输入，允许重复选择同一文件
          e.target.value = '';
        }
      });
    }

    // 重置参数按钮
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.resetParameters();
      });
    }

    // 视角预设按钮
    if (this.viewTopBtn) {
      this.viewTopBtn.addEventListener('click', () => {
        this.setCameraView('top');
        this.updateViewButtons('top');
      });
    }

    if (this.viewSideBtn) {
      this.viewSideBtn.addEventListener('click', () => {
        this.setCameraView('side');
        this.updateViewButtons('side');
      });
    }

    if (this.view45Btn) {
      this.view45Btn.addEventListener('click', () => {
        this.setCameraView('45');
        this.updateViewButtons('45');
      });
    }
  }

  /**
   * 重置所有参数到默认值
   */
  resetParameters() {
    // 使用默认参数配置重置所有参数
    const params = GalaxySimulation.DEFAULT_PARAMS;

    // 重置旋转速度
    this.rotationSpeedMultiplier = params.rotationSpeed;
    if (this.rotationSpeedSlider) {
      this.rotationSpeedSlider.value = this.rotationSpeedMultiplier;
    }
    if (this.rotationSpeedValue) {
      this.rotationSpeedValue.textContent = this.rotationSpeedMultiplier.toFixed(1);
    }

    // 重置粒子数量
    if (this.particleCountSlider) {
      this.particleCountSlider.value = params.particleCount;
    }
    if (this.particleCountValue) {
      this.particleCountValue.textContent = params.particleCount.toLocaleString();
    }

    // 重置发光强度
        if (this.glowIntensitySlider) {
          this.glowIntensitySlider.value = params.glowIntensity;
        }
        if (this.glowIntensityValue) {
          this.glowIntensityValue.textContent = params.glowIntensity.toFixed(1);
        }

        // 重置星系半径
    if (this.galaxyRadiusSlider) {
      this.galaxyRadiusSlider.value = params.galaxyRadius;
    }
    if (this.galaxyRadiusValue) {
      this.galaxyRadiusValue.textContent = params.galaxyRadius.toFixed(1);
    }

    // 重置随机性
    if (this.randomnessSlider) {
      this.randomnessSlider.value = params.randomness;
    }
    if (this.randomnessValue) {
      this.randomnessValue.textContent = params.randomness.toFixed(2);
    }

    // 重置 Bloom 参数
    if (this.bloomStrengthSlider) {
      this.bloomStrengthSlider.value = params.bloomStrength;
    }
    if (this.bloomStrengthValue) {
      this.bloomStrengthValue.textContent = params.bloomStrength.toFixed(2);
    }
    if (this.bloomRadiusSlider) {
      this.bloomRadiusSlider.value = params.bloomRadius;
    }
    if (this.bloomRadiusValue) {
      this.bloomRadiusValue.textContent = params.bloomRadius.toFixed(2);
    }
    if (this.bloomThresholdSlider) {
      this.bloomThresholdSlider.value = params.bloomThreshold;
    }
    if (this.bloomThresholdValue) {
      this.bloomThresholdValue.textContent = params.bloomThreshold.toFixed(2);
    }

    // 重置曲线编辑器（使用默认参数配置）
    if (this.rotationCurveEditor) {
      this.rotationCurveEditor.setControlPoints(params.rotationCurvePoints);
    }
    if (this.densityCurveEditor) {
      this.densityCurveEditor.setControlPoints(params.densityCurvePoints);
    }

    // 重置旋转速度极值范围
    if (this.rotationSpeedMinSlider) {
      this.rotationSpeedMinSlider.value = params.rotationSpeedMin;
    }
    if (document.getElementById('rotation-speed-min-value')) {
      document.getElementById('rotation-speed-min-value').textContent = params.rotationSpeedMin.toFixed(0);
    }
    if (this.rotationSpeedMaxSlider) {
      this.rotationSpeedMaxSlider.value = params.rotationSpeedMax;
    }
    if (document.getElementById('rotation-speed-max-value')) {
      document.getElementById('rotation-speed-max-value').textContent = params.rotationSpeedMax.toFixed(0);
    }

    // 重置密度极值范围
    if (this.densityMinSlider) {
      this.densityMinSlider.value = params.densityMin;
    }
    if (document.getElementById('density-min-value')) {
      document.getElementById('density-min-value').textContent = params.densityMin.toFixed(1);
    }
    if (this.densityMaxSlider) {
      this.densityMaxSlider.value = params.densityMax;
    }
    if (document.getElementById('density-max-value')) {
      document.getElementById('density-max-value').textContent = params.densityMax.toFixed(1);
    }

    // 重置旋臂参数
    if (this.armCountSlider) {
      this.armCountSlider.value = params.armCount;
    }
    if (document.getElementById('arm-count-value')) {
      document.getElementById('arm-count-value').textContent = params.armCount.toString();
    }
    if (this.armTightnessSlider) {
      this.armTightnessSlider.value = params.armTightness;
    }
    if (document.getElementById('arm-tightness-value')) {
      document.getElementById('arm-tightness-value').textContent = params.armTightness.toFixed(1);
    }
    if (this.armDensitySlider) {
      this.armDensitySlider.value = params.armDensity;
    }
    if (document.getElementById('arm-density-value')) {
      document.getElementById('arm-density-value').textContent = params.armDensity.toFixed(1);
    }
    if (this.armWidthSlider) {
      this.armWidthSlider.value = params.armWidth;
    }
    if (document.getElementById('arm-width-value')) {
      document.getElementById('arm-width-value').textContent = params.armWidth.toFixed(2);
    }

    // 重置粘滞效果
    if (this.viscositySlider) {
      this.viscositySlider.value = params.viscosity;
    }
    if (this.viscosityValue) {
      this.viscosityValue.textContent = params.viscosity.toFixed(2);
    }

    // 重置颜色
    if (this.insideColorInput) {
      this.insideColorInput.value = params.insideColor;
    }
    if (this.outsideColorInput) {
      this.outsideColorInput.value = params.outsideColor;
    }

    // 重置云雾和亮度参数
    if (this.cloudRatioSlider) {
      this.cloudRatioSlider.value = params.cloudRatio;
    }
    if (this.cloudRatioValue) {
      this.cloudRatioValue.textContent = (params.cloudRatio * 100).toFixed(1) + '%';
    }

    if (this.cloudHaloMultiplierSlider) {
      this.cloudHaloMultiplierSlider.value = params.cloudHaloMultiplier;
    }
    if (this.cloudHaloMultiplierValue) {
      this.cloudHaloMultiplierValue.textContent = params.cloudHaloMultiplier.toFixed(1);
    }

    if (this.randomBrightnessCheckbox) {
      this.randomBrightnessCheckbox.checked = params.randomBrightness;
    }

    if (this.brightnessMinSlider) {
      this.brightnessMinSlider.value = params.brightnessRange[0];
    }
    if (this.brightnessMinValue) {
      this.brightnessMinValue.textContent = params.brightnessRange[0].toFixed(2);
    }

    if (this.brightnessMaxSlider) {
      this.brightnessMaxSlider.value = params.brightnessRange[1];
    }
    if (this.brightnessMaxValue) {
      this.brightnessMaxValue.textContent = params.brightnessRange[1].toFixed(2);
    }

    // 重置随机大小开关
    if (this.randomSizeCheckbox) {
      this.randomSizeCheckbox.checked = params.randomSize;
    }

    // 重置大小范围
    if (this.sizeMinSlider) {
      this.sizeMinSlider.value = params.sizeRange[0];
    }
    if (this.sizeMinValue) {
      this.sizeMinValue.textContent = params.sizeRange[0].toFixed(2);
    }

    if (this.sizeMaxSlider) {
      this.sizeMaxSlider.value = params.sizeRange[1];
    }
    if (this.sizeMaxValue) {
      this.sizeMaxValue.textContent = params.sizeRange[1].toFixed(2);
    }

    // 重置旋转方向
    if (params.rotationDirection === 1) {
      if (this.rotationDirectionCwBtn) this.rotationDirectionCwBtn.classList.add('active');
      if (this.rotationDirectionCcwBtn) this.rotationDirectionCcwBtn.classList.remove('active');
    } else {
      if (this.rotationDirectionCcwBtn) this.rotationDirectionCcwBtn.classList.add('active');
      if (this.rotationDirectionCwBtn) this.rotationDirectionCwBtn.classList.remove('active');
    }

    // 重建银河系
    this.createGalaxy();
  }

  /**
   * 设置相机视角
   * @param {string} view - 视角类型：'top', 'side', '45'
   */
  setCameraView(view) {
    const distance = 15;

    switch (view) {
      case 'top':
        this.camera.position.set(0, distance, 0);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'side':
        this.camera.position.set(distance, 0, 0);
        this.camera.lookAt(0, 0, 0);
        break;
      case '45':
        this.camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
        this.camera.lookAt(0, 0, 0);
        break;
    }

    this.controls.update();
  }

  /**
   * 更新视角按钮状态
   * @param {string} activeView - 当前激活的视角
   */
  updateViewButtons(activeView) {
    [this.viewTopBtn, this.viewSideBtn, this.view45Btn].forEach(btn => {
      if (btn) {
        btn.classList.remove('active');
      }
    });

    const activeBtn = {
      'top': this.viewTopBtn,
      'side': this.viewSideBtn,
      '45': this.view45Btn
    }[activeView];

    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }

  /**
   * 窗口大小调整
   */
  onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);

    if (this.composer) {
      this.composer.setSize(width, height);
    }

    // 更新 Bloom Pass 的分辨率
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }

    // 重新初始化曲线编辑器以适应新尺寸
    if (this.rotationCurveEditor) {
      this.rotationCurveEditor.init();
    }
    if (this.densityCurveEditor) {
      this.densityCurveEditor.init();
    }
  }

  /**
   * 更新旋转速度曲线图
   */
  updateRotationCurve() {
    if (!this.rotationCurveCanvas) return;

    const canvas = this.rotationCurveCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // 设置实际像素尺寸
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 清除画布
    ctx.clearRect(0, 0, width, height);

    // 获取参数
    const rPeak = parseFloat(this.rPeakSlider?.value || 2.0);
    const rFlat = parseFloat(this.rFlatSlider?.value || 8.0);
    const vMax = parseFloat(this.vMaxSlider?.value || 220.0);
    const scale = 0.1;
    const maxRadius = 15.0; // 最大显示半径

    // 计算速度函数（与着色器中的函数一致）
    const calculateSpeed = (r) => {
      const rScaled = r / scale;
      if (rScaled < rPeak) {
        const t = Math.max(0, Math.min(1, (rScaled - 0) / (rPeak - 0)));
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        return (rScaled / rPeak * vMax * (1 - smoothT) + vMax * smoothT) * scale;
      } else if (rScaled < rFlat) {
        return vMax * scale;
      } else {
        const t = Math.max(0, Math.min(1, (rScaled - rFlat) / (rFlat * 0.5)));
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        const edgeSpeed = vMax * scale * Math.sqrt(rFlat / rScaled);
        return (vMax * scale * (1 - smoothT * 0.4) + edgeSpeed * smoothT * 0.4);
      }
    };

    // 绘制网格和坐标轴
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    // 绘制网格线
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let i = 0; i <= 5; i++) {
      const x = (width / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 绘制坐标轴
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.moveTo(0, height);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // 绘制速度曲线
    ctx.strokeStyle = '#64aaff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const points = 200;
    let maxSpeed = 0;
    const speeds = [];

    for (let i = 0; i <= points; i++) {
      const r = (maxRadius / points) * i;
      const speed = calculateSpeed(r);
      speeds.push({ r, speed });
      maxSpeed = Math.max(maxSpeed, speed);
    }

    // 绘制曲线
    for (let i = 0; i < speeds.length; i++) {
      const x = (speeds[i].r / maxRadius) * width;
      const y = height - (speeds[i].speed / maxSpeed) * height * 0.9 - height * 0.05;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 绘制关键点
    ctx.fillStyle = '#ffaa44';
    const peakR = rPeak * scale;
    const flatR = rFlat * scale;
    const peakSpeed = calculateSpeed(peakR);
    const flatSpeed = calculateSpeed(flatR);

    ctx.beginPath();
    ctx.arc((peakR / maxRadius) * width, height - (peakSpeed / maxSpeed) * height * 0.9 - height * 0.05, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc((flatR / maxRadius) * width, height - (flatSpeed / maxSpeed) * height * 0.9 - height * 0.05, 4, 0, Math.PI * 2);
    ctx.fill();

    // 绘制标签
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('距离中心 (kpc)', width / 2 - 40, height - 5);

    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('速度 (km/s)', 0, 0);
    ctx.restore();

    // 绘制数值标签
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(maxSpeed.toFixed(0), width - 5, 12);
    ctx.textAlign = 'left';
    ctx.fillText('0', 5, height - 5);
    ctx.textAlign = 'center';
    ctx.fillText(maxRadius.toFixed(1), width - 5, height - 5);
  }

  /**
   * 隐藏加载画面
   */
  hideLoadingScreen() {
    // 等待一帧确保渲染完成
    requestAnimationFrame(() => {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        // 动画完成后移除元素（可选）
        setTimeout(() => {
          if (loadingScreen.parentNode) {
            loadingScreen.parentNode.removeChild(loadingScreen);
          }
        }, 500);
      }
    });
  }

  /**
   * 动画循环
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    // 更新时间
    const deltaTime = this.clock.getDelta();
    this.elapsedTime += deltaTime * this.rotationSpeedMultiplier;

    // 更新控制器
    this.controls.update();

    // 更新银河系
    if (this.galaxy) {
      this.galaxy.update(this.elapsedTime);
    }

    // 渲染
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
  window.galaxySimulation = new GalaxySimulation();
});

/**
 * 贝塞尔曲线编辑器
 */
export class CurveEditor {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.options = {
            minX: options.minX || 0,
            maxX: options.maxX || 1,
            minY: options.minY || 0,
            maxY: options.maxY || 1,
            onUpdate: options.onUpdate || null,
            ...options
        };
        
        // 控制点（贝塞尔曲线的控制点）
        // 格式: [{x, y}, {x, y}, ...] 其中 x, y 是归一化坐标 (0-1)
        this.controlPoints = options.controlPoints || [
            { x: 0, y: 0 },
            { x: 0.3, y: 0.5 },
            { x: 0.7, y: 0.8 },
            { x: 1, y: 1 }
        ];
        
        this.selectedPoint = null;
        this.isDragging = false;
        
        this.init();
    }
    
    init() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.width = rect.width;
        this.height = rect.height;
        
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        this.draw();
    }
    
    // 将屏幕坐标转换为归一化坐标
    screenToNormalized(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const localX = x - rect.left;
        const localY = y - rect.top;
        return {
            x: Math.max(0, Math.min(1, localX / this.width)),
            y: Math.max(0, Math.min(1, 1 - localY / this.height)) // Y轴翻转
        };
    }
    
    // 将归一化坐标转换为屏幕坐标
    normalizedToScreen(x, y) {
        return {
            x: x * this.width,
            y: (1 - y) * this.height // Y轴翻转
        };
    }
    
    // 找到最近的控制点
    findNearestPoint(x, y) {
        const point = this.screenToNormalized(x, y);
        let minDist = Infinity;
        let nearest = null;
        
        for (let i = 0; i < this.controlPoints.length; i++) {
            const p = this.controlPoints[i];
            const screenP = this.normalizedToScreen(p.x, p.y);
            const screenPoint = this.screenToNormalized(x, y);
            const screenPointPos = this.normalizedToScreen(screenPoint.x, screenPoint.y);
            
            const dist = Math.sqrt(
                Math.pow(screenP.x - screenPointPos.x, 2) + 
                Math.pow(screenP.y - screenPointPos.y, 2)
            );
            
            if (dist < 15 && dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        }
        
        return nearest;
    }
    
    onMouseDown(e) {
        const nearest = this.findNearestPoint(e.clientX, e.clientY);
        if (nearest !== null) {
            this.selectedPoint = nearest;
            this.isDragging = true;
        }
    }
    
    onMouseMove(e) {
        if (this.isDragging && this.selectedPoint !== null) {
            const point = this.screenToNormalized(e.clientX, e.clientY);
            // 保持第一个和最后一个点的X坐标固定
            if (this.selectedPoint === 0) {
                point.x = 0;
            } else if (this.selectedPoint === this.controlPoints.length - 1) {
                point.x = 1;
            }
            this.controlPoints[this.selectedPoint] = point;
            this.draw();
            if (this.options.onUpdate) {
                this.options.onUpdate(this.getCurve());
            }
        }
    }
    
    onMouseUp(e) {
        this.isDragging = false;
        this.selectedPoint = null;
    }
    
    // 计算贝塞尔曲线上的点
    bezierPoint(t, points) {
        const n = points.length - 1;
        let x = 0, y = 0;
        
        for (let i = 0; i <= n; i++) {
            const binom = this.binomialCoefficient(n, i);
            const term = binom * Math.pow(1 - t, n - i) * Math.pow(t, i);
            x += points[i].x * term;
            y += points[i].y * term;
        }
        
        return { x, y };
    }
    
    binomialCoefficient(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        
        let result = 1;
        for (let i = 0; i < k; i++) {
            result = result * (n - i) / (i + 1);
        }
        return result;
    }
    
    // 获取曲线值（根据输入x返回y）
    getCurve() {
        return (x) => {
            // 确保输入值有效
            if (isNaN(x) || x < 0 || x > 1) {
                return 0;
            }
            
            // 使用贝塞尔曲线计算y值
            const t = Math.max(0, Math.min(1, x));
            const point = this.bezierPoint(t, this.controlPoints);
            
            // 确保返回值有效
            if (isNaN(point.y)) {
                return 0;
            }
            
            return Math.max(0, Math.min(1, point.y));
        };
    }
    
    draw() {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // 清除画布
        ctx.clearRect(0, 0, width, height);
        
        // 绘制背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
        
        // 绘制网格
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
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
        
        // 绘制贝塞尔曲线
        ctx.strokeStyle = '#64aaff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = this.bezierPoint(t, this.controlPoints);
            const screenPoint = this.normalizedToScreen(point.x, point.y);
            
            if (i === 0) {
                ctx.moveTo(screenPoint.x, screenPoint.y);
            } else {
                ctx.lineTo(screenPoint.x, screenPoint.y);
            }
        }
        ctx.stroke();
        
        // 绘制控制点
        for (let i = 0; i < this.controlPoints.length; i++) {
            const point = this.controlPoints[i];
            const screenPoint = this.normalizedToScreen(point.x, point.y);
            
            ctx.fillStyle = i === this.selectedPoint ? '#88ccff' : '#64aaff';
            ctx.beginPath();
            ctx.arc(screenPoint.x, screenPoint.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // 绘制标签
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('距离', width / 2, height - 5);
        
        ctx.save();
        ctx.translate(10, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('值', 0, 0);
        ctx.restore();
    }
    
    // 设置控制点
    setControlPoints(points) {
        this.controlPoints = points;
        this.draw();
    }
    
    // 获取控制点
    getControlPoints() {
        return this.controlPoints;
    }
}

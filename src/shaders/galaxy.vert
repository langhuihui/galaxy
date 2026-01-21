uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;

attribute float size;
attribute float distance;
attribute float angle;
attribute float rotationSpeed;
attribute vec3 color;

varying vec3 vColor;
varying float vDistance;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // 计算当前角度（根据旋转速度）
    // rotationSpeed 已经包含了符合天文观测的旋转曲线计算
    float currentAngle = angle + uTime * rotationSpeed * 0.001;
    
    // 重新计算位置（保持半径不变）
    float radius = distance;
    modelPosition.x = cos(currentAngle) * radius;
    modelPosition.z = sin(currentAngle) * radius;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;
    
    // 根据距离调整大小（距离越远越小）
    float distanceFactor = 1.0 - (distance / 5.0) * 0.5;
    gl_PointSize = size * uSize * uPixelRatio * distanceFactor;
    gl_PointSize *= (1.0 / -viewPosition.z);

    vColor = color;
    vDistance = distance;
}

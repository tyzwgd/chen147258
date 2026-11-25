# 3주차 실습 보고서

- 이름: 유락진
- 학번: 202421936
- 과목: 컴퓨터그래픽스

## 실습 1 — 바닥 위에 떠서 도는 공

- 실행 페이지: [task1.html](task1.html)
- GitHub Pages 주소: (실제 공개 주소 입력)

### 행렬 곱셈 순서 비교

`T * R`은 회전을 먼저 적용한 뒤 이동시키므로 공이 자신의 중심을 기준으로 회전하면서 바닥 위에 떠 있다. `R * T`는 이동을 먼저 적용한 뒤 회전시키므로 이동 벡터까지 회전하여 공의 중심 위치가 달라진다.

- 1번 키 (T * R): ![기본 순서](images/task1-tr.png)
- 2번 키 (R * T): ![반대 순서](images/task1-rt.png)

### 깊이 테스트와 셰이더 변경

`gl.enable(gl.DEPTH_TEST)`는 화면에서 카메라에 가까운 면이 뒤쪽 면을 가리도록 한다. D 키로 켜고 끌 수 있다. 깊이 테스트를 끄면 그리는 순서에 따라 뒤쪽의 면이 앞쪽의 면을 덮을 수 있어 올바른 가림 관계가 깨질 수 있다. 4번 키로 법선 벡터를 RGB 색으로 변환하는 셰이더를 선택할 수 있다. 법선 값의 범위인 -1~1을 0~1로 바꾸는 식은 `N * 0.5 + 0.5`이다. 구는 표면 방향이 연속적으로 변하여 여러 색이 나타나지만 상자의 각 평면은 법선 방향이 일정하다.

```glsl
fragColor = vec4(N * 0.5 + 0.5, 1.0);
```

![법선 색상](images/task1-normal.png)

### 코드의 여섯 부분

1. 메시 데이터: 구와 바닥의 정점 위치, 법선, 색상 및 인덱스를 생성한다.
2. 버텍스 셰이더: 모델 행렬과 뷰·투영 행렬을 이용하여 정점 위치를 변환하고 법선과 색상을 전달한다.
3. 프래그먼트 셰이더: 보간된 법선과 빛의 방향을 이용해 픽셀의 색과 밝기를 계산한다.
4. WebGL 준비: WebGL2 컨텍스트를 얻고 셰이더를 컴파일하여 프로그램을 연결한다.
5. 버퍼 준비: 정점 데이터와 인덱스를 GPU에 전송하고 VAO에 속성 설정을 저장한다.
6. 렌더링: 화면 크기와 시간, 행렬을 갱신하고 바닥과 구를 매 프레임 그린다.

## 실습 2 및 3 — 살아 있는 행성

- [얼음과 오로라 행성](task2.html) — GitHub Pages 주소: (실제 공개 주소 입력)
- [용암 행성](task3.html) — GitHub Pages 주소: (실제 공개 주소 입력)

### 1. 의도 — 무엇을 만들고 싶은가?

얼음과 오로라가 있는 차가운 행성과 붉은 용암이 흐르는 뜨거운 행성을 표현하는 것이 목표이다. 파란색과 보라색으로 신비롭고 차가운 느낌을, 빨간색과 주황색으로 뜨겁고 역동적인 느낌을 전달하고자 하였다. 수업에서 다룬 기본 줄무늬와 극지방 색상 표현을 응용하되, Task 2에서는 휘어진 얼음 균열과 보라색 오로라를 결합하였다. Task 3에서는 어두운 암석과 밝은 용암의 대비를 이용하고 시간에 따라 용암의 색이 달라지도록 설계하였다. 이미지 텍스처 없이 프래그먼트 셰이더의 수식으로 표면을 표현하였다.

### 2. 방법 — 어떻게 만들었는가?

구의 분할 수는 64와 128로 설정하였다. 버텍스 셰이더에서 `vSurf = aNormal`로 물체 기준 표면 방향을 전달하여 무늬가 행성과 함께 회전하도록 하였다. `normalize`와 `dot`으로 빛과 법선 사이의 관계를 계산하고, `max(dot(N,L),0.0)`으로 낮과 밤의 밝기 차이를 만들었다. `uTime`을 이용하여 오로라와 용암의 밝기 및 색이 시간에 따라 변화하도록 하였다.

#### 얼음 균열

```glsl
float field=sin(15.0*S.x+2.4*sin(8.0*S.y))+sin(17.0*S.z-2.1*sin(7.0*S.x));
float crack=1.0-smoothstep(0.035,0.18,abs(field));
```

서로 다른 방향의 사인파를 합쳐 휘어진 무늬를 만든다. `abs(field)`가 0에 가까운 곳을 균열로 선택한다. `smoothstep`은 균열의 경계를 부드럽게 하고, `1.0-`을 적용하여 균열 부분이 밝게 표시되도록 한다.

#### 오로라

```glsl
float ribbon=sin(18.0*S.x+12.0*S.z+uTime*1.3);
float aurora=smoothstep(0.44,0.75,abs(S.y))*(1.0-smoothstep(0.82,0.98,abs(S.y)))*(0.35+0.65*smoothstep(-0.5,0.8,ribbon));
```

`abs(S.y)`를 사용하여 높은 위도의 특정 범위에 오로라를 제한한다. 사인 함수에 `uTime`을 더해 띠의 밝은 부분이 시간에 따라 변하도록 한다. 오로라 값에 보라색 계열의 색을 곱하여 얼음 표면의 색과 합친다.

#### 용암

```glsl
float f=sin(12.0*S.x+3.0*sin(9.0*S.z))+sin(14.0*S.y+2.0*sin(8.0*S.x));
float lava=1.0-smoothstep(0.10,0.38,abs(f));
float pulse=0.5+0.5*sin(uTime*2.2+8.0*S.y+6.0*S.z);
```

두 사인파를 결합하고 0에 가까운 부분을 용암의 균열로 선택한다. `pulse`는 시간과 위치에 따라 0~1 사이에서 변화한다. 이 값을 `mix`에 사용하여 용암의 색이 붉은색에서 밝은 주황색 계열로 바뀌도록 한다.

#### 암석 표면 (Task 3)

```glsl
float rockPattern=0.5+0.5*sin(38.0*S.x)*sin(35.0*S.y)*sin(33.0*S.z);
vec3 rock=mix(vec3(0.12,0.045,0.035),vec3(0.38,0.15,0.08),rockPattern);
```

세 방향의 높은 주파수 사인파를 곱하여 암석 표면에 작은 색상 변화를 만든다. `rockPattern`을 0~1 범위로 변환한 후 `mix`를 이용해 어두운 갈색과 밝은 갈색 사이의 색을 계산한다. 밝은 용암과 어두운 암석의 대비를 통해 뜨거운 행성의 표면을 표현한다.

#### 극지방 얼음 (Task 2)

```glsl
float polar=smoothstep(0.55,0.95,abs(S.y));
vec3 ice=mix(vec3(0.06,0.23,0.48),vec3(0.58,0.85,0.98),polar);
```

`abs(S.y)` 값이 커질수록 구의 양극에 가까워진다. `smoothstep`으로 위도에 따른 변화량을 부드럽게 계산하고, `mix`를 사용해 진한 파란색과 밝은 얼음색을 섞는다. 따라서 극지방은 적도 부근보다 밝은 얼음색을 갖는다.

### 3. 문제 및 해결

처음에는 HTML 파일을 다운로드하거나 여는 데 어려움이 있었다. 다시 파일을 열어 확인한 결과 세 개의 HTML 파일을 모두 실행할 수 있었다. 다운로드 오류의 정확한 원인은 확인하지 못했다.

코드 수정에는 AI의 도움을 받았으며 실행 결과는 브라우저에서 확인하였다.

### 4. 실행 결과

![얼음과 오로라 행성](images/task2.png)

![용암 행성](images/task3.png)

### 5. 전체 프래그먼트 셰이더 코드

#### Task 1

```glsl
#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vSurf;
uniform float uTime;
uniform int uMode;
out vec4 fragColor;
void main() {
  vec3 N=normalize(vNormal);
  vec3 L=normalize(vec3(0.5,1.0,0.7));
  float d=max(dot(N,L),0.0);
  // 물체 기준 줄무늬로 회전을 관찰한다.
  float mark=smoothstep(0.94,0.98,normalize(vSurf).x);
  vec3 lit=vColor*(0.25+0.75*d)*(1.0-0.30*mark);
  // 4번 키: 8단계 법선을 색으로 바꾸는 셰이더.
  if(uMode==1) fragColor=vec4(N*0.5+0.5,1.0);
  else fragColor=vec4(lit,1.0);
}
```

#### Task 2

```glsl
#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vSurf;
uniform float uTime;
out vec4 fragColor;
void main() {
  vec3 S=normalize(vSurf); // 무늬는 물체와 함께 회전
  vec3 N=normalize(vNormal);
  vec3 L=normalize(vec3(-0.6,0.7,1.0));
  float d=max(dot(N,L),0.0);
  // 위도에 따라 푸른 얼음과 밝은 극지방을 섞는다.
  float polar=smoothstep(0.55,0.95,abs(S.y));
  vec3 ice=mix(vec3(0.06,0.23,0.48),vec3(0.58,0.85,0.98),polar);
  // 여러 방향의 사인파를 섞어 얼음의 굽은 균열을 만든다.
  float field=sin(15.0*S.x+2.4*sin(8.0*S.y))+sin(17.0*S.z-2.1*sin(7.0*S.x));
  float crack=1.0-smoothstep(0.035,0.18,abs(field));
  // 극지방의 보라색 오로라가 시간에 따라 밝아진다.
  float ribbon=sin(18.0*S.x+12.0*S.z+uTime*1.3);
  float aurora=smoothstep(0.44,0.75,abs(S.y))*(1.0-smoothstep(0.82,0.98,abs(S.y)))*(0.35+0.65*smoothstep(-0.5,0.8,ribbon));
  vec3 color=(ice+crack*vec3(0.18,0.45,0.55))*(0.12+0.88*d);
  color+=aurora*vec3(0.33,0.10,0.65)*(0.35+0.65*d);
  color+=crack*vec3(0.03,0.12,0.18)*(0.5+0.5*sin(uTime*1.6));
  fragColor=vec4(color,1.0);
}
```

#### Task 3

```glsl
#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vSurf;
uniform float uTime;
out vec4 fragColor;
void main() {
  vec3 S=normalize(vSurf);
  vec3 N=normalize(vNormal);
  vec3 L=normalize(vec3(-0.6,0.7,1.0));
  float d=max(dot(N,L),0.0);
  // 휘어진 사인파의 경계에서 용암이 흐른다.
  float f=sin(12.0*S.x+3.0*sin(9.0*S.z))+sin(14.0*S.y+2.0*sin(8.0*S.x));
  float lava=1.0-smoothstep(0.10,0.38,abs(f));
  float rockPattern=0.5+0.5*sin(38.0*S.x)*sin(35.0*S.y)*sin(33.0*S.z);
  vec3 rock=mix(vec3(0.12,0.045,0.035),vec3(0.38,0.15,0.08),rockPattern);
  // 시간과 위치가 용암의 밝기와 색을 바꾼다.
  float pulse=0.5+0.5*sin(uTime*2.2+8.0*S.y+6.0*S.z);
  vec3 hot=mix(vec3(0.85,0.10,0.015),vec3(1.0,0.70,0.08),pulse);
  vec3 color=rock*(0.10+0.90*d)+lava*hot*(0.32+0.68*d);
  fragColor=vec4(color,1.0);
}
```

## 실습을 통해 배운 점

행렬 곱셈의 순서와 깊이 테스트가 3차원 물체의 위치 및 가림 관계에 영향을 준다는 점을 이해하였다. 또한 프래그먼트 셰이더에서 좌표, 법선, 시간 변수와 수학 함수를 이용하면 외부 이미지 없이도 서로 다른 행성의 표면과 동적인 색상 효과를 표현할 수 있다는 점을 배웠다.

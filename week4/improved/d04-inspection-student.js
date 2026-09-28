/* 학생 확장: 복합 연구시설 관찰 지원 인터페이스 (개선 버전)
   설계 방향
   - 사용자/목표 : 시설을 처음 보는 점검자가 여섯 장치(P1~P6)의 정보와
     두 구조 비교(O1·O2)를 빠짐없이 확인한다.
   - 선택한 방식 : ① 중요 지점 순회(버튼 한 번으로 읽기 좋은 위치로 이동)
                  ② O1 전면 직교 / O2 오른쪽 측면 직교(같은 배율, 기준선)
                  ③ 진행 상태 패널(완료 체크 8건 + 카운트 + 전체 복귀)
   - 기본 트랙볼 조작은 그대로 유지. 개선은 카메라/뷰/UI 레벨에서 추가.
*/
(function () {
  'use strict';
  const viewer = window.InspectionViewer;
  if (!viewer) return;
  const controls = viewer.controls, model = viewer.model;
  const M = window.D.M4;

  /* ---- vector / quaternion helpers (same convention as controls) ---- */
  function normalize(v) {
    const n = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function quatFromTo(from, to) {            // quaternion rotating +z onto the sign normal
    from = normalize(from); to = normalize(to);
    const d = from[0]*to[0] + from[1]*to[1] + from[2]*to[2];
    if (d > 0.99999) return [0, 0, 0, 1];
    if (d < -0.99999) { const ax = normalize(cross(from, [1, 0, 0])); return [ax[0], ax[1], ax[2], 0]; }
    const axis = normalize(cross(from, to)), w = Math.sqrt((1 + d) / 2), s = Math.sqrt(1 - w * w);
    return [axis[0]*s, axis[1]*s, axis[2]*s, w];
  }

  /* ---- 상태 ---- */
  let mode = 'tour';                 // 'tour' | 'o1' | 'o2'
  const POI = {};                    // id -> camera 설정
  model.poi.forEach(p => { POI[p.id] = p; });
  const done = {};                   // id -> true/false (진행 체크)
  model.tasks.forEach(t => done[t.id] = false);

  /* ---- 명판을 읽을 수 있는 위치로 카메라 이동 ----
     명판은 평면 법선이 rotateY(yaw)로 향한다. eye는 명판 앞(법선 방향)에 두고,
     target은 명판 중심. 거리 d는 명판 세로 크기에 비례해 읽을 수 있게 정한다. */
  function goToPoi(id) {
    const p = POI[id];
    if (!p) return;
    const n = normalize([Math.sin(p.yaw || 0), 0, Math.cos(p.yaw || 0)]);
    const H = Math.max(p.size[1] || 0.2, 0.2);
    let d = H * 5.5;
    d = Math.max(1.2, Math.min(30, d));
    controls.state.target = [...p.position];
    controls.state.rotation = quatFromTo([0, 0, 1], n);
    controls.state.distance = d;
    controls.state.fov = 45;
    setMode('tour', id);
  }

  /* ---- 직교 뷰 프레이밍 (전면/측면, 같은 배율) ----
     halfHeight를 세로 폭과 가로 폭을 동시에 담도록 aspect에 맞춰 계산한다. */
  function orthoCam(center, dir, spanH, spanV, w, h) {
    const aspect = w / Math.max(1, h);
    const half = Math.max(spanV / 2, spanH / (2 * aspect));
    const dist = 40;
    return {
      eye: [center[0] + dir[0]*dist, center[1] + dir[1]*dist, center[2] + dir[2]*dist],
      target: [...center], up: [0, 1, 0],
      orthographic: true, halfHeight: half, near: 0.02, far: 200,
    };
  }
  const O1 = { center: [-4.7, 1.75, 6], dir: [0, 0, 1], spanH: 4.6, spanV: 3.5 }; // 전면: +z에서 -z, up +y
  const O2 = { center: [10.8, 4.5, -0.3], dir: [1, 0, 0], spanH: 3.5, spanV: 2.4 }; // 오른쪽 측면: +x에서 -x, up +y

  /* ---- 기준선 오버레이 (직교 뷰에서 비교를 돕는다) ---- */
  const viewportEl = document.querySelector('.viewport');
  const refLine = document.getElementById('ref-line');
  const modeTag = document.getElementById('mode-tag');
  function updateOverlay(ndc) {
    refLine.innerHTML = '';
    modeTag.textContent = ndc.tag || '';
    (ndc.lines || []).forEach(l => {
      const el = document.createElement('div');
      el.className = 'rl';
      if (l.axis === 'h') { el.style.cssText = `left:0;right:0;top:${((1 - l.v) / 2) * 100}%;height:2px;`; }
      else { el.style.cssText = `top:0;bottom:0;left:${((l.v + 1) / 2) * 100}%;width:2px;`; }
      refLine.appendChild(el);
      if (l.label) {
        const lb = document.createElement('div');
        lb.className = 'rlabel';
        lb.textContent = l.label;
        if (l.axis === 'h') lb.style.cssText = `left:6px;top:${Math.max(0, ((1 - l.v) / 2) * 100 - 3)}%;`;
        else lb.style.cssText = `top:6px;left:${Math.max(0, ((l.v + 1) / 2) * 100 + 2)}%;`;
        refLine.appendChild(lb);
      }
    });
  }
  function clearOverlay() { refLine.innerHTML = ''; modeTag.textContent = ''; }

  function setMode(m, poiId) {
    mode = m;
    if (m === 'tour') clearOverlay();
  }

  /* ---- 진행 상태 UI ---- */
  function buildUI() {
    const host = document.getElementById('student-ui');
    host.innerHTML = '';
    // 1) 빠른 이동: 지점 순회 + 직교 비교
    const sec1 = document.createElement('div');
    sec1.innerHTML = '<div class="su-section">1 · 빠른 이동</div>';
    const row1 = document.createElement('div'); row1.className = 'su-row';
    const tourIds = model.poi.map(p => p.id);
    tourIds.forEach(id => {
      const b = document.createElement('button'); b.className = 'su-btn'; b.textContent = id + ' 이동';
      b.onclick = () => goToPoi(id); row1.appendChild(b);
    });
    sec1.appendChild(row1);
    const row1b = document.createElement('div'); row1b.className = 'su-row';
    const bO1 = document.createElement('button'); bO1.className = 'su-btn'; bO1.textContent = 'O1 전면 직교';
    bO1.onclick = () => setMode('o1');
    const bO2 = document.createElement('button'); bO2.className = 'su-btn'; bO2.textContent = 'O2 측면 직교';
    bO2.onclick = () => setMode('o2');
    row1b.appendChild(bO1); row1b.appendChild(bO2);
    sec1.appendChild(row1b);
    host.appendChild(sec1);

    // 2) 진행 상태
    const sec2 = document.createElement('div');
    sec2.innerHTML = '<div class="su-section">2 · 관찰 진행 (완료 체크)</div>';
    const box = document.createElement('div');
    model.tasks.forEach(t => {
      const lab = document.createElement('label'); lab.className = 'su-check';
      const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = false;
      inp.onchange = () => { done[t.id] = inp.checked; updateProgress(); };
      const sp = document.createElement('span'); sp.textContent = `${t.id} ${t.name}`;
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
    });
    const reset = document.createElement('button'); reset.className = 'su-btn'; reset.style.cssText = 'flex:1;margin-top:6px';
    reset.textContent = '모두 초기화';
    reset.onclick = () => {
      box.querySelectorAll('input').forEach(i => { i.checked = false; done[i.dataset.tid] = false; });
      updateProgress();
    };
    box.querySelectorAll('input').forEach(i => i.dataset.tid = i.closest('label').textContent.split(' ')[0]);
    sec2.appendChild(box); sec2.appendChild(reset);
    host.appendChild(sec2);

    // 3) 상태/카메라 읽기
    const st = document.createElement('div'); st.className = 'su-status'; st.id = 'su-status';
    host.appendChild(st);
  }
  function updateProgress() {
    const n = model.tasks.filter(t => done[t.id]).length;
    const st = document.getElementById('su-status');
    st.textContent = `완료 ${n} / ${model.tasks.length}\n현재 모드: ${mode === 'o1' ? 'O1 전면 직교' : mode === 'o2' ? 'O2 측면 직교' : '원근 (자유 트랙볼)'}`;
  }

  /* ---- 커스텀 렌더: 원근/직교 분기 + 기준선 ---- */
  viewer.render = function (v) {
    const W = v.canvas.width, H = v.canvas.height;
    if (mode === 'o1') {
      const cam = orthoCam(O1.center, O1.dir, O1.spanH, O1.spanV, W, H);
      v.drawView(cam, [0, 0, W, H]);
      const half = cam.halfHeight, aspect = W / Math.max(1, H);
      // 기준선: 두 패널의 위쪽 모서리(y=3.4)와 바닥(y=1.8)
      const topNdc = (3.4 - O1.center[1]) / half;
      const botNdc = (1.8 - O1.center[1]) / half;
      updateOverlay({ tag: 'O1 · 전면 직교 (+z→−z)', lines: [
        { axis: 'h', v: topNdc, label: '상단 y=3.4' },
        { axis: 'h', v: botNdc, label: '하단 y=1.8' },
      ]});
    } else if (mode === 'o2') {
      const cam = orthoCam(O2.center, O2.dir, O2.spanH, O2.spanV, W, H);
      v.drawView(cam, [0, 0, W, H]);
      const half = cam.halfHeight, aspect = W / Math.max(1, H);
      // 기준선: 전면(+z) 끝 비교 — o2-a 전면 z=+1, o2-b 전면 z=+0.4
      const aNdc = (1 - O2.center[2]) / (half * aspect);
      const bNdc = (0.4 - O2.center[2]) / (half * aspect);
      updateOverlay({ tag: 'O2 · 오른쪽 측면 직교 (+x→−x)', lines: [
        { axis: 'v', v: aNdc, label: 'A 전면 z=+1' },
        { axis: 'v', v: bNdc, label: 'B 전면 z=+0.4' },
      ]});
    } else {
      v.drawView(controls.camera(), [0, 0, W, H]);
      clearOverlay();
    }
    updateProgress();
  };

  /* ---- 초기화 ---- */
  // 기본 '전체 보기' 버튼도 직교/순회 모드를 원근(자유)으로 되돌린다
  const homeBtn = document.getElementById('home');
  if (homeBtn) homeBtn.addEventListener('click', () => setMode('tour'));
  buildUI();
  updateProgress();
  // ?mode=o1|o2|P1..P6 스크린샷/검증용 진입 모드
  const qMode = new URLSearchParams(location.search).get('mode');
  if (qMode) {
    if (qMode === 'o1') setMode('o1');
    else if (qMode === 'o2') setMode('o2');
    else if (POI[qMode]) goToPoi(qMode);
  }
})();

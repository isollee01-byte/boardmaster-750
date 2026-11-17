// The sleeve is the flat spray-can design. Can shape, metal rims, rotation, and zoom stay as they are.
(() => {
  const canvas = document.querySelector('#can-viewer');
  const controls = document.querySelector('.can-controls');
  const fallback = document.querySelector('.product-can');
  const zoomLabel = document.querySelector('#can-zoom-level');
  const zoomIn = document.querySelector('#can-zoom-in');
  const zoomOut = document.querySelector('#can-zoom-out');
  const note = document.querySelector('.illustration-note');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) return;
  const initialRotation = [Math.sin(.05), 0, 0, Math.cos(.05)];
  let rotation = [...initialRotation], zoom = 1, pan = 0, ready = false, frame = 0;
  const pointers = new Map();
  // Virtual trackball: rotate around the drag's actual screen-space axis.
  // A normalized quaternion allows diagonal turns without gimbal lock.
  function applyRotation(delta) {
    const [x,y,z,w] = delta, [a,b,c,d] = rotation;
    const next = [w*a+x*d+y*c-z*b, w*b-x*c+y*d+z*a,
      w*c+x*b-y*a+z*d, w*d-x*a-y*b-z*c];
    const length = Math.hypot(...next);
    rotation = next.map(value => value / length);
  }
  function trackball(point) {
    const rect = canvas.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * .48);
    const x = (point.x - rect.left - rect.width / 2) / radius;
    const y = (rect.top + rect.height / 2 - point.y) / radius;
    const z = Math.sqrt(Math.max(0, 1 - x*x - y*y));
    const length = Math.hypot(x,y,z);
    return [x/length,y/length,z/length];
  }
  function dragRotation(from, to) {
    const [ax,ay,az] = trackball(from), [bx,by,bz] = trackball(to);
    let delta = [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx, 1+ax*bx+ay*by+az*bz];
    if (delta[3] < 1e-6) delta = Math.abs(ax)<.9 ? [0,-az,ay,0] : [-ay,ax,0,0];
    const length = Math.hypot(...delta);
    applyRotation(delta.map(value=>value/length));
  }
  function rotateAxis(x,y,z,angle) {
    const sine = Math.sin(angle/2);
    applyRotation([x*sine,y*sine,z*sine,Math.cos(angle/2)]);
  }
  function rotationMatrix() {
    const [x,y,z,w] = rotation;
    return new Float32Array([
      1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w),
      2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w),
      2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y)
    ]);
  }
  const fail = () => {
    ready = false;
    canvas.hidden = true; controls.hidden = true; fallback.hidden = false;
    note.textContent = '실물 사진 기반 AI 보정 이미지입니다.';
  };
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  try {
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
      uniform mat3 rotation; uniform float aspect; uniform float zoom; uniform float pan;
      varying vec3 n; varying vec2 tex;
      void main(){
        vec3 p=rotation*position;
        n=rotation*normal; tex=uv;
        float fit=min(1.,aspect/.34);
        gl_Position=vec4(p.x*zoom*fit/(3.40*aspect),(p.y*zoom+pan)*fit/3.40,-p.z/10.,1.);
      }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform sampler2D label; uniform float material;
      varying vec3 n; varying vec2 tex;
      void main(){
        vec3 N=normalize(n);
        vec3 light=normalize(vec3(-.5,.65,1.));
        float diffuse=max(dot(N,light),0.);
        float shine=pow(max(dot(reflect(-light,N),vec3(0.,0.,1.)),0.),85.);
        vec3 color;
        if(material<.5){
          vec3 ink=texture2D(label,vec2(tex.x,.004+tex.y*.992)).rgb;
          float facing=max(N.z,0.);
          float streak=pow(facing,10.)*smoothstep(.22,0.,abs(N.x-.04));
          color=ink*(.9+.1*diffuse)+vec3(.92,.93,.95)*streak*.07;
        } else if(material<1.5){
          float facing=max(N.z,0.);
          float streak=pow(facing,9.);
          float spec=pow(max(dot(reflect(-light,N),vec3(0.,0.,1.)),0.),32.);
          vec3 alum=vec3(.80,.81,.83);
          color=alum*(.22+.95*diffuse)+vec3(streak*.42+spec*.72);
          color=mix(color,color*vec3(.45,.47,.50),pow(1.-facing,2.)*.7);
        } else {
          color=vec3(.025,.027,.030)+vec3(diffuse*.045+shine*.055);
        }
        gl_FragColor=vec4(color,1.);
      }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('3D program failed');
    gl.useProgram(program); gl.enable(gl.DEPTH_TEST);
    const meshes = [];
    function addMesh(vertices, material) {
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      meshes.push({ buffer, count: vertices.length / 8, material });
    }
    function lathe(profile, material, smooth = false) {
      const vertices = [], segments = 192;
      for (let j = 0; j < profile.length - 1; j++) {
        const [y0, r0] = profile[j], [y1, r1] = profile[j + 1];
        const dy = y1 - y0, dr = r1 - r0, length = Math.hypot(dy, dr) || 1;
        const vertex = (k, top) => {
          const t = k / segments, a = (t - .5) * Math.PI * 2;
          const y = top ? y1 : y0, r = top ? r1 : r0;
          let radial = dy/length, vertical = -dr/length;
          if (smooth) {
            const at = j + (top ? 1 : 0);
            const before = profile[Math.max(0,at-1)], after = profile[Math.min(profile.length-1,at+1)];
            const span = Math.hypot(after[0]-before[0],after[1]-before[1]) || 1;
            radial=(after[0]-before[0])/span; vertical=(before[1]-after[1])/span;
          }
          vertices.push(Math.sin(a)*r, y, Math.cos(a)*r,
            Math.sin(a)*radial, vertical, Math.cos(a)*radial, t, (2.30-y)/5.05);
        };
        for (let i = 0; i < segments; i++) {
          vertex(i,false); vertex(i+1,false); vertex(i,true);
          vertex(i,true); vertex(i+1,false); vertex(i+1,true);
        }
      }
      addMesh(vertices, material);
    }
    // Photo references: straight 750 mL body, shallow rolled rims, rounded
    // shoulder and a broad threaded black collar with three moulded lugs.
    // Body / full-height ratio follows the supplied real can, not a spray-paint cap.
    lathe([[-2.75,.70],[2.30,.70]], 0);
    lathe([[-2.82,0],[-2.82,.63],[-2.81,.69],[-2.79,.718],[-2.76,.726],
      [-2.73,.720],[-2.71,.70]],1,true);
    lathe([[2.29,.70],[2.30,.719],[2.32,.731],[2.35,.731],[2.37,.719],[2.38,.70]],1,true);
    // A smooth, low dome, with a visible flat crimp around its perimeter.
    lathe([[2.37,.695],[2.40,.692],[2.44,.678],[2.49,.651],[2.54,.613],
      [2.59,.565],[2.63,.512],[2.67,.445],[2.70,.363],[2.715,.29],[2.72,0]],1,true);
    lathe([[2.66,.325],[2.69,.37],[2.72,.425],[2.75,.435],[2.78,.425],
      [2.80,.355],[3.09,.355],[3.11,.348],[3.12,.31],[3.12,.27],[2.96,.27],[2.96,0]],2);
    // One continuous helical thread replaces the previous separate circular rings.
    function thread() {
      const vertices=[], turns=3.6, steps=Math.ceil(192*turns);
      const section=[[-.019,.355],[-.008,.395],[.008,.395],[.019,.355]];
      const vertex=(step,side,segment)=>{
        const a=step/192*Math.PI*2;
        const [dy,r]=section[side];
        const [dy0,r0]=section[segment], [dy1,r1]=section[segment+1];
        const length=Math.hypot(dy1-dy0,r1-r0);
        vertices.push(Math.sin(a)*r,2.81+step/192*.078+dy,Math.cos(a)*r,
          Math.sin(a)*(dy1-dy0)/length,-(r1-r0)/length,Math.cos(a)*(dy1-dy0)/length,0,0);
      };
      for(let i=0;i<steps;i++)for(let s=0;s<section.length-1;s++){
        vertex(i,s,s);vertex(i+1,s,s);vertex(i,s+1,s);
        vertex(i,s+1,s);vertex(i+1,s,s);vertex(i+1,s+1,s);
      }
      addMesh(vertices,2);
    }
    thread();
    // Narrow upper lip and recessed dark centre, matching the photographed valve.
    lathe([[3.10,.35],[3.12,.377],[3.15,.377],[3.16,.35],[3.16,.27],
      [3.13,.26],[2.98,.26],[2.98,0]],2,true);
    // Bevelled radial wings with chamfered corners, rather than rectangular blocks.
    function tab(rotation) {
      const vertices = [], c = Math.cos(rotation), s = Math.sin(rotation);
      const outline=[[-.105,.34],[.105,.34],[.13,.53],[.095,.585],[-.095,.585],[-.13,.53]];
      function point(x,y,z,nx,ny,nz){vertices.push(c*x+s*z,y,-s*x+c*z,c*nx+s*nz,ny,-s*nx+c*nz,0,0);}
      for(const [y,scale,ny] of [[2.68,1,-1],[2.79,.92,1]])for(let i=1;i<outline.length-1;i++){
        for(const index of [0,i,i+1]){const [x,z]=outline[index];point(x*scale,y,z*scale,0,ny,0);}
      }
      for(let i=0;i<outline.length;i++){
        const [x0,z0]=outline[i], [x1,z1]=outline[(i+1)%outline.length];
        const length=Math.hypot(x1-x0,z1-z0), nx=(z1-z0)/length, nz=-(x1-x0)/length;
        const points=[[x0,2.68,z0],[x1,2.68,z1],[x0*.92,2.79,z0*.92],[x1*.92,2.79,z1*.92]];
        for(const j of [0,1,2,2,1,3])point(...points[j],nx,.08,nz);
      }
      addMesh(vertices,2);
    }
    for (let i=0; i<3; i++) tab(.35+i*Math.PI*2/3);
    const attributes = [['position',3,0],['normal',3,12],['uv',2,24]]
      .map(([name,size,offset]) => [gl.getAttribLocation(program,name),size,offset]);
    const uniforms = Object.fromEntries(['rotation','aspect','zoom','pan','material'].map(name=>[name,gl.getUniformLocation(program,name)]));
    function render() {
      frame = 0;
      if (!ready) return;
      const ratio = Math.min(Math.max(devicePixelRatio || 1, 2), 3);
      const width = Math.max(1,Math.round(canvas.clientWidth*ratio)), height = Math.max(1,Math.round(canvas.clientHeight*ratio));
      if (canvas.width!==width || canvas.height!==height) { canvas.width=width; canvas.height=height; }
      gl.viewport(0,0,width,height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix3fv(uniforms.rotation,false,rotationMatrix()); gl.uniform1f(uniforms.aspect,width/height);
      gl.uniform1f(uniforms.zoom,zoom); gl.uniform1f(uniforms.pan,pan);
      for (const mesh of meshes) {
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
        for (const [location,size,offset] of attributes) {
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset);
        }
        gl.uniform1f(uniforms.material,mesh.material); gl.drawArrays(gl.TRIANGLES,0,mesh.count);
      }
    }
    function schedule() { if (!frame) frame=requestAnimationFrame(render); }
    function setZoom(value) {
      zoom = Math.max(1,Math.min(4,value));
      const limit = 3.1*(zoom-1); pan = Math.max(-limit,Math.min(limit,pan));
      zoomLabel.value = `${Math.round(zoom*100)}%`; zoomLabel.textContent = zoomLabel.value;
      zoomOut.disabled = zoom <= 1; zoomIn.disabled = zoom >= 4; schedule();
    }
    const image = new Image();
    image.onload = () => {
      if (image.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || image.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) { fail(); return; }
      const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      for (const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
      for (const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);
      ready=true; canvas.hidden=false; fallback.hidden=true; controls.hidden=false;
      note.textContent='보드마스터 750 미리보기'; setZoom(1);
    };
    image.onerror = fail; image.src='assets/can-label.png';
    zoomIn.addEventListener('click',()=>setZoom(zoom+.25));
    zoomOut.addEventListener('click',()=>setZoom(zoom-.25));
    canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.0015));},{passive:false});
    const distance = () => {const [a,b]=[...pointers.values()]; return Math.hypot(a.x-b.x,a.y-b.y);};
    canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{
      const old=pointers.get(e.pointerId); if(!old) return;
      if(pointers.size===2){
        const before=distance(); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(before>0)setZoom(zoom*distance()/before);
        const limit=3.1*(zoom-1);
        pan=Math.max(-limit,Math.min(limit,pan-(e.clientY-old.y)*3.4/canvas.clientHeight));
        schedule();
      } else {
        if(e.shiftKey && zoom>1){
          pan-=(e.clientY-old.y)*6.8/canvas.clientHeight;
          const limit=3.1*(zoom-1);pan=Math.max(-limit,Math.min(limit,pan));
        } else dragRotation(old,{x:e.clientX,y:e.clientY});
        pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});schedule();
      }
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
    canvas.addEventListener('keydown',e=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))e.preventDefault();
      else return;
      if(e.key==='ArrowLeft'||e.key==='ArrowRight')rotateAxis(0,1,0,(e.key==='ArrowRight'?1:-1)*.15);
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        if(e.shiftKey){pan+=(e.key==='ArrowUp'?-1:1)*.3;const limit=3.1*(zoom-1);pan=Math.max(-limit,Math.min(limit,pan));}
        else rotateAxis(1,0,0,(e.key==='ArrowDown'?1:-1)*.15);
      }
      if(e.key==='+'||e.key==='=')setZoom(zoom+.25);
      if(e.key==='-')setZoom(zoom-.25);
      if(e.key==='Home'){rotation=[...initialRotation];pan=0;setZoom(1);}schedule();
    });
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});
    new ResizeObserver(schedule).observe(canvas);
  } catch(error) { fail();console.warn('제품 3D 미리보기를 사용할 수 없습니다.',error); }
})();

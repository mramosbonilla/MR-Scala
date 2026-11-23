"use strict";
const $ = id => document.getElementById(id);
const layers = {
  "Proyecto": ["Pendiente", "Contorno"],
  "Entorno": ["Infraestructura", "Calles", "Andenes", "Jardines"],
  "Estructura": ["Columnas", "Muros"],
  "Aperturas y cerramientos": ["Puertas", "Ventanas"],
  "Muebles fijos": ["Baños", "Cocina", "Clósets"],
  "Muebles móviles": ["Sofás", "Sillas", "Mesas", "Camas"],
  "Equipamiento": ["Electrodomésticos", "Vegetación", "Accesorios", "Vehículos", "Personas"]
};
const category = Object.values(layers).flat();
const catalog = {
  Sofá: ["Sofás", 2.1, .9, .85], Silla: ["Sillas", .5, .5, .85],
  Mesa: ["Mesas", 1.4, .8, .75], Inodoro: ["Baños", .38, .68, .75],
  Nevera: ["Electrodomésticos", .75, .72, 1.8],
  Clóset: ["Clósets", 1.4, .6, 2.1], Árbol: ["Vegetación", 1.5, 1.5, 2.5],
  Tapete: ["Accesorios", 1.6, 1.6, .02], Auto: ["Vehículos", 1.85, 4.4, 1.5],
  Persona: ["Personas", .45, .45, 1.7]
};
// Per-piece preview height (metres) and reusable 3D form.
const fixtures={
  Baños:{
    Lavamanos:[.85,"basin"],"Mesón de baño con lavamanos":[.9,"sinkCounter"],
    Sanitario:[.8,"toilet"],Ducha:[2,"shower"],Tina:[.55,"tub"],
    Espejo:[.75,"screen"],Toallero:[.12,"shelf"],"Mueble de baño":[.85,"cabinet"]
  },
  Cocina:{
    "Mesón de cocina con lavaplatos":[.9,"sinkCounter"],"Mesón de cocina sin lavaplatos":[.9,"counter"],
    "Isla de cocina":[.9,"counter"],"Gabinete de cocina":[.85,"cabinet"],"Repisa de cocina":[.06,"shelf"]
  },
  Electrodomésticos:{
    Nevera:[1.8,"fridge"],Horno:[.6,"oven"],Televisor:[.65,"screen"],
    Microondas:[.32,"oven"],"Estufa":[.85,"stove"],Lavadora:[.85,"washer"],
    Secadora:[.85,"washer"],"Lavavajillas":[.85,"oven"],Campana:[.3,"cabinet"]
  },
  Sofás:{Sofá:[.85,"sofa"],Sillón:[.85,"sofa"],"Sofá en L":[.85,"sectional"],Puf:[.45,"pouf"]},
  Sillas:{Silla:[.85,"chair"],Banco:[.55,"table"],Taburete:[.7,"table"]},
  Mesas:{
    "Mesa de comedor":[.75,"table"],"Mesa auxiliar":[.55,"table"],"Mesita de noche":[.55,"cabinet"],
    "Mesa redonda":[.75,"roundTable"],Escritorio:[.75,"table"],Mesa:[.75,"table"]
  },
  Camas:{Cama:[.95,"bed"],"Cama individual":[.95,"bed"],"Cama doble":[.95,"bed"],"Cama queen":[.95,"bed"],"Cama king":[.95,"bed"]},
  "Clósets":{"Clóset":[2.1,"cabinet"],Armario:[2.1,"cabinet"],Cómoda:[.85,"cabinet"],Estantería:[1.8,"shelves"]},
  Vegetación:{Matera:[.7,"plant"],"Planta de interior":[1.2,"plant"],Árbol:[2.5,"plant"]},
  Accesorios:{Adorno:[.24,"decor"],Jarrón:[.35,"decor"],Lámpara:[1.4,"lamp"],Cuadro:[.6,"picture"],Tapete:[.02,"rug"],Repisa:[.06,"shelf"]}
};
const color = {
  Pendiente:"#a96913",Contorno:"#657986",Columnas:"#192737",Muros:"#243c52",
  Puertas:"#a45729",Ventanas:"#167dac",Vegetación:"#37773d",Jardines:"#6c8b39"
};
const ink = layer => color[layer] || "#68558d";
const id = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
const clone = data => JSON.parse(JSON.stringify(data));
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const structural = e => ["Columnas","Muros"].includes(e.layer);
const opening = e => ["Puertas","Ventanas"].includes(e.layer);
const rect = (x,y,w,d) => [{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}];
const level = (name="Planta baja") => ({id:id(),name,sources:[],elements:[],measures:[],height:null,pitch:null,coverage:false,approved:null});
const blank = () => ({version:1,title:"Proyecto sin título",block:"Bloque A",active:0,levels:[level()]});
function demo() {
  const p = blank(), l = p.levels[0];
  p.title = "Estudio de muestra";
  l.height = 3; l.coverage = true;
  const elem = (name,layer,points,height=null,base=0,host=null) => ({id:id(),name,layer,points,height,base,host,status:"confirmed",kind:"area"});
  l.elements = [
    elem("Perímetro didáctico","Contorno",rect(0,0,800,540)),
    elem("Muro norte","Muros",rect(0,0,800,20)),
    elem("Muro sur","Muros",rect(0,520,800,20)),
    elem("Muro oeste","Muros",rect(0,20,20,500)),
    elem("Muro este","Muros",rect(780,20,20,500)),
    elem("División interior","Muros",rect(460,20,20,500)),
    elem("Sofá","Sofás",rect(65,70,180,77),.85),
    elem("Mesa","Mesas",rect(575,160,125,75),.76)
  ];
  l.elements.push(elem("Puerta interior","Puertas",rect(460,295,20,96),2.1,0,l.elements[5].id));
  l.elements.push(elem("Ventana norte","Ventanas",rect(200,0,180,20),1.15,1,l.elements[1].id));
  l.measures = [[{x:0,y:0},{x:800,y:0},8],[{x:0,y:0},{x:0,y:540},5.4]];
  l.approved = new Date().toISOString();
  return p;
}
let reviewHits = [];
let marked = new Set();
let snappedWalls=[];
let wallImageCache=null;
let project = demo(), view = "review", activeLayer = "Muros", selected = null, tool = "select";
let sourceIndex = 0, reference = null, sourceToken = 0, sourcePurpose = "Planta";
let startProjectFromPlan = false;
let drawing = [], transient = null, camera = {x:0,y:0,scale:1}, drag = null, scene = null;
let eye = null, yaw = 0, orbit = -.65;
const canvas = $("canvas"), pen = canvas.getContext("2d");
const current = () => project.levels[project.active];
const element = () => current().elements.find(e => e.id === selected);
const live = l => l.elements.filter(e => e.status !== "excluded");
const notify = text => {
  $("state").textContent = text;
  $("traceMissing").hidden=true;
};
const numeric = el => el.value === "" ? null : el.valueAsNumber;
function scaleInfo(l) {
  const values = l.measures.map(([a,b,m])=>m/distance(a,b));
  if (values.length < 2 || values.some(v=>!positive(v))) return {factor:null,spread:null};
  const factor = values.reduce((sum,v)=>sum+v,0)/values.length;
  const spread = (Math.max(...values)-Math.min(...values))/factor;
  return {factor:spread<=.03 ? factor : null,spread};
}
function scaleSummary(l) {
  const count=l.measures.length;
  const {factor,spread}=scaleInfo(l);
  if(factor)return count+" cotas registradas · Escala calculada.";
  if(spread!==null)return count+" cotas registradas · Diferencia del "+(spread*100).toLocaleString("es",{maximumFractionDigits:1})+
    " % (máximo 3 %). Puedes proponer muros y revisar la escala después.";
  if(count<2)return count===1?"1 cota registrada · Falta una para calcular la escala.":
    "Sin cotas · Puedes proponer muros y medir después.";
  return count+" cotas registradas · Revisa los extremos de las medidas para calcular la escala.";
}
function rasterWallBands(inkPixels,width,height,metresPerPixel,vertical) {
  const rows=vertical?width:height, columns=vertical?height:width;
  const span=Math.max(width,height);
  const minLength=Math.max(9,Math.ceil(metresPerPixel ? .70/metresPerPixel : span*.025));
  const minThickness=Math.max(2,Math.ceil(metresPerPixel ? .075/metresPerPixel : span*.0025));
  const maxThickness=Math.max(minThickness,Math.floor(metresPerPixel ? .55/metresPerPixel : span*.035));
  const output=[];
  let bands=[];
  function finish(b) {
    const thickness=b.bottom-b.top, length=b.end-b.start;
    if(thickness<minThickness||thickness>maxThickness||length<minLength||length<thickness*3)return;
    output.push(vertical
      ? {x:b.top,y:b.start,w:thickness,h:length}
      : {x:b.start,y:b.top,w:length,h:thickness});
  }
  for(let row=0;row<rows;row++){
    const next=[];
    let start=0;
    for(let column=0;column<=columns;column++){
      const dark=column<columns&&inkPixels[vertical?column*width+row:row*width+column];
      if(dark)continue;
      if(column-start>=minLength){
        const match=bands.find(b=>!b.used&&
          Math.min(b.end,column)-Math.max(b.start,start)>=.72*Math.max(b.end-b.start,column-start));
        if(match){
          match.used=true;
          next.push({start:Math.max(match.start,start),end:Math.min(match.end,column),top:match.top,bottom:row+1});
        }else next.push({start,end:column,top:row,bottom:row+1});
      }
      start=column+1;
    }
    bands.filter(b=>!b.used).forEach(finish);
    bands=next;
  }
  bands.forEach(finish);
  return output;
}
function detectImageWalls(image,factor) {
  const limit=1500;
  const down=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
  const raster=document.createElement("canvas");
  raster.width=Math.max(1,Math.round(image.naturalWidth*down));
  raster.height=Math.max(1,Math.round(image.naturalHeight*down));
  const ctx=raster.getContext("2d",{willReadFrequently:true});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,raster.width,raster.height);
  ctx.drawImage(image,0,0,raster.width,raster.height);
  const {width,height}=raster;
  const imagePixels=ctx.getImageData(0,0,width,height).data;
  const inkPixels=new Uint8Array(width*height);
  for(let i=0;i<inkPixels.length;i++){
    const offset=i*4;
    inkPixels[i]=.2126*imagePixels[offset]+.7152*imagePixels[offset+1]+.0722*imagePixels[offset+2]<115;
  }
  const sx=image.naturalWidth/width,sy=image.naturalHeight/height;
  return [false,true].flatMap(vertical=>rasterWallBands(inkPixels,width,height,factor/down,vertical))
    .map(b=>rect(b.x*sx,b.y*sy,b.w*sx,b.h*sy));
}
function overlapsWall(points,other) {
  const a=bounds(points),b=bounds(other);
  const w=Math.min(a.right,b.right)-Math.max(a.x,b.x);
  const h=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
  return w>0&&h>0&&w*h>=.75*(a.right-a.x)*(a.bottom-a.y);
}
function bounds(points) {
  return {x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),
    right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
}
function inside(p, points) {
  let hit = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i], b=points[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) hit=!hit;
  }
  return hit;
}
function area(points) {
  return Math.abs(points.reduce((sum,p,i)=>{
    const q=points[(i+1)%points.length];return sum+p.x*q.y-p.y*q.x;
  },0))/2;
}
function wallAxes(wall) {
  const [a,b,c,d]=wall.points;
  if (!d || wall.points.length!==4) return null;
  const horizontal=distance(a,b)>=distance(b,c);
  const start=a, along=horizontal?b:d, across=horizontal?d:b;
  const length=distance(start,along), depth=distance(start,across);
  if (!length || !depth) return null;
  const u={x:(along.x-a.x)/length,y:(along.y-a.y)/length};
  const v={x:(across.x-a.x)/depth,y:(across.y-a.y)/depth};
  if (Math.abs(u.x*v.x+u.y*v.y)>.015 || distance(c,{x:along.x+across.x-a.x,y:along.y+across.y-a.y})>Math.max(length,depth)*.015) return null;
  return {start,u,v,length,depth};
}
function holeRange(e,wall) {
  const axes=wallAxes(wall);
  if (!axes) return null;
  const {start,u,v,depth,length}=axes;
  const coord=e.points.map(p=>({x:(p.x-start.x)*u.x+(p.y-start.y)*u.y,y:(p.x-start.x)*v.x+(p.y-start.y)*v.y}));
  const b=bounds(coord), slack=Math.max(.0001,depth*.15);
  if (b.y>slack || b.bottom<depth-slack || b.x<-.01*length || b.right>1.01*length ||
      b.right-b.x<=0 || (b.bottom-b.y)*(b.right-b.x)-area(coord)>area(coord)*.05) return null;
  return [Math.max(0,b.x),Math.min(length,b.right)];
}
function checks(l) {
  const elements=live(l), contours=elements.filter(e=>e.layer==="Contorno" && e.kind==="area");
  const plan=[];
  if (!scaleInfo(l).factor) plan.push("Calibra con dos cotas compatibles (tolerancia del 3 %).");
  if (!l.coverage) plan.push("Confirma que revisaste la lámina completa.");
  if (!contours.length) plan.push("Traza y confirma un contorno de suelo.");
  if (!elements.some(e=>e.layer==="Muros" && e.kind==="area")) plan.push("Traza los muros como superficies.");
  if (elements.some(e=>e.status!=="confirmed" || e.layer==="Pendiente")) plan.push("Resuelve los elementos pendientes.");
  if (elements.some(e=>e.kind==="line" && (structural(e)||(opening(e)&&!(e.layer==="Puertas"&&e.swing))||e.layer==="Contorno"))) plan.push("Usa superficies para estructura, contorno y vanos.");
  const model=[];
  if (!positive(l.height)) model.push("Indica la altura libre.");
  if(elements.some(e=>e.reviewSymbol)) model.push("Los símbolos CAD sirven para clasificar. Dibuja la huella física antes de usarla en 3D.");
  const apertures=elements.filter(e=>opening(e)&&!e.reviewSymbol);
  for (const e of apertures) {
    if(e.layer==="Puertas"&&e.swing&&e.kind==="line"){
      model.push(e.name+" · selecciona la puerta y define la profundidad del vano.");
      continue;
    }
    const wall=elements.find(w=>w.id===e.host && w.layer==="Muros");
    if (!wall || !holeRange(e,wall)) model.push(e.name+" · el vano debe cruzar un tramo rectangular de su muro.");
    if (!positive(e.height) || e.base===null || e.base<0 || e.base+e.height>l.height+1e-9) model.push(e.name+" · revisa la altura y la base.");
    if (e.layer==="Puertas" && e.base!==0) model.push(e.name+" · la puerta debe comenzar en el piso.");
  }
  for (const e of elements.filter(e=>e.kind==="area" && !e.reviewSymbol && !structural(e) && !opening(e) && !["Contorno","Infraestructura","Calles","Andenes","Jardines"].includes(e.layer))) {
    if (!positive(e.height) || e.base===null || e.base<0 || e.base+e.height>l.height+1e-9) model.push(e.name+" · indica una altura y base dentro del espacio.");
  }
  return {plan,model};
}
function invalidate(l=current()) { l.approved=null;scene=null;saveLocal(); }
function option(parent,text,value) { const opt=new Option(text,value);parent.add(opt); }
function wallStrip(a,b,c) {
  const length=distance(a,b);
  if(!positive(length))return null;
  const normal={x:(a.y-b.y)/length,y:(b.x-a.x)/length};
  const width=(c.x-a.x)*normal.x+(c.y-a.y)*normal.y;
  if(Math.abs(width)<.00001)return null;
  const dx=normal.x*width,dy=normal.y*width;
  return [a,b,{x:b.x+dx,y:b.y+dy},{x:a.x+dx,y:a.y+dy}];
}
function diagonalRectangle(a,b) {
  if(Math.abs(a.x-b.x)<1e-5||Math.abs(a.y-b.y)<1e-5)return null;
  return rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));
}
function overlappingWallUnit(seeds,level=current()) {
  const unit=new Set([...seeds].filter(Boolean));
  if(!unit.size)return unit;
  const walls=live(level).filter(e=>e.layer==="Muros"&&e.kind==="area"&&wallAxes(e));
  const queue=walls.filter(e=>unit.has(e.id));
  for(const wall of queue){
    for(const other of walls){
      if(unit.has(other.id))continue;
      const axes=[wallAxes(wall),wallAxes(other)].flatMap(a=>[a.u,a.v]);
      const overlap=axes.every(axis=>{
        const span=e=>e.points.map(p=>p.x*axis.x+p.y*axis.y);
        const a=span(wall),b=span(other);
        return Math.min(Math.max(...a),Math.max(...b))-Math.max(Math.min(...a),Math.min(...b))>1e-5;
      });
      if(overlap){unit.add(other.id);queue.push(other);}
    }
  }
  return unit;
}
let fixtureDraft=null, wallRemoval=null;
let doorDraft=null, windowDraft=null, doorDirection=1, doorDepthId=null;
let closedDoorId=null;
const precisionTools=new Set(["door","window","fixture","wallRectangle","wallStrip","line","area"]);
function draftPoint(raw) {
  const a=drawing.at(-1);
  const nearAxis=a&&Math.min(Math.abs(raw.x-a.x),Math.abs(raw.y-a.y))*camera.scale<=12;
  const restrict=a&&$("orthoDraft").checked&&((tool==="area"&&nearAxis)||
    (drawing.length===1&&["door","wallStrip","line"].includes(tool)));
  const axis=restrict?(Math.abs(raw.x-a.x)>=Math.abs(raw.y-a.y)?"y":"x"):null;
  let point=axis?{...raw,[axis]:a[axis]}:raw;
  if(!$("cornerDraft").checked)return point;
  let best=10/camera.scale;
  for(const e of live(current())){
    if(e.layer!=="Muros"&&e.layer!=="Columnas")continue;
    for(const corner of e.points){
      if(axis&&Math.abs(corner[axis]-a[axis])>1e-5)continue;
      if(drawing.some(q=>distance(q,corner)<1e-5))continue;
      const gap=distance(point,corner);
      if(gap<best){best=gap;raw=corner;}
    }
  }
  return best<10/camera.scale?raw:point;
}
function draftSwing([hinge,latch]) {
  return {hinge,latch,delta:doorDirection*Math.PI/2};
}
function openingHost(points) {
  const matches=live(current()).filter(w=>w.layer==="Muros"&&holeRange({points},w));
  if(matches.length===1)return matches[0].id;
  return null;
}
function doorFootprint(swing,edge) {
  return wallStrip(swing.hinge,swing.latch,edge);
}
function doorOnWall(swing,level) {
  const matches=[];
  for(const wall of live(level)){
    if(wall.layer!=="Muros"||!wallAxes(wall))continue;
    const axes=wallAxes(wall);
    const offset=p=>(p.x-axes.start.x)*axes.v.x+(p.y-axes.start.y)*axes.v.y;
    const near=(offset(swing.hinge)+offset(swing.latch))/2;
    if(Math.abs(near-Math.max(0,Math.min(axes.depth,near)))>axes.depth*.15)continue;
    if(Math.min(Math.abs(near),Math.abs(near-axes.depth))>axes.depth*.15)continue;
    const edge={x:swing.hinge.x+axes.v.x*(near<axes.depth/2?axes.depth:-axes.depth),
      y:swing.hinge.y+axes.v.y*(near<axes.depth/2?axes.depth:-axes.depth)};
    const points=doorFootprint(swing,edge);
    if(points&&holeRange({points},wall))matches.push({points,host:wall.id,swing});
  }
  return matches.length===1?matches[0]:null;
}
function updateReviewGuide() {
  const guide=$("reviewGuide");
  const emptyLayer=!live(current()).some(e=>e.layer===activeLayer);
  const reviewingWalls=activeLayer==="Muros"&&view==="review";
  const wall=element();
  $("wallSelect").hidden=!reviewingWalls;
  $("wallSelect").setAttribute("aria-pressed",tool==="wallSelect");
  $("wallRemove").hidden=!reviewingWalls||!["select","wallSelect"].includes(tool)||wall?.layer!=="Muros"||wall.status==="excluded";
  $("wallUndo").hidden=!reviewingWalls||wallRemoval?.level!==current()||wallRemoval.wall.status!=="excluded";
  const types=fixtures[activeLayer];
  $("fixtureBar").hidden=!types||view!=="review";
  if(types&&$("fixtureType").dataset.layer!==activeLayer){
    const choices=$("fixtureType");
    choices.replaceChildren();
    for(const name of Object.keys(types))option(choices,name,name);
    choices.dataset.layer=activeLayer;
  }
  $("fixtureTrace").textContent=tool==="fixture"?"Reiniciar trazado":"Marcar en el plano";
  $("fixtureAccept").hidden=tool!=="fixture"||!fixtureDraft;
  $("fixtureAccept").textContent="Añadir "+$("fixtureType").value;
  $("wallRectangle").hidden=activeLayer!=="Muros"||view!=="review";
  $("wallRectangle").textContent=tool==="wallRectangle"?"Reiniciar rectángulo":"Rectángulo";
  $("doorTrace").hidden=activeLayer!=="Puertas"||view!=="review";
  $("doorTrace").textContent=tool==="door"?"Reiniciar puerta":"Trazar puerta abatible";
  $("windowTrace").hidden=activeLayer!=="Ventanas"||view!=="review";
  $("windowTrace").textContent=tool==="window"?"Reiniciar ventana":"Trazar ventana";
  $("windowAccept").hidden=tool!=="window"||!windowDraft;
  $("doorFlip").hidden=tool!=="door"||drawing.length<2;
  $("doorAccept").hidden=tool!=="door"||drawing.length!==2||Boolean(doorDepthId&&!doorDraft);
  $("doorAccept").textContent=doorDepthId?"Guardar profundidad":"Añadir puerta";
  $("traceInLayer").hidden=["Puertas","Ventanas"].includes(activeLayer)&&tool!=="area";
  const selectedDoor=element();
  $("doorDepth").hidden=view!=="review"||tool!=="select"||selectedDoor?.layer!=="Puertas"||!selectedDoor?.swing||selectedDoor.kind!=="line";
  $("doorToggle").hidden=view!=="review"||tool!=="select"||selectedDoor?.layer!=="Puertas"||!selectedDoor?.swing;
  $("doorToggle").textContent=closedDoorId===selectedDoor?.id?"Abrir hoja":"Cerrar hoja";
  $("wallTrace").hidden=activeLayer!=="Muros"||view!=="review";
  $("wallTrace").textContent=tool==="wallStrip"?"Reiniciar tramo":"Trazar tramo de muro";
  guide.hidden=!(view==="review"&&(tool==="area"||tool==="wallStrip"||tool==="wallRectangle"||tool==="door"||tool==="window"||tool==="fixture"||tool==="wallSelect"||tool==="select"));
  if(guide.hidden)return;
  if(tool==="wallSelect"){
    guide.textContent=wall?.layer==="Muros"?"Muro resaltado. Pulsa Eliminar muro si quieres quitarlo.":
      "Toca el muro que quieres seleccionar.";
  }else if(tool==="fixture"){
    guide.textContent=fixtureDraft?"Revisa el contorno y pulsa Añadir.":drawing.length?
      "2 de 2 · Toca la esquina diagonal opuesta.":"1 de 2 · Toca una esquina de la pieza.";
  }else if(tool==="select"&&types&&!element()){
    guide.textContent="Elige la pieza y pulsa Marcar en el plano.";
  }else if(tool==="wallRectangle"){
    guide.textContent=snappedWalls.length?"Si el rectángulo coincide con el muro, pulsa Añadir a Muros.":
      drawing.length?"Toca la esquina opuesta en diagonal.":"Toca una esquina del muro pequeño.";
  }else if(tool==="window"){
    guide.textContent=windowDraft?"2 de 2 · Revisa el rectángulo y pulsa Añadir ventana.":
      drawing.length?"2 de 2 · Toca la esquina diagonal del otro lado del muro.":
      "1 de 2 · Toca una esquina de la ventana sobre una cara del muro.";
  }else if(tool==="door"){
    guide.textContent=doorDepthId?(doorDraft?"Pulsa Guardar profundidad.":"Toca la cara opuesta del muro, a la altura del vano."):
      drawing.length===2?"Revisa el arco y pulsa Añadir puerta. Puedes invertir el giro.":
      drawing.length?"Toca el otro extremo sobre ese mismo borde para ver el arco.":"Toca el vértice del vano donde va la bisagra.";
  }else if(tool==="select"&&activeLayer==="Ventanas"&&!element()){
    guide.textContent="Pulsa Trazar ventana y marca dos esquinas opuestas en diagonal.";
  }else if(tool==="wallStrip"){
    guide.textContent=snappedWalls.length?"Revisa el tramo y pulsa Añadir a Muros.":[
      "Toca el inicio de uno de los bordes largos del muro.",
      "Toca el otro extremo sobre ese mismo borde.",
      "Toca el borde opuesto para marcar el grosor."
    ][drawing.length];
  }else if(tool==="area"){
    const count=drawing.length;
    guide.textContent=count===0?"Toca la primera esquina de un tramo.":
      count<3?"Esquinas marcadas: "+count+". Sigue el borde del tramo.":
      "Esquinas marcadas: "+count+". Termina el contorno y pulsa Cerrar superficie.";
  }else{
    const e=element();
    if(e){
      guide.textContent=e.layer===activeLayer
        ? "Esta pieza está en "+activeLayer+". Si pertenece a otra capa, usa Reasignar a otra capa."
        : "Esta pieza está en "+e.layer+". Usa Añadir a "+activeLayer+" si pertenece a la capa que revisas.";
    }else if(emptyLayer){
      guide.textContent="No hay elementos asignados a "+activeLayer+". Si falta alguno, selecciónalo en el plano y asígnalo aquí. Si solo está dibujado en la imagen, toca Trazar en "+activeLayer+".";
    }else{
      guide.textContent="Las piezas de "+activeLayer+" están en azul. Puedes reasignarlas o añadir las que falten. Cuando termines de revisar, pulsa Confirmar capa si quedan propuestas.";
    }
  }
}
function refresh() {
  const l=current(), e=element();
  const reviewingPlant=view==="review" && (!l.sources[sourceIndex]||l.sources[sourceIndex].kind==="Planta");
  $("layerReview").hidden=!reviewingPlant;
  $("snapReview").hidden=!reviewingPlant||!snappedWalls.length;
  $("snapCount").textContent=["wallRectangle","wallStrip"].includes(tool)?"Tramo listo para revisar":snappedWalls.length===1?"1 tramo detectado en la imagen":snappedWalls.length+" tramos detectados en la imagen";
  $("excludedLabel").hidden=!reviewingPlant||!l.elements.some(e=>e.layer===activeLayer&&e.status==="excluded");
  const imagePlan=reviewingPlant&&Boolean(reference)&&l.sources[sourceIndex]?.kind==="Planta"&&
    sourceIndex===l.sources.findIndex(source=>source.kind==="Planta");
  $("wallProposalPanel").hidden=!imagePlan;
  $("proposalScale").textContent=scaleSummary(l);
  updateReviewGuide();
  $("reviewLayer").value=activeLayer;
  const pieces=live(l).filter(item=>item.layer===activeLayer);
  const layerCount=pieces.length;
  const confirmed=pieces.filter(item=>item.status==="confirmed").length;
  $("reviewLayerCount").textContent=layerCount
    ? layerCount+(layerCount===1?" pieza":" piezas")+" · "+confirmed+(confirmed===1?" confirmada":" confirmadas")
    : "Capa vacía";
  const waiting=pieces.filter(item=>item.status==="proposed").length;
  $("confirmReviewLayer").hidden=activeLayer==="Pendiente"||waiting===0;
  $("confirmReviewLayer").textContent="Confirmar capa · "+waiting+(waiting===1?" propuesta":" propuestas");
  $("layerLegend").hidden=!layerCount;
  $("layerPiecesLabel").hidden=!layerCount;
  const list=$("layerPieces");
  list.replaceChildren();
  option(list,"Elige una pieza para ubicarla","");
  pieces.forEach((item,i)=>option(list,(i+1)+". "+item.name+(item.status==="confirmed"?" · confirmada":""),item.id));
  list.value=pieces.some(item=>item.id===selected)?selected:"";
  if(marked.size){
    const unit=overlappingWallUnit(marked,l);
    for(const id of unit)marked.add(id);
  }
  const grouped=marked.size>0;
  $("groupSelection").hidden=!reviewingPlant||!grouped;
  $("groupCount").textContent=marked.size===1?"1 pieza seleccionada":marked.size+" piezas seleccionadas";
  $("groupDestination").value=activeLayer;
  $("reviewSelection").hidden=!e||grouped;
  $("traceInLayer").textContent=tool==="area"?"Cerrar superficie":"Trazar en "+activeLayer;
  $("reviewCandidate").replaceChildren();
  if(e) {
    const choices=l.elements.filter(item=>item===e||reviewHits.includes(item.id));
    for(const item of choices) option($("reviewCandidate"),item.name+" · "+item.layer+(item.status==="excluded"?" (excluido)":item.reviewSymbol?" (símbolo CAD)":""),item.id);
    $("reviewCandidate").value=e.id;
    $("reviewDestination").value=e.layer;
    $("addToLayer").textContent="Añadir a "+activeLayer;
    $("addToLayer").hidden=e.layer===activeLayer;
    $("excludeLayerPiece").hidden=e.status==="excluded";
    $("confirmLayerPiece").hidden=e.layer!==activeLayer||e.layer==="Pendiente"||e.status!=="proposed";
    $("removeFromLayer").hidden=e.layer!==activeLayer||e.layer==="Pendiente"||e.status==="excluded";
  }
  $("title").value=project.title; $("block").value=project.block;
  $("levels").replaceChildren();project.levels.forEach((item,i)=>option($("levels"),item.name,i));$("levels").value=project.active;
  $("sources").replaceChildren();option($("sources"),"Sin lámina",-1);
  l.sources.forEach((src,i)=>option($("sources"),src.kind+" · "+src.name,i));$("sources").value=l.sources.length ? sourceIndex : -1;
  $("selection").hidden=!e;
  if(e) {
    $("elementName").value=e.name; $("elementLayer").value=e.layer;
    $("height").value=e.height??""; $("base").value=e.base??"";
    $("hostLabel").hidden=!opening(e);
    $("host").replaceChildren();option($("host"),"Selecciona el muro","");
    live(l).filter(w=>w.layer==="Muros").forEach(w=>option($("host"),w.name,w.id));
    $("host").value=e.host??"";
    $("approveElement").textContent=e.status==="confirmed" ? "Confirmado" : "Confirmar elemento";
    $("remove").textContent=e.status==="excluded" ? "Restaurar elemento" : "Excluir elemento";
  }
  $("clearHeight").value=l.height??"";$("pitch").value=l.pitch??"";$("coverage").checked=l.coverage;
  const {factor,spread}=scaleInfo(l);
  $("measures").textContent=l.measures.map((m,i)=>`Cota ${i+1} · ${m[2]} m`).concat(
    factor ? `Diferencia entre cotas · ${(spread*100).toFixed(1)} %` : spread===null ? "Marca 2 o 3 distancias conocidas." : `Cotas incompatibles · ${(spread*100).toFixed(1)} %`
  ).join("\n");
  const {plan,model}=checks(l);
  $("issues").textContent=[l.approved ? "Planta validada" : "Planta en revisión",...plan,...model].join("\n");
  $("empty").hidden=Boolean(reference || l.elements.length || view==="tour" || view==="model");
  $("empty").textContent="Importa una planta o empieza con un trazado.";
  paint();
}
for (const [group,names] of Object.entries(layers)) {
  const options=document.createElement("optgroup");options.label=group;$("reviewLayer").append(options);
  for (const name of names) {
    options.append(new Option(name,name));
    option($("elementLayer"),name,name);
    option($("reviewDestination"),name,name);
    option($("groupDestination"),name,name);
  }
}
$("reviewLayer").onchange=()=>{
  activeLayer=$("reviewLayer").value;selected=null;reviewHits=[];$("showExcluded").checked=false;navigate("review");
};
for(const name of Object.keys(catalog)) option($("catalog"),name,name);
function navigate(next) {
  const l=current();
  if(next==="model" || next==="tour") {
    const errors=checks(l);
    const preliminary=!l.approved||Boolean(errors.plan.length||errors.model.length);
    if(next==="tour"&&preliminary) {
      notify("Completa la validación y las alturas antes de abrir el modelo.");return;
    }
    const nextScene=makeScene(l,preliminary);
    if(!nextScene.faces.length){notify("Traza un muro, contorno o pieza para abrir la vista 3D.");return;}
    scene=nextScene;
    if(next==="model")notify(preliminary?
      "Vista previa 3D · "+(scene.calibrated?"Escala del plano. ":"Escala aproximada. ")+"En ámbar: piezas provisionales o con datos pendientes.":
      "Vista 3D de la planta validada.");
    if(next==="tour") {setTool("start");eye=null;}
  } else setTool("select");
  view=next;
  if(next==="plan" || next==="tour") {
    const primary=current().sources.findIndex(s=>s.kind==="Planta");
    if(sourceIndex!==primary){sourceIndex=primary;referenceLoad(true);}
  }
  for(const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed",b.dataset.view===view);
  $("move").hidden=next!=="tour";refresh();
}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>navigate(b.dataset.view));
function setTool(next) {
  tool=next;fixtureDraft=null;doorDepthId=null;doorDraft=null;windowDraft=null;doorDirection=1;drawing=[];transient=null;snappedWalls=[];$("snapReview").hidden=true;
  $("gestureResult").hidden=true;
  $("traceMissing").hidden=true;
  if(next!=="brush"&&next!=="lasso"&&next!=="endpoints"){
    marked.clear();
    $("groupSelection").hidden=true;
    $("reviewSelection").hidden=!element();
  }
  document.querySelectorAll("[data-select-tool]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.selectTool===next));
  $("toolHint").textContent={
    select:"Toca una pieza del plano para revisar su capa.",
    brush:activeLayer==="Muros"?"Pasa el pincel a lo largo del muro para buscar su franja en el plano.":"Pasa el dedo o el mouse sobre las piezas para seleccionarlas.",
    lasso:"Rodea las piezas. Suelta para cerrar la selección.",
    endpoints:activeLayer==="Muros"?"Marca dos puntos sobre el mismo tramo. La imagen define el largo y el grosor.":"Marca dos puntos a lo largo de un elemento, cerca de sus extremos.",
    pan:"Arrastra para mover el plano.",
    door:"Marca la bisagra y el otro extremo del vano.",
    window:"Marca dos esquinas opuestas de la ventana.",
    fixture:"Marca las dos esquinas diagonales de la pieza.",
    wallSelect:"Toca un muro ya añadido para seleccionarlo.",
    wallRectangle:"Marca dos esquinas opuestas del muro.",
    wallStrip:"Traza un tramo recto siguiendo los dos bordes del muro.",
    area:"Marca las esquinas y pulsa «Cerrar superficie».",line:"Marca el inicio y el fin.",
    measure:"Marca los dos extremos de una distancia conocida.",
    symbol:"Toca el punto de colocación del símbolo.",start:"Toca un punto libre dentro del contorno para iniciar."
  }[next];
  $("draw").textContent=tool==="area" ? "Cerrar superficie" : "Trazar elemento";
  $("traceInLayer").textContent=tool==="area"?"Cerrar superficie":"Trazar en "+activeLayer;
  $("pan").setAttribute("aria-pressed",tool==="pan");
  $("selectInLayer").setAttribute("aria-pressed",tool==="select");
  if(tool==="area"||tool==="wallStrip")notify("");
  updateReviewGuide();paint();
}
function editTool(next) { if(view!=="review")navigate("review");setTool(next); }
function newElement(points,kind,name=activeLayer,layer=activeLayer,height=null,details={}) {
  const e={id:id(),name,layer,points,height,base:0,host:null,status:"proposed",kind,...details};
  current().elements.push(e); selected=e.id; activeLayer=layer; invalidate();setTool("select");refresh();
}
$("selectInLayer").onclick=()=>setTool("select");
$("wallSelect").onclick=()=>{
  selected=null;reviewHits=[];setTool("wallSelect");refresh();
};
$("wallRemove").onclick=()=>{
  const wall=element();
  if(activeLayer!=="Muros"||wall?.layer!=="Muros"||wall.status==="excluded")return;
  wallRemoval={level:current(),wall,status:wall.status};
  wall.status="excluded";
  selected=null;reviewHits=[];current().coverage=false;invalidate();
  setTool("wallSelect");refresh();
  notify("Muro eliminado. Puedes deshacer la eliminación.");
};
$("wallUndo").onclick=()=>{
  if(wallRemoval?.level!==current()||wallRemoval.wall.status!=="excluded")return;
  const {wall,status}=wallRemoval;
  wallRemoval=null;wall.status=status;selected=wall.id;
  invalidate();refresh();
};
$("fixtureTrace").onclick=()=>editTool("fixture");
$("fixtureType").onchange=()=>{updateReviewGuide();};
$("fixtureAccept").onclick=()=>{
  if(!fixtureDraft||!Object.hasOwn(fixtures[activeLayer]||{},$("fixtureType").value))return;
  const name=$("fixtureType").value;
  newElement(fixtureDraft,"area",name);
  setTool("fixture");
  notify(name+" añadido. Marca otra pieza o cambia el tipo.");
};
$("wallRectangle").onclick=()=>editTool("wallRectangle");
$("windowTrace").onclick=()=>editTool("window");
$("windowAccept").onclick=()=>{
  if(!windowDraft)return;
  const {points,host}=windowDraft;
  newElement(points,"area","Ventana","Ventanas",null,{host,base:null});
  notify(host?"Ventana añadida. Indica altura y antepecho.":"Ventana añadida. Indica altura y antepecho y revisa su muro para el 3D.");
};
$("doorFlip").onclick=()=>{
  doorDirection*=-1;
  if(doorDraft)doorDraft.swing=draftSwing(drawing);
  paint();
};
$("doorTrace").onclick=()=>editTool("door");
$("doorDepth").onclick=()=>{
  const e=element();
  if(e?.layer!=="Puertas"||!e.swing||e.kind!=="line")return;
  editTool("door");
  doorDepthId=e.id;
  drawing=[e.swing.hinge,e.swing.latch];
  doorDirection=Math.sign(e.swing.delta)||1;
  doorDraft=doorOnWall(e.swing,current());
  updateReviewGuide();paint();
};
$("doorAccept").onclick=()=>{
  if(tool!=="door"||drawing.length!==2)return;
  if(doorDepthId){
    if(!doorDraft||element()?.id!==doorDepthId)return;
    const {points,host,swing}=doorDraft;
    editElement(e=>Object.assign(e,{points,host,swing,kind:"area"}));
    notify(host?"Profundidad guardada.":"Profundidad guardada. Vincula el muro para el 3D.");
    return;
  }
  const swing=draftSwing(drawing);
  const points=doorDraft?.points||[...drawing];
  const host=doorDraft?.host??null;
  newElement(points,doorDraft?"area":"line","Puerta abatible","Puertas",null,{host,swing});
  notify(host?"Puerta añadida. Indica su altura.":"Puerta añadida en 2D. Puedes definir la profundidad del vano para el 3D.");
};
$("doorToggle").onclick=()=>{
  const e=element();
  if(!e?.swing)return;
  closedDoorId=closedDoorId===e.id?null:e.id;
  updateReviewGuide();paint();
};
$("wallTrace").onclick=()=>editTool("wallStrip");
document.querySelectorAll("[data-select-tool]").forEach(b=>b.onclick=()=>{
  marked.clear();selected=null;reviewHits=[];setTool(b.dataset.selectTool);refresh();
});
$("clearGroup").onclick=()=>{marked.clear();refresh();};
$("applyGroup").onclick=()=>{
  const destination=$("groupDestination").value;
  if(!category.includes(destination)||!marked.size)return;
  let changed=0;
  for(const e of current().elements){
    if(!marked.has(e.id)||e.status==="excluded"||e.layer===destination)continue;
    e.layer=destination;e.status="proposed";e.host=null;changed++;
  }
  marked.clear();
  if(changed){current().coverage=false;invalidate();}
  refresh();
  notify(changed===1?"1 pieza movida a "+destination:changed+" piezas movidas a "+destination);
};
$("draw").onclick=$("traceInLayer").onclick=()=>{
  if(tool!=="area") {editTool("area");return;}
  if(drawing.length<3 || area(drawing)<=.00001) {notify("Marca al menos tres esquinas que encierren una superficie.");return;}
  newElement([...drawing],"area");
};
$("line").onclick=()=>editTool("line");
$("measure").onclick=()=>{
  if(current().measures.length>=3) {notify("Ya hay tres cotas. Puedes borrarlas para volver a medir.");return;}
  editTool("measure");
};
$("layerPieces").onchange=()=>{
  const piece=live(current()).find(item=>item.id===$("layerPieces").value&&item.layer===activeLayer);
  if(!piece)return;
  selected=piece.id;reviewHits=[];setTool("select");
  const b=bounds(piece.points), {w,h}=size();
  camera.x=w/2-(b.x+b.right)*camera.scale/2;
  camera.y=h/2-(b.y+b.bottom)*camera.scale/2;
  refresh();
};
function proposalFeedback(message) {
  $("proposalResult").textContent=message;
  $("proposalResult").hidden=false;
  notify(message);
}
$("proposeWalls").onclick=()=>{
  const l=current(), {factor}=scaleInfo(l);
  if(!reference||$("wallProposalPanel").hidden)return;
  try{
    const candidates=detectImageWalls(reference,factor);
    const known=l.elements.filter(e=>e.kind==="area"&&(e.layer==="Muros"||e.fromRasterWalls));
    let added=0;
    for(const points of candidates){
      if(known.some(e=>overlapsWall(points,e.points)))continue;
      const proposal={id:id(),name:"Muro sugerido",layer:"Muros",points,kind:"area",status:"proposed",
        fromRasterWalls:true,height:null,base:0,host:null};
      l.elements.push(proposal);known.push(proposal);added++;
    }
    if(added){l.coverage=false;invalidate();}
    activeLayer="Muros";selected=null;reviewHits=[];navigate("review");
    proposalFeedback(added?added+" propuestas añadidas. Revisa las piezas azules o elige una en la lista.":
      "No encontré nuevos tramos oscuros y rellenos. Puedes incorporar los que falten con Trazar en Muros.");
  }catch{
    proposalFeedback("No se pudo analizar esta imagen. Puedes seguir trazando en la app.");
  }
};
$("clearMeasures").onclick=()=>{current().measures=[];invalidate();navigate("review");};
$("pan").onclick=()=>editTool(tool==="pan"?"select":"pan");
$("place").onclick=()=>{
  if(!scaleInfo(current()).factor) {notify("Calibra la escala antes de colocar un símbolo.");return;}
  editTool("symbol");
};
function editElement(update,resetCoverage=false) {
  const e=element();if(!e)return;
  update(e);if(resetCoverage)current().coverage=false;
  invalidate();navigate("review");
}
$("elementName").onchange=()=>editElement(e=>e.name=$("elementName").value.trim()||e.layer);
function reclassify(layer) {
  const e=element();
  if(!e||e.layer===layer)return;
  const wasCritical=structural(e)||opening(e)||e.layer==="Contorno";
  editElement(item=>{item.layer=layer;item.status="proposed";item.host=null;},wasCritical||["Muros","Columnas","Puertas","Ventanas","Contorno"].includes(layer));
  notify(e.name+" movido a "+layer+".");
}
$("elementLayer").onchange=()=>reclassify($("elementLayer").value);
$("reviewDestination").onchange=()=>reclassify($("reviewDestination").value);
$("addToLayer").onclick=()=>reclassify(activeLayer);
$("removeFromLayer").onclick=()=>reclassify("Pendiente");
$("confirmLayerPiece").onclick=()=>$("approveElement").click();
$("excludeLayerPiece").onclick=()=>$("remove").click();
$("confirmReviewLayer").onclick=()=>{
  if(view!=="review"||activeLayer==="Pendiente")return;
  const l=current();
  const proposals=l.elements.filter(item=>item.layer===activeLayer&&item.status==="proposed");
  if(!proposals.length)return;
  for(const item of proposals)item.status="confirmed";
  invalidate(l);
  refresh();
  notify(proposals.length===1?"1 pieza confirmada en "+activeLayer+".":proposals.length+" piezas confirmadas en "+activeLayer+".");
};
$("reviewCandidate").onchange=()=>{selected=$("reviewCandidate").value;refresh();};
$("height").onchange=()=>editElement(e=>e.height=numeric($("height")));
$("base").onchange=()=>editElement(e=>e.base=numeric($("base")));
$("host").onchange=()=>editElement(e=>e.host=$("host").value||null);
$("approveElement").onclick=()=>{
  const e=element();
  if(!e || e.layer==="Pendiente" || e.status==="excluded") {notify("Asigna una capa y restaura el elemento antes de confirmarlo.");return;}
  editElement(item=>item.status="confirmed");
};
$("remove").onclick=()=>{
  const e=element();
  if(!e)return;
  const state=e.status==="excluded"?"proposed":"excluded";
  if(state==="excluded" && (structural(e)||opening(e)||e.layer==="Contorno") && !confirm("¿Excluir esta pieza de la planta revisada? La fuente y la pieza original se conservan."))return;
  editElement(item=>item.status=state,true);
};
for(const [input,key] of [["clearHeight","height"],["pitch","pitch"],["coverage","coverage"]]) {
  $(input).onchange=()=>{current()[key]=input==="coverage"?$(input).checked:numeric($(input));invalidate();navigate("review");};
}
$("validate").onclick=()=>{
  const l=current(), errors=checks(l);
  if(errors.plan.length){notify(errors.plan[0]);return;}
  l.approved=new Date().toISOString();saveLocal();refresh();notify("Planta validada · "+new Date(l.approved).toLocaleString("es"));
};
$("title").onchange=()=>{project.title=$("title").value.trim()||"Proyecto sin título";saveLocal();};
$("block").onchange=()=>{project.block=$("block").value.trim()||"Bloque A";saveLocal();};
function referenceLoad(reset) {
  snappedWalls=[];
  $("proposalResult").hidden=true;
  const src=current().sources[sourceIndex], token=++sourceToken;
  reference=null;
  if(src?.data) {
    const img=new Image();
    img.onload=()=>{if(token!==sourceToken)return;reference=img;if(reset)fit();refresh();};
    img.onerror=()=>{if(token===sourceToken)notify("El navegador no pudo leer esta imagen.");};
    img.src=src.data;
  }
  if(reset)fit();refresh();
}
function activate(index) {
  $("proposalResult").hidden=true;
  reviewHits=[];
  project.active=index;sourceIndex=current().sources.findIndex(s=>s.kind==="Planta");selected=null;
  navigate("review");referenceLoad(true);
}
$("levels").onchange=()=>{activate(Number($("levels").value));if(localProjectKey)saveLocal();};
for (const key of ["add","repeat"]) $(key).onclick=()=>{
  const name=prompt(key==="add"?"Nombre del nivel distinto":"Nombre del piso repetido",`Nivel ${project.levels.length+1}`);
  if(!name?.trim())return;
  const old=current();
  const result=key==="repeat" ? clone(old) : level();
  result.id=id();result.name=name.trim();result.approved=null;result.coverage=false;
  if(key==="repeat") result.repeatedFrom=old.id;
  else if(old.approved && confirm("¿Copiar las piezas confirmadas del nivel actual para revisar cuáles coinciden?")) {
    result.elements=clone(live(old).filter(e=>e.status==="confirmed"));
    result.elements.forEach(e=>e.status="proposed");
  }
  project.levels.push(result);activate(project.levels.length-1);saveLocal();
};
$("new").onclick=async()=>{
  await saves;
  if(switchProject(blank()))saveLocal();
};
$("sources").onchange=()=>{sourceIndex=Number($("sources").value);referenceLoad(true);};
$("underlay").onchange=paint;
$("referenceOpacity").oninput=()=>{
  $("referenceValue").textContent=$("referenceOpacity").value+" %";
  paint();
};
const planFileTypes=$("file").accept;
function pickPlan(purpose,newProject=false,types=planFileTypes) {
  sourcePurpose=purpose;
  startProjectFromPlan=newProject;
  const input=$("file");
  input.accept=types;
  ($("importDialog").open?$("importDialog"):document.body).append(input);
  input.click();
}
$("source").onclick=()=>pickPlan("Planta");
$("attach").onclick=()=>{
  const type=prompt("Tipo de lámina (Corte o Fachada)","Corte");
  if(!["corte","fachada"].includes(type?.trim().toLowerCase()))return;
  pickPlan(type.trim().toLowerCase()==="corte"?"Corte":"Fachada");
};
function classify(raw) {
  const name=raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const match=[
    [/colum|pillar/,"Columnas"],[/muro|wall|pared/,"Muros"],
    [/puert|door/,"Puertas"],[/ventan|window/,"Ventanas"],
    [/sanit|bano/,"Baños"],[/cocina|kitchen/,"Cocina"],[/closet/,"Clósets"],
    [/veget|arbol/,"Vegetación"],[/muebl|furn/,"Accesorios"]
  ].find(([pattern])=>pattern.test(name));
  return match?.[1]||"Pendiente";
}
function parseDXF(raw) {
  const rows=raw.replace(/^\uFEFF/,"").split(/\r?\n/);
  if(rows[0]?.startsWith("AutoCAD Binary"))throw Error("Exporta el DXF en formato ASCII.");
  const items=[];let section="",entity=null,sectionStart=false;
  function finish() {
    if(!entity) return;
    const g=entity.groups, first=code=>g.find(([k])=>k===code)?.[1];
    const layer=String(first(8)||"0");let points=[],closed=false;
    if(entity.type==="LINE") points=[{x:Number(first(10)),y:-Number(first(20))},{x:Number(first(11)),y:-Number(first(21))}];
    if(entity.type==="LWPOLYLINE") {
      for(const [k,v] of g) {
        if(k===10)points.push({x:Number(v),y:NaN});
        if(k===20 && points.length)points.at(-1).y=-Number(v);
      }
      if(g.some(([k,v])=>k===42 && Number(v)!==0)){entity=null;return;}
      closed=(Number(first(70))&1)!==0;
    }
    if(points.length>=2 && points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))) {
      const named=classify(layer);
      if(closed && points.length>=3 && area(points)>0) items.push({id:id(),name:layer,sourceLayer:layer,layer:named,points,height:null,base:0,host:null,status:"proposed",kind:"area"});
      else for(let k=1;k<points.length;k++) if(distance(points[k-1],points[k])>0) items.push({id:id(),name:layer,sourceLayer:layer,layer:named,points:[points[k-1],points[k]],height:null,base:0,host:null,status:"proposed",kind:"line"});
    }
    entity=null;
  }
  for(let i=0;i+1<rows.length;i+=2) {
    const k=Number(rows[i].trim()), v=rows[i+1].trim();
    if(k===0) {
      finish();
      if(v==="SECTION"){sectionStart=true;section="";}
      else if(v==="ENDSEC"){section="";sectionStart=false;}
      else if(section==="ENTITIES" && ["LINE","LWPOLYLINE"].includes(v))entity={type:v,groups:[]};
    } else if(k===2 && sectionStart){section=v;sectionStart=false;}
    else if(entity)entity.groups.push([k,v]);
  }
  finish();return items;
}
function fileData(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
}
$("file").onchange=async()=>{
  const file=$("file").files[0];$("file").value="";
  if(!file)return;
  const owner=project, draft=startProjectFromPlan?blank():null, purpose=sourcePurpose;
  const target=draft?draft.levels[0]:current(), ext=file.name.split(".").at(-1).toLowerCase();
  if(draft){
    if($("importDialog").open)$("importDialog").close();
    if($("projectsDialog").open)$("projectsDialog").close();
    draft.title=file.name.replace(/\.[^.]+$/,"");
    if($("coverDialog").open)$("coverDialog").close();
  }
  if(!["dxf","jpg","jpeg","png","webp","svg"].includes(ext)) {
    notify(ext==="dwg"?"Exporta el DWG a DXF ASCII o a una imagen por lámina.":"Exporta la página del PDF a PNG para conservar el encuadre.");return;
  }
  if(purpose!=="Planta" && ext==="dxf"){notify("Adjunta cortes y fachadas como imágenes.");return;}
  try {
    if(ext==="dxf") {
      const entities=parseDXF(await file.text());
      if(project!==owner)return;
      if(!entities.length) throw Error("No encontré líneas ni polilíneas rectas en ENTITIES. Exporta una imagen o un DXF simplificado.");
      if(target.elements.length || target.sources.some(s=>s.kind==="Planta"))throw Error("Importa el DXF a un nivel vacío para evitar mezclar coordenadas.");
      target.sources.push({kind:"Planta",name:file.name,data:null});
      target.elements=entities;
      notify(entities.length+" propuestas de líneas y polilíneas. Revisa lo omitido comparando con la lámina original.");
    } else {
      if(purpose==="Planta" && target.sources.some(s=>s.kind==="Planta") && !confirm("¿Agregar otra imagen a este nivel? Verifica que use la misma posición y tamaño; la aprobación se reiniciará."))return;
      const mime={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",svg:"image/svg+xml"}[ext];
      const data=await fileData(new Blob([file],{type:mime}));
      if(project!==owner)return;
      target.sources.push({kind:purpose,name:file.name,data});
      notify("Lámina incorporada. Conserva el original y traza encima de la referencia.");
    }
    if(draft){
      await saves;
      if(project!==owner||!switchProject(draft))return;
    }
    if(purpose==="Planta"){target.coverage=false;invalidate(target);}
    else saveLocal();
    if(target===current()){sourceIndex=target.sources.length-1;navigate("review");referenceLoad(true);}
  } catch(error){notify(error.message||"No se pudo leer el archivo.");}
};
function download(name,content,mime) {
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:mime}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$("save").onclick=()=>download("MR-Scala-proyecto.json",JSON.stringify(project), "application/json");
let localProjectKey=null;
let projectDatabase;
let saves=Promise.resolve();
let saveSequence=0;
let saveFailed=false;

function openProjectDatabase() {
  if(!projectDatabase) projectDatabase=new Promise((resolve,reject)=>{
    const request=indexedDB.open("mr-scala-projects",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("projects",{keyPath:"key"});
    request.onsuccess=()=>{
      const database=request.result;
      database.onversionchange=()=>{database.close();projectDatabase=null;};
      resolve(database);
    };
    request.onerror=()=>reject(request.error);
  }).catch(error=>{projectDatabase=null;throw error;});
  return projectDatabase;
}

async function projectStore(mode,operation) {
  const database=await openProjectDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction("projects",mode);
    const request=operation(transaction.objectStore("projects"));
    transaction.oncomplete=()=>resolve(request.result);
    transaction.onabort=()=>reject(transaction.error||request.error);
  });
}

function saveLocal() {
  if(!localProjectKey)localProjectKey=id();
  const sequence=++saveSequence;
  const record={key:localProjectKey,updatedAt:Date.now(),data:clone(project)};
  $("autosaveStatus").textContent="Guardando en este dispositivo…";
  saves=saves.then(()=>projectStore("readwrite",store=>store.put(record))).then(()=>{
    if(sequence!==saveSequence)return;
    saveFailed=false;
    $("autosaveStatus").textContent="Guardado en este dispositivo";
  }).catch(()=>{
    if(sequence!==saveSequence)return;
    saveFailed=true;
    $("autosaveStatus").textContent="No se pudo guardar en el dispositivo. Usa Exportar copia.";
  });
  return saves;
}

function switchProject(next,key=null) {
  if(saveFailed&&!confirm("El último guardado falló. ¿Cambiar de proyecto de todos modos?"))return false;
  saveSequence++;
  saveFailed=false;
  localProjectKey=key;
  project=next;
  activate(project.active);
  $("autosaveStatus").textContent=key?"Guardado en este dispositivo":"";
  return true;
}

$("closeProjects").onclick=()=>$("projectsDialog").close();
function openImportMenu() {
  const dialog=$("importDialog");
  if(!dialog.open)dialog.showModal();
}
$("importProject").onclick=openImportMenu;
$("importDirect").onclick=openImportMenu;
$("coverImport").onclick=openImportMenu;
$("closeImport").onclick=()=>$("importDialog").close();
$("importImage").onclick=()=>pickPlan("Planta",true,"image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg");
$("importCad").onclick=()=>pickPlan("Planta",true,".dxf");
$("importJson").onclick=()=>{
  const input=$("projectFile");
  $("importDialog").append(input);
  input.click();
};
$("coverProjects").onclick=()=>{$("coverDialog").close();$("open").click();};
$("coverContinue").onclick=()=>$("coverDialog").close();

$("open").onclick=async()=>{
  const dialog=$("projectsDialog"), list=$("projectList"), status=$("projectListStatus");
  if(!dialog.open)dialog.showModal();
  list.replaceChildren();
  status.textContent="Buscando proyectos…";
  try {
    await saves;
    const records=await projectStore("readonly",store=>store.getAll());
    status.textContent=records.length?"Guardados en este dispositivo":"Todavía no tienes proyectos guardados aquí.";
    records.sort((a,b)=>b.updatedAt-a.updatedAt);
    for(const record of records){
      const row=document.createElement("li"), button=document.createElement("button");
      button.type="button";
      button.textContent=record.data.title+" · "+new Date(record.updatedAt).toLocaleDateString("es");
      button.onclick=async()=>{
        try {
          await saves;
          const latest=await projectStore("readonly",store=>store.get(record.key));
          if(!latest||!validProject(latest.data))throw Error();
          if(switchProject(latest.data,record.key))dialog.close();
        } catch {
          status.textContent="No se pudo abrir el proyecto guardado.";
        }
      };
      row.append(button);
      list.append(row);
    }
  } catch {
    status.textContent="El almacenamiento del navegador no está disponible. Puedes importar y exportar copias.";
  }
};
function validProject(p) {
  const point=q=>q && Number.isFinite(q.x)&&Number.isFinite(q.y);
  const height=x=>x===null||(Number.isFinite(x)&&x>=0);
  const imageData=s=>s===null||(typeof s==="string"&&/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(s));
  return p?.version===1 && typeof p.title==="string" && typeof p.block==="string" &&
    Array.isArray(p.levels) && Number.isInteger(p.active) && p.active>=0 && p.active<p.levels.length &&
    p.levels.every(l=>typeof l.id==="string" && typeof l.name==="string" && height(l.height) && height(l.pitch) &&
      (l.approved===null||typeof l.approved==="string") && typeof l.coverage==="boolean" &&
      Array.isArray(l.sources)&&l.sources.every(s=>typeof s.name==="string" && ["Planta","Corte","Fachada"].includes(s.kind)&&imageData(s.data)) &&
      Array.isArray(l.elements)&&l.elements.every(e=>typeof e.id==="string"&&typeof e.name==="string"&&category.includes(e.layer)&&
        ["confirmed","proposed","excluded"].includes(e.status)&&height(e.height)&&height(e.base)&&
        ["area","line"].includes(e.kind)&&Array.isArray(e.points)&&e.points.length>=(e.kind==="area"?3:2)&&e.points.every(point)&&
        (e.swing==null||(point(e.swing.hinge)&&point(e.swing.latch)&&Number.isFinite(e.swing.delta)))) &&
      Array.isArray(l.measures)&&l.measures.length<=3&&l.measures.every(m=>Array.isArray(m)&&point(m[0])&&point(m[1])&&positive(m[2])));
}
$("projectFile").onchange=async()=>{
  const file=$("projectFile").files[0];$("projectFile").value="";
  if(!file)return;
  try {
    const next=JSON.parse(await file.text());
    if(!validProject(next))throw Error();
    await saves;
    if(!switchProject(next))return;
    if($("importDialog").open)$("importDialog").close();
    if($("projectsDialog").open)$("projectsDialog").close();
    if($("coverDialog").open)$("coverDialog").close();
    saveLocal();
    notify("Proyecto abierto.");
  } catch {
    if($("importDialog").open)$("importDialog").close();
    if($("coverDialog").open)$("coverDialog").close();
    if($("projectsDialog").open)$("projectsDialog").close();
    notify("El archivo no es un proyecto MR Scala compatible.");
    $("autosaveStatus").textContent="El archivo no es un proyecto MR Scala compatible.";
  }
};
$("export").onclick=()=>{
  if(!current().approved || checks(current()).plan.length){notify("Valida la planta antes de exportarla.");return;}
  const elements=live(current());const b=bounds(elements.flatMap(e=>e.points));
  const width=b.right-b.x,height=b.bottom-b.y,pad=Math.max(width,height)*.04;
  const factor=scaleInfo(current()).factor;
  const content=elements.map(e=>{
    const points=e.points.map(p=>`${p.x},${p.y}`).join(" "), stroke=ink(e.layer);
    return e.kind==="line" ? `<polyline points="${points}" fill="none" stroke="${stroke}"/>` :
      `<polygon points="${points}" fill="${structural(e)?stroke:"none"}" stroke="${stroke}"/>`;
  }).join("");
  download("MR-Scala-planta.svg",`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x-pad} ${b.y-pad} ${width+2*pad} ${height+2*pad}" width="${(width+2*pad)*factor*1000}mm" height="${(height+2*pad)*factor*1000}mm"><g stroke-width="${.012/factor}">${content}</g></svg>`,"image/svg+xml");
};
function size() {return {w:canvas.clientWidth,h:canvas.clientHeight};}
const planTouches = new Map();
let planPinch = null;
let fitScale = 1;
const isPlanView = () => view!=="model"&&view!=="tour";
function fit() {
  const src=current().sources[sourceIndex];
  const points=src?.kind!=="Planta" && reference ? [] : current().elements.flatMap(e=>e.points);
  if(reference)points.push(...rect(0,0,reference.naturalWidth,reference.naturalHeight));
  if(!points.length)points.push(...rect(0,0,800,540));
  const b=bounds(points), {w,h}=size(), s=Math.min((w-40)/Math.max(1,b.right-b.x),(h-40)/Math.max(1,b.bottom-b.y));
  fitScale=Math.max(.000001,s);
  camera={scale:fitScale,x:w/2-(b.x+b.right)*fitScale/2,y:h/2-(b.y+b.bottom)*fitScale/2};
  paint();
}
function zoom(by,x=size().w/2,y=size().h/2) {
  scalePlanAt(by,{x,y},{x,y});
}
function scalePlanAt(by,from,to) {
  const scale=Math.min(fitScale*32,Math.max(fitScale*.2,camera.scale*by));
  const factor=scale/camera.scale;
  camera.x=to.x+(camera.x-from.x)*factor;
  camera.y=to.y+(camera.y-from.y)*factor;
  camera.scale=scale;
  paint();
}
$("fit").onclick=()=>view==="model"?(orbit=-.65,paint()):fit();
$("plus").onclick=()=>zoom(1.25);
$("minus").onclick=()=>zoom(.8);
function trace(points,closed) {
  pen.beginPath();
  points.forEach((p,i)=>i?pen.lineTo(p.x,p.y):pen.moveTo(p.x,p.y));
  if(closed)pen.closePath();
}
function hitsDoorSwing(p,e) {
  const {hinge,latch,delta}=e.swing;
  const radius=distance(hinge,latch);
  const start=Math.atan2(latch.y-hinge.y,latch.x-hinge.x);
  const angle=start+(closedDoorId===e.id?0:delta);
  const tip={x:hinge.x+radius*Math.cos(angle),y:hinge.y+radius*Math.sin(angle)};
  const offset=Math.atan2(p.y-hinge.y,p.x-hinge.x)-start;
  const sweep=Math.atan2(Math.sin(offset),Math.cos(offset));
  const tolerance=7/camera.scale;
  return nearLine(p,hinge,tip)<tolerance||
    (sweep*delta>=0&&Math.abs(sweep)<=Math.abs(delta)&&Math.abs(distance(p,hinge)-radius)<tolerance);
}
function paintDoorSwing(swing,closed=false) {
  const {hinge,latch,delta}=swing;
  const radius=distance(hinge,latch);
  const start=Math.atan2(latch.y-hinge.y,latch.x-hinge.x);
  pen.beginPath();pen.arc(hinge.x,hinge.y,radius,start,start+delta,delta<0);pen.stroke();
  const angle=closed?start:start+delta;
  trace([hinge,{x:hinge.x+radius*Math.cos(angle),y:hinge.y+radius*Math.sin(angle)}],false);pen.stroke();
}
function planPaint() {
  const {w,h}=size(), src=current().sources[sourceIndex];
  const overlay=!src || src.kind==="Planta";
  pen.save();pen.translate(camera.x,camera.y);pen.scale(camera.scale,camera.scale);
  const reviewing=view==="review";
  const comparing=reviewing && overlay && Boolean(reference);
  const showReference=Boolean(reference) && (comparing || $("underlay").checked) &&
    (view!=="plan" || !live(current()).length);
  if(showReference) {
    pen.globalAlpha=comparing ? Number($("referenceOpacity").value)/100 : 1;
    pen.drawImage(reference,0,0);pen.globalAlpha=1;
  }
  if(overlay) {
    const elements=current().elements;
    const focusIds=reviewing?overlappingWallUnit([...marked,selected]):new Set();
    const isActive=e=>e.layer===activeLayer||focusIds.has(e.id);
    const visible=reviewing
      ? [...elements.filter(e=>!isActive(e)&&e.status!=="excluded"),
         ...elements.filter(e=>isActive(e)&&e.status!=="excluded"),
         ...elements.filter(e=>$("showExcluded").checked&&e.layer===activeLayer&&e.status==="excluded")]
      : elements.filter(e=>e.status!=="excluded");
    for(const e of visible) {
      const focus=focusIds.has(e.id), highlighted=reviewing&&isActive(e);
      const excluded=e.status==="excluded";
      pen.globalAlpha=excluded ? .6 : reviewing&&!highlighted ? (comparing ? .34 : .42) : 1;
      pen.strokeStyle=excluded ? "#68768a" : focus ? "#003075" : highlighted ? "#174bb8" : ink(e.layer);
      pen.fillStyle=pen.strokeStyle;
      pen.lineWidth=(focus?3.3:highlighted?2.4:1.1)/camera.scale;
      pen.setLineDash([]);
      if(e.layer==="Puertas"&&e.swing&&!excluded){
        paintDoorSwing(e.swing,closedDoorId===e.id);
        continue;
      }
      trace(e.points,e.kind==="area");
      if(e.kind==="area"&&e.layer!=="Contorno"&&!excluded){
        const alpha=pen.globalAlpha;
        pen.globalAlpha*=reviewing ? (highlighted ? .22 : .05) : (structural(e) ? .88 : .17);
        pen.fill();pen.globalAlpha=alpha;
      }
      pen.stroke();

    }
    pen.globalAlpha=1;pen.setLineDash([]);
    if(view==="review") {
      for(const points of snappedWalls){
        pen.strokeStyle="#0b54d5";pen.fillStyle="#0b54d54f";pen.lineWidth=3/camera.scale;
        trace(points,true);pen.fill();pen.stroke();
      }
      for(const [a,b,m] of (tool==="measure" ? current().measures : [])) {
        pen.strokeStyle="#00746c";pen.fillStyle="#00746c";pen.lineWidth=2/camera.scale;
        trace([a,b],false);pen.stroke();pen.font=`${14/camera.scale}px system-ui`;pen.fillText(m+" m",(a.x+b.x)/2,(a.y+b.y)/2-6/camera.scale);
      }
      const draft=doorDraft||windowDraft||fixtureDraft;
      if(windowDraft||fixtureDraft){
        pen.strokeStyle="#174bb8";pen.lineWidth=2/camera.scale;
        trace(windowDraft?.points||fixtureDraft,true);pen.stroke();
      }
      if(tool==="door"&&drawing.length===2){
        pen.strokeStyle="#174bb8";pen.lineWidth=2/camera.scale;
        paintDoorSwing(draftSwing(drawing));
      }
      if((drawing.length||transient)&&!draft) {
        pen.strokeStyle="#e37714";pen.fillStyle="#e37714";pen.lineWidth=2/camera.scale;
        const cursor=transient&&precisionTools.has(tool)?draftPoint(transient):transient;
        const rectangle=cursor&&drawing.length===1&&["wallRectangle","window","fixture"].includes(tool)
          ? diagonalRectangle(drawing[0],cursor):null;
        const strip=cursor&&tool==="wallStrip"&&drawing.length===2
          ? wallStrip(drawing[0],drawing[1],cursor):null;
        const preview=rectangle||strip||(cursor&&!(tool==="door"&&drawing.length===2)?[...drawing,cursor]:drawing);
        trace(preview,Boolean(rectangle||strip)||(tool==="lasso"&&drawing.length>2));pen.stroke();
        if(cursor&&precisionTools.has(tool)){
          const r=7/camera.scale;
          trace([{x:cursor.x-r,y:cursor.y},{x:cursor.x+r,y:cursor.y}],false);pen.stroke();
          trace([{x:cursor.x,y:cursor.y-r},{x:cursor.x,y:cursor.y+r}],false);pen.stroke();
        }
        if(tool!=="brush"&&tool!=="lasso"){
          for(const p of drawing){pen.beginPath();pen.arc(p.x,p.y,4/camera.scale,0,Math.PI*2);pen.fill();}
        }
      }
    }
  }
  pen.restore();
  if(!reference && !live(current()).length) {
    pen.strokeStyle="#e0e9ef";pen.beginPath();
    for(let x=0;x<w;x+=24){pen.moveTo(x,0);pen.lineTo(x,h);}
    for(let y=0;y<h;y+=24){pen.moveTo(0,y);pen.lineTo(w,y);}
    pen.stroke();
  }
}
function fixtureModel(form,b,base,height,prism) {
  const width=b.right-b.x, depth=b.bottom-b.y;
  const white="#e8e9e5", wood="#a37858", cloth="#7896a9", dark="#303e47", glass="#90bacb";
  function part(x,y,w,d,z,h,fill,round=false){
    const xy=(u,v)=>form==="bed"&&width>depth?
      {x:b.x+v*width,y:b.y+u*depth}:{x:b.x+u*width,y:b.y+v*depth};
    const points=round?Array.from({length:12},(_,i)=>{
      const a=i*Math.PI/6;return xy(x+w*(1+Math.cos(a))/2,y+d*(1+Math.sin(a))/2);
    }):[xy(x,y),xy(x+w,y),xy(x+w,y+d),xy(x,y+d)];
    prism(points,base+z*height,base+(z+h)*height,fill,false);
  }
  const legs=(z,fill)=>{
    for(const x of [.06,.82])for(const y of [.06,.82])part(x,y,.12,.12,0,z,fill);
  };
  const rim=(z,h,fill)=>{
    part(0,0,1,.12,z,h,fill);part(0,.88,1,.12,z,h,fill);
    part(0,.12,.11,.76,z,h,fill);part(.89,.12,.11,.76,z,h,fill);
  };
  switch(form){
    case "tub": part(.05,.05,.9,.9,0,.58,white);rim(.55,.45,white);break;
    case "shower": part(0,0,1,1,0,.055,white);part(0,0,.035,1,.055,.945,glass);break;
    case "toilet":
      part(.26,.31,.48,.54,0,.44,white,true);
      part(.13,.29,.74,.69,.39,.31,white,true);
      part(.13,.02,.74,.29,.38,.62,white);break;
    case "basin":
      part(.37,.36,.26,.28,0,.81,white,true);
      part(.04,.03,.92,.94,.8,.15,white,true);
      part(.21,.18,.58,.62,.95,.012,glass,true);
      part(.46,.08,.08,.09,.95,.05,dark,true);break;
    case "sinkCounter":
    case "counter":
      part(.04,.05,.92,.9,0,.91,wood);part(0,0,1,1,.91,.075,white);
      if(form==="sinkCounter")part(.3,.24,.4,.52,.984,.016,glass,true);
      break;
    case "bed":
      part(.02,.04,.96,.96,0,.45,wood);part(.04,.09,.92,.88,.45,.2,white);
      part(.04,.32,.92,.65,.65,.05,cloth);part(0,0,1,.07,0,1,wood);
      part(.11,.1,.31,.2,.65,.1,white,true);part(.58,.1,.31,.2,.65,.1,white,true);break;
    case "sofa":
    case "sectional":
      part(0,.06,1,form==="sectional"?.65:.94,0,.53,cloth);
      if(form==="sectional")part(0,.65,.34,.35,0,.53,cloth);
      part(0,0,1,.19,.35,.65,cloth);part(0,.19,.12,.62,.45,.26,cloth);part(.88,.19,.12,.62,.45,.26,cloth);break;
    case "chair":
      legs(.53,wood);part(0,0,1,1,.5,.13,cloth);part(0,0,1,.15,.62,.38,wood);break;
    case "table":
      legs(.89,wood);part(0,0,1,1,.89,.11,wood);break;
    case "roundTable":
      part(.43,.43,.14,.14,0,.9,wood,true);part(0,0,1,1,.9,.1,wood,true);break;
    case "plant":
      part(.16,.16,.68,.68,0,.4,"#a6644c",true);
      part(.45,.45,.1,.1,.4,.28,wood,true);
      part(.08,.1,.68,.72,.58,.35,"#58885c",true);
      part(.36,.28,.62,.65,.66,.34,"#3f7754",true);break;
    case "lamp":
      part(.14,.14,.72,.72,0,.04,dark,true);part(.45,.45,.1,.1,0,.82,dark,true);
      part(0,0,1,1,.77,.23,"#e9dcb1",true);break;
    case "fridge":
      part(0,0,1,1,0,1,white);part(.08,.98,.84,.02,.69,.023,dark);
      part(.76,.98,.07,.02,.27,.14,dark);break;
    case "oven":
    case "washer":
      part(0,0,1,1,0,1,white);
      part(.18,.975,.64,.025,.21,.49,dark,form==="washer");break;
    case "stove":
      part(0,0,1,1,0,.95,white);
      for(const x of [.17,.55])for(const y of [.17,.55])part(x,y,.28,.28,.95,.05,dark,true);
      break;
    case "screen":
    case "picture":
      part(0,0,1,1,0,1,dark);part(.08,.96,.84,.04,.08,.84,form==="screen"?glass:"#d4ad79");break;
    case "shelves":
      part(0,0,.08,1,0,1,wood);part(.92,0,.08,1,0,1,wood);
      for(const z of [0,.32,.64,.94])part(.08,0,.84,1,z,.06,wood);
      break;
    case "pouf":
    case "decor": part(0,0,1,1,0,1,form==="pouf"?cloth:"#b36c63",true);break;
    case "rug":
    case "shelf":
    case "cabinet": part(0,0,1,1,0,1,form==="rug"?cloth:wood);break;
  }
}
function makeScene(l,preliminary=false) {
  const calibrated=scaleInfo(l).factor;
  const elements=live(l).filter(e=>!e.reviewSymbol), solids=[], faces=[], floors=[];
  const drawingBounds=bounds(elements.flatMap(e=>e.points));
  const factor=calibrated||8/(Math.max(1,drawingBounds.right-drawingBounds.x,drawingBounds.bottom-drawingBounds.y));
  const wallHeight=positive(l.height)?l.height:2.6;
  let pending=false;
  const metric=points=>points.map(p=>({x:p.x*factor,y:p.y*factor}));
  const lift=(points,z)=>points.map(p=>({...p,z}));
  function prism(points,bottom,top,fill,solid=true) {
    if(top<=bottom)return;
    const lower=lift(points,bottom), upper=lift(points,top);
    for(let i=0;i<points.length;i++){
      const k=(i+1)%points.length;
      faces.push({p:[lower[i],lower[k],upper[k],upper[i]],fill,pending,side:true});
    }
    faces.push({p:upper,fill,pending,side:false});
    if(solid && bottom<1.55 && top>.12)solids.push(points);
  }
  for(const e of elements.filter(e=>e.kind==="area")) {
    const points=metric(e.points);
    pending=preliminary&&(!calibrated||e.status!=="confirmed"||
      (structural(e)?!positive(l.height):!positive(e.height)||e.base===null));
    if(e.layer==="Contorno") {
      floors.push(points);faces.push({p:lift(points,0),fill:"#cbc3ae",side:false});continue;
    }
    if(["Infraestructura","Calles","Andenes","Jardines"].includes(e.layer)) {
      faces.push({p:lift(points,-.015),fill:ink(e.layer),side:false});continue;
    }
    if(opening(e))continue;
    if(structural(e)) {
      const holes=elements.filter(item=>opening(item)&&item.host===e.id&&positive(item.height)&&
        Number.isFinite(item.base)&&item.base>=0&&item.base+item.height<=wallHeight+1e-9&&holeRange(item,e));
      if(!holes.length){prism(points,0,wallHeight,"#9fbacb");continue;}
      const a=wallAxes(e);
      const ranges=holes.map(h=>({x:holeRange(h,e),h})).filter(r=>r.x);
      const splits=[...new Set([0,a.length,...ranges.flatMap(r=>r.x)])].sort((x,y)=>x-y);
      for(let i=1;i<splits.length;i++){
        const low=splits[i-1],high=splits[i],center=(low+high)/2;
        const slice=metric([[low,0],[high,0],[high,a.depth],[low,a.depth]].map(([u,v])=>({x:a.start.x+a.u.x*u+a.v.x*v,y:a.start.y+a.u.y*u+a.v.y*v})));
        const gaps=ranges.filter(r=>center>r.x[0]&&center<r.x[1]).map(r=>[r.h.base,r.h.base+r.h.height]).sort((x,y)=>x[0]-y[0]);
        let z=0;
        for(const [bottom,top] of gaps){prism(slice,z,bottom,"#9fbacb");z=Math.max(z,top);}
        prism(slice,z,wallHeight,"#9fbacb");
      }
      continue;
    }
    const spec=Object.hasOwn(fixtures[e.layer]||{},e.name)?fixtures[e.layer][e.name]:null;
    const base=e.base??0, height=positive(e.height)?e.height:(preliminary?(spec?.[0]??.75):0);
    if(!positive(height))continue;
    if(spec){
      fixtureModel(spec[1],bounds(points),base,height,prism);
      if(e.layer!=="Accesorios"&&base<1.55&&base+height>.12)solids.push(points);
    }else prism(points,base,base+height,ink(e.layer),e.layer!=="Accesorios");
  }
  return {faces,floors,solids,calibrated,b:bounds([...floors.flat(),...faces.flatMap(f=>f.p)])};
}
function projectFace(face,transform,screen,perspective) {
  let points=face.p.map(transform);
  if(perspective) {
    const clipped=[], near=.075;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if(a.d>=near)clipped.push(a);
      if((a.d>=near)!==(b.d>=near)){
        const t=(near-a.d)/(b.d-a.d);
        clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,d:near});
      }
    }
    points=clipped;
  }
  if(points.length<3)return null;
  return {xy:points.map(screen),depth:points.reduce((sum,p)=>sum+p.d,0)/points.length,fill:face.fill,pending:face.pending,side:face.side};
}
function renderScene(w,h) {
  const walk=view==="tour";
  if(walk&&!eye){planPaint();return;}
  if(!scene)return;
  const b=scene.b, cx=(b.x+b.right)/2, cy=(b.y+b.bottom)/2;
  const tallest=scene.faces.reduce((max,face)=>Math.max(max,...face.p.map(p=>p.z)),0);
  const ratio=Math.min(w,h)*.69/Math.max(1,b.right-b.x,b.bottom-b.y,tallest*1.6);
  const focal=Math.min(w,h)*.76, cs=Math.cos(walk?yaw:orbit),sn=Math.sin(walk?yaw:orbit);
  const transform=walk ? p=>{
    const x=p.x-eye.x,y=p.y-eye.y;
    return {x:-x*sn+y*cs,y:Math.min(1.55,current().height*.82)-p.z,d:x*cs+y*sn};
  } : p=>{
    const x=p.x-cx,y=p.y-cy,depth=x*sn+y*cs;
    return {x:x*cs-y*sn,y:depth*.55-p.z*.9,d:-depth-p.z*.55};
  };
  const screen=walk ? p=>({x:w/2+p.x*focal/p.d,y:h/2+p.y*focal/p.d}) :
    p=>({x:w/2+p.x*ratio,y:h*.61+p.y*ratio});
  const gradient=pen.createLinearGradient(0,0,0,h);gradient.addColorStop(0,"#d8eaf4");gradient.addColorStop(1,"#f8fafc");
  pen.fillStyle=gradient;pen.fillRect(0,0,w,h);
  const faces=scene.faces.map(f=>projectFace(f,transform,screen,walk)).filter(Boolean).sort((a,b)=>b.depth-a.depth);
  for(const face of faces) {
    trace(face.xy,true);pen.fillStyle=face.fill;pen.fill();
    if(face.side){pen.fillStyle="#13263818";pen.fill();}
    pen.lineWidth=.75;pen.strokeStyle=face.pending?"#a56730":"#31475742";pen.stroke();
  }
  if(walk){pen.strokeStyle="#20374a";pen.lineWidth=1;trace([{x:w/2-6,y:h/2},{x:w/2+6,y:h/2}],false);pen.stroke();}
}
function paint() {
  const canCompare=view==="review" && Boolean(reference) && current().sources[sourceIndex]?.kind==="Planta";
  $("reviewReference").hidden=!canCompare;
  $("referenceOpacity").disabled=!canCompare;
  $("underlay").disabled=canCompare;
  const {w,h}=size();if(!w||!h)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  pen.setTransform(dpr,0,0,dpr,0,0);pen.clearRect(0,0,w,h);
  if(view==="model"||view==="tour")renderScene(w,h);else planPaint();
}
function nearLine(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y, length=dx*dx+dy*dy;
  if(!length)return distance(p,a);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length));
  return distance(p,{x:a.x+t*dx,y:a.y+t*dy});
}
function canStand(p) {
  if(!scene)return false;
  const probes=[p,...Array.from({length:8},(_,i)=>({x:p.x+.14*Math.cos(i*Math.PI/4),y:p.y+.14*Math.sin(i*Math.PI/4)}))];
  return probes.every(q=>scene.floors.some(f=>inside(q,f))&&!scene.solids.some(s=>inside(q,s)));
}
function move(action) {
  if(view!=="tour" || !eye)return;
  if(action==="left"||action==="right"){yaw+=(action==="left"?-.2:.2);paint();return;}
  const step=action==="forward"?.055:-.055;
  for(let i=0;i<4;i++){
    const p={x:eye.x+Math.cos(yaw)*step,y:eye.y+Math.sin(yaw)*step};
    if(!canStand(p))break;eye=p;
  }
  paint();
}
document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>move(b.dataset.move));
canvas.addEventListener("keydown",event=>{
  const command={ArrowUp:"forward",ArrowDown:"back",ArrowLeft:"left",ArrowRight:"right"}[event.key];
  if(view==="tour"&&command){event.preventDefault();move(command);}
  if(event.key==="Backspace"&&drawing.length){event.preventDefault();drawing.pop();updateReviewGuide();paint();}
  if(event.key==="Escape"){if(view==="tour")navigate("tour");else setTool("select");}
});
function coords(event) {
  const b=canvas.getBoundingClientRect();return {x:event.clientX-b.left,y:event.clientY-b.top};
}
const world=p=>({x:(p.x-camera.x)/camera.scale,y:(p.y-camera.y)/camera.scale});
function selectionPool() {
  return live(current()).filter(e=>e.layer!=="Contorno"||activeLayer==="Contorno");
}
function edges(points,closed) {
  return points.slice(1).map((p,i)=>[points[i],p]).concat(closed?[[points.at(-1),points[0]]]:[]);
}
function segmentGap(a,b,c,d) {
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const straddles=(p,q,r,t)=>{
    const x=cross(p,q,r), y=cross(p,q,t);
    return (x<0&&y>0)||(x>0&&y<0);
  };
  if(straddles(a,b,c,d)&&straddles(c,d,a,b))return 0;
  return Math.min(nearLine(a,c,d),nearLine(b,c,d),nearLine(c,a,b),nearLine(d,a,b));
}
function hitsStroke(e,path,radius) {
  const segments=edges(e.points,e.kind==="area");
  if(path.some(p=>(e.kind==="area"&&inside(p,e.points))||segments.some(([a,b])=>nearLine(p,a,b)<=radius)))return true;
  return edges(path,false).some(([a,b])=>segments.some(([c,d])=>segmentGap(a,b,c,d)<=radius));
}
function gestureFeedback(message) {
  $("gestureResult").textContent=message;
  $("gestureResult").hidden=!message;
  notify(message);
}
function suggestTrace() {
  gestureFeedback(activeLayer==="Muros"?"No pude identificar el tramo. Acerca el plano y toca el muro, o usa Trazar tramo de muro.":"No encontré una pieza editable aquí. Puedes incorporarla con Trazar en "+activeLayer+".");
  $("traceMissing").textContent="Trazar en "+activeLayer;
  $("traceMissing").hidden=false;
}
$("traceMissing").onclick=()=>{(activeLayer==="Muros"?$("wallTrace"):fixtures[activeLayer]?$("fixtureTrace"):$("traceInLayer")).click();$("canvas").scrollIntoView({block:"nearest"});};

$("showExcluded").onchange=()=>{
  if(!$("showExcluded").checked&&element()?.status==="excluded"){selected=null;reviewHits=[];}
  refresh();
};
$("clearSnap").onclick=()=>{snappedWalls=[];refresh();gestureFeedback("");};
$("acceptSnap").onclick=()=>{
  if(view!=="review"||activeLayer!=="Muros"||!snappedWalls.length)return;
  const l=current();
  for(const points of snappedWalls){
    const proposal={id:id(),name:"Muro del plano",layer:"Muros",points,kind:"area",status:"proposed",
      fromRasterWalls:!["wallRectangle","wallStrip"].includes(tool),height:null,base:0,host:null};
    l.elements.push(proposal);marked.add(proposal.id);
  }
  const count=snappedWalls.length;
  if(tool==="wallRectangle"||tool==="wallStrip")drawing=[];
  snappedWalls=[];l.coverage=false;invalidate(l);refresh();
  gestureFeedback(count===1?"Tramo añadido a Muros.":count+" tramos añadidos a Muros.");
};
function wallMatch(a,b,box,tolerance,wholeGesture) {
  const horizontal=box.right-box.x>=box.bottom-box.y;
  const start=horizontal?box.x:box.y, end=horizontal?box.right:box.bottom;
  const near=horizontal?box.y:box.x, far=horizontal?box.bottom:box.right;
  const u1=horizontal?a.x:a.y,u2=horizontal?b.x:b.y;
  const v1=horizontal?a.y:a.x,v2=horizontal?b.y:b.x;
  const length=Math.abs(u2-u1);
  if(length<.00001||Math.abs(v2-v1)>length*.65)return null;
  const gap=Math.max(0,near-v1,near-v2,v1-far,v2-far);
  const overlap=Math.min(end,Math.max(u1,u2))-Math.max(start,Math.min(u1,u2));
  if(gap>tolerance||overlap<=0)return null;
  if(wholeGesture&&(overlap/length<.66||Math.min(u1,u2)<start-2*tolerance||Math.max(u1,u2)>end+2*tolerance))return null;
  if(!wholeGesture&&overlap/length<.4)return null;
  return gap+(length-overlap)*.4;
}
function rasterWallsForReview() {
  const l=current(), {factor}=scaleInfo(l);
  if(activeLayer!=="Muros"||!reference||l.sources[sourceIndex]?.kind!=="Planta")return [];
  if(sourceIndex!==l.sources.findIndex(source=>source.kind==="Planta"))return [];
  if(!wallImageCache||wallImageCache.image!==reference||wallImageCache.factor!==factor){
    try{
      const walls=detectImageWalls(reference,factor).map(points=>({points,box:bounds(points)}));
      wallImageCache={image:reference,factor,walls};
    }catch{return [];}
  }
  return wallImageCache.walls;
}
function snapWallsToImage(path,wholeGesture) {
  const l=current(), walls=rasterWallsForReview();
  if(!walls.length)return false;
  const wallMatches=new Set();
  const tolerance=Math.max(4,14/camera.scale);
  if(path.length===1){
    const {x,y}=path[0];
    let best=null,bestDistance=Infinity;
    for(const candidate of walls){
      const b=candidate.box;
      const gap=Math.hypot(Math.max(b.x-x,0,x-b.right),Math.max(b.y-y,0,y-b.bottom));
      if(gap<=tolerance&&gap<bestDistance){best=candidate;bestDistance=gap;}
    }
    if(best)wallMatches.add(best);
  }else for(const [a,b] of edges(path,false)){
    let best=null,bestScore=Infinity;
    for(const candidate of walls){
      const score=wallMatch(a,b,candidate.box,tolerance,wholeGesture);
      if(score!==null&&score<bestScore){best=candidate;bestScore=score;}
    }
    if(best)wallMatches.add(best);
  }
  const known=live(l).filter(e=>e.kind==="area"&&e.layer==="Muros");
  for(const {points} of wallMatches){
    const existing=known.find(e=>overlapsWall(points,e.points)&&overlapsWall(e.points,points));
    if(existing)marked.add(existing.id);
    else if(!snappedWalls.some(prior=>overlapsWall(points,prior)&&overlapsWall(prior,points)))snappedWalls.push(points);
  }
  return wallMatches.size>0;
}
function finishGesture() {
  const points=drawing;
  drawing=[];transient=null;
  const brush=tool==="brush";
  if(!brush&&(points.length<3||area(points)<=8/(camera.scale*camera.scale))){
    refresh();notify("Rodea la pieza con el dedo y suelta para cerrar el lazo.");
    return;
  }
  if(brush&&snapWallsToImage(points,false)){
    refresh();gestureFeedback(snappedWalls.length?"Revisa los tramos detectados y pulsa Añadir a Muros.":"Tramos del plano seleccionados.");
    return;
  }
  const outline=brush?points:[...points,points[0]];
  const hits=selectionPool().filter(e=>
    (!brush&&e.points.some(p=>inside(p,points)))||
    hitsStroke(e,outline,(brush?8:2)/camera.scale)
  );
  for(const e of hits)marked.add(e.id);
  refresh();
  if(hits.length)gestureFeedback("Selección acumulada: "+marked.size);
  else suggestTrace();
}
function finishEndpoints(a,b) {
  if(snapWallsToImage([a,b],true)){
    drawing=[];transient=null;refresh();
    gestureFeedback(snappedWalls.length?"Revisa el tramo detectado y pulsa Añadir a Muros.":"Tramo del plano seleccionado.");
    return;
  }
  const samples=Array.from({length:25},(_,i)=>({x:a.x+(b.x-a.x)*i/24,y:a.y+(b.y-a.y)*i/24}));
  const tolerance=9/camera.scale;
  const matches=selectionPool().map(e=>{
    const segments=edges(e.points,e.kind==="area");
    const gaps=samples.map(p=>e.kind==="area"&&inside(p,e.points)?0:Math.min(...segments.map(([c,d])=>nearLine(p,c,d))));
    return {e,coverage:gaps.filter(g=>g<=tolerance).length/samples.length,gap:gaps.reduce((sum,g)=>sum+g,0)};
  }).filter(m=>m.coverage>=.68).sort((a,b)=>b.coverage-a.coverage||a.gap-b.gap||
    Number(b.e.layer===activeLayer)-Number(a.e.layer===activeLayer));
  if(matches.length)marked.add(matches[0].e.id);
  drawing=[];transient=null;refresh();
  if(matches.length)gestureFeedback("Selección acumulada: "+marked.size);
  else suggestTrace();
}

canvas.addEventListener("pointerdown",event=>{
  if(event.button!==0)return;
  if(event.pointerType==="touch"&&isPlanView()){
    planTouches.set(event.pointerId,coords(event));
    if(planTouches.size>=2){
      if(drag?.selectionGesture){drawing=[];transient=null;}
      drag=null;
      planPinch=pinchPosition();
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  }
  canvas.focus({preventScroll:true});
  drag={start:coords(event),last:coords(event),moved:false,pointer:event.pointerId};
  if(view==="review"&&(tool==="brush"||tool==="lasso")&&(!current().sources[sourceIndex]||current().sources[sourceIndex].kind==="Planta")){
    drag.selectionGesture=tool;drawing=[world(drag.start)];transient=null;paint();
  }
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove",event=>{
  const p=coords(event);
  if(planTouches.has(event.pointerId)){
    planTouches.set(event.pointerId,p);
    if(planTouches.size>=2){
      const next=pinchPosition();
      if(planPinch && isPlanView())scalePlanAt(next.span/planPinch.span,planPinch.center,next.center);
      planPinch=next;
      return;
    }
    if(!drag)return;
  }
  if(drag && drag.pointer===event.pointerId) {
    if(distance(p,drag.start)>4)drag.moved=true;
    if(drag.selectionGesture&&tool===drag.selectionGesture){
      if(distance(p,drag.last)>=2){drawing.push(world(p));drag.last=p;paint();}
      return;
    }
    if(view==="review"&&precisionTools.has(tool)){transient=world(p);paint();return;}
    const dx=p.x-drag.last.x,dy=p.y-drag.last.y;
    if(drag.moved&&view==="model")orbit+=dx*.008;
    else if(drag.moved&&view==="tour"&&eye)yaw+=dx*.008;
    else if(drag.moved&&tool==="pan"){camera.x+=dx;camera.y+=dy;}
    drag.last=p;paint();
  } else if(drawing.length||(view==="review"&&precisionTools.has(tool))){transient=world(p);paint();}
});
function pinchPosition() {
  const [a,b]=planTouches.values();
  return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},span:Math.max(8,distance(a,b))};
}
function releasePlanTouch(event) {
  if(!planTouches.delete(event.pointerId))return;
  planPinch=planTouches.size>=2 ? pinchPosition() : null;
}
function cancelCanvasPointer(event) {
  releasePlanTouch(event);
  if(drag?.pointer===event.pointerId){
    if(drag.selectionGesture){drawing=[];transient=null;paint();}
    else if(transient&&precisionTools.has(tool)){transient=null;paint();}
    drag=null;
  }
}
canvas.addEventListener("pointercancel",cancelCanvasPointer);
canvas.addEventListener("lostpointercapture",cancelCanvasPointer);
canvas.addEventListener("pointerup",event=>{
  releasePlanTouch(event);
  if(!drag||drag.pointer!==event.pointerId)return;
  const {moved,selectionGesture}=drag;drag=null;
  const raw=world(coords(event));
  const precision=view==="review"&&precisionTools.has(tool);
  const p=precision?draftPoint(raw):raw;
  if(selectionGesture&&tool===selectionGesture&&view==="review"){drawing.push(p);finishGesture();return;}
  if(moved&&!precision)return;
  if(view==="tour") {
    if(!eye){
      const s=scaleInfo(current()).factor, candidate={x:p.x*s,y:p.y*s};
      if(!canStand(candidate)){notify("Elige un punto libre dentro del suelo.");return;}
      eye=candidate;yaw=0;$("toolHint").textContent="Usa las flechas o los botones. Arrastra para girar.";paint();
    }
    return;
  }
  if(view!=="review" || tool==="pan")return;
  if(current().sources[sourceIndex] && current().sources[sourceIndex].kind!=="Planta"){notify("Selecciona una lámina de planta para editar.");return;}
  if(tool==="endpoints"){
    if(!drawing.length){drawing=[p];paint();gestureFeedback("Primer punto marcado. Toca otro punto sobre el mismo muro.");return;}
    if(distance(drawing[0],p)>=5/camera.scale)finishEndpoints(drawing[0],p);
    else gestureFeedback("Toca el segundo punto más lejos, sobre el mismo muro.");
    return;
  }
  if(tool==="wallRectangle"){
    if(snappedWalls.length)return;
    if(!drawing.length){drawing=[p];updateReviewGuide();paint();return;}
    const points=diagonalRectangle(drawing[0],p);
    if(!points){notify("Toca una esquina opuesta en diagonal.");return;}
    drawing=[];transient=null;snappedWalls=[points];refresh();return;
  }
  if(tool==="fixture"){
    if(fixtureDraft)return;
    if(!drawing.length){drawing=[p];}
    else{
      fixtureDraft=diagonalRectangle(drawing[0],p);
      if(!fixtureDraft){$("reviewGuide").textContent="Toca la esquina diagonal opuesta de la pieza.";return;}
    }
    transient=null;updateReviewGuide();paint();return;
  }
  if(tool==="window"){
    if(windowDraft)return;
    if(!drawing.length){drawing=[p];}
    else{
      const points=diagonalRectangle(drawing[0],p);
      if(!points){$("reviewGuide").textContent="El segundo punto debe quedar en diagonal, sobre la otra cara del muro.";return;}
      windowDraft={points,host:openingHost(points)};
    }
    transient=null;updateReviewGuide();paint();return;
  }
  if(tool==="door"){
    if(doorDraft||(drawing.length===2&&!doorDepthId))return;
    if(drawing.length<2){
      if(drawing.length&&distance(drawing[0],p)*camera.scale<3)return;
      drawing.push(p);
      if(drawing.length===2)doorDraft=doorOnWall(draftSwing(drawing),current());
    }else{
      const swing=draftSwing(drawing);
      const points=doorFootprint(swing,p);
      if(!points){notify("Toca el borde opuesto del vano.");return;}
      doorDraft={points,host:openingHost(points),swing};
    }
    transient=null;updateReviewGuide();paint();return;
  }
  if(tool==="wallStrip"){
    if(snappedWalls.length)return;
    if(drawing.length===2){
      const footprint=wallStrip(drawing[0],drawing[1],p);
      if(!footprint){notify("Toca el borde opuesto para darle grosor al muro.");return;}
      drawing=[];transient=null;snappedWalls=[footprint];refresh();
    }else if(!drawing.length||distance(drawing[0],p)*camera.scale>=3){
      drawing.push(p);transient=null;updateReviewGuide();paint();
    }
    return;
  }
  if(tool==="area"){drawing.push(p);updateReviewGuide();paint();return;}
  if(tool==="line"||tool==="measure") {
    if(!drawing.length){drawing.push(p);paint();return;}
    const a=drawing[0];if(distance(a,p)<.00001)return;
    if(tool==="line"){newElement([a,p],"line");return;}
    const value=prompt("Distancia real entre los puntos, en metros","");
    const m=Number(value?.trim().replace(",","."));
    if(positive(m)){current().measures.push([a,p,m]);invalidate();setTool("select");refresh();}
    else{notify("Escribe una distancia positiva en metros.");setTool("measure");}
    return;
  }
  if(tool==="symbol") {
    const name=$("catalog").value,[layer,w,d,h]=catalog[name],s=scaleInfo(current()).factor;
    if(s)newElement(rect(p.x-w/(2*s),p.y-d/(2*s),w/s,d/s),"area",name,layer,h);
    return;
  }
  const candidates=current().elements.filter(e=>(tool!=="wallSelect"||(e.layer==="Muros"&&e.status!=="excluded"))&&(e.status!=="excluded"||($("showExcluded").checked&&e.layer===activeLayer))&&
    ((e.layer==="Puertas"&&e.swing&&hitsDoorSwing(p,e))||(e.kind==="area" ? inside(p,e.points)||e.points.some((a,i)=>nearLine(p,a,e.points[(i+1)%e.points.length])<4/camera.scale)
      : nearLine(p,...e.points)<7/camera.scale)));
  candidates.reverse();
  const choice=candidates.find(e=>e.layer===activeLayer&&e.status!=="excluded")||
    candidates.find(e=>e.status!=="excluded")||candidates[0];
  reviewHits=candidates.map(e=>e.id);
  selected=choice?.id||null;refresh();
  if(choice){gestureFeedback("");return;}
  if(tool==="wallSelect")return;
  if(reference&&snapWallsToImage([p],false)){
    refresh();
    gestureFeedback(snappedWalls.length?"Revisa el tramo azul y pulsa Añadir a Muros.":"Tramo del plano seleccionado.");
  }else if(reference)suggestTrace();
});
canvas.addEventListener("wheel",e=>{
  if(view==="model"||view==="tour")return;e.preventDefault();
  const {x,y}=coords(e);zoom(e.deltaY<0?1.14:1/1.14,x,y);
},{passive:false});
new ResizeObserver(()=>{if(!reference&&!drag&&!planTouches.size)fit();else paint();}).observe(canvas);
fit();refresh();navigate("model");notify("Modelo de muestra. Arrastra para girarlo o abre Recorrido.");
$("coverDialog").showModal();

if("serviceWorker" in navigator && window.isSecureContext){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(error=>console.warn("Instalación sin conexión:",error)));
}

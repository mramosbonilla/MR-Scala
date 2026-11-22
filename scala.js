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
function rasterWallBands(inkPixels,width,height,metresPerPixel,vertical) {
  const rows=vertical?width:height, columns=vertical?height:width;
  const minLength=Math.max(9,Math.ceil(.70/metresPerPixel));
  const minThickness=Math.max(2,Math.ceil(.075/metresPerPixel));
  const maxThickness=Math.max(minThickness,Math.floor(.55/metresPerPixel));
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
  if (elements.some(e=>e.kind==="line" && (structural(e)||opening(e)||e.layer==="Contorno"))) plan.push("Usa superficies para estructura, contorno y vanos.");
  const model=[];
  if (!positive(l.height)) model.push("Indica la altura libre.");
  if(elements.some(e=>e.reviewSymbol)) model.push("Los símbolos CAD sirven para clasificar. Dibuja la huella física antes de usarla en 3D.");
  const apertures=elements.filter(e=>opening(e)&&!e.reviewSymbol);
  for (const e of apertures) {
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
function updateReviewGuide() {
  const guide=$("reviewGuide");
  const source=current().sources[sourceIndex];
  const emptyLayer=!live(current()).some(e=>e.layer===activeLayer);
  guide.hidden=!(view==="review"&&(tool==="area"||(tool==="select"&&source?.data&&source.kind==="Planta"&&emptyLayer)));
  if(guide.hidden)return;
  if(tool==="area"){
    const count=drawing.length;
    guide.textContent=count===0?"Toca la primera esquina de un tramo.":
      count<3?"Esquinas marcadas: "+count+". Sigue el borde del tramo.":
      "Esquinas marcadas: "+count+". Termina el contorno y pulsa Cerrar superficie.";
  }else{
    guide.textContent=activeLayer==="Muros"?"Aún no hay muros editables. Toca Proponer muros para buscar tramos en la imagen o Trazar en Muros para crear uno.":"Aún no hay piezas en "+activeLayer+". Puedes añadir una con Trazar en "+activeLayer+".";
  }
}
function refresh() {
  const l=current(), e=element();
  const reviewingPlant=view==="review" && (!l.sources[sourceIndex]||l.sources[sourceIndex].kind==="Planta");
  $("layerReview").hidden=!reviewingPlant;
  const imagePlan=reviewingPlant&&Boolean(reference)&&l.sources[sourceIndex]?.kind==="Planta"&&
    sourceIndex===l.sources.findIndex(source=>source.kind==="Planta");
  const calibrated=Boolean(scaleInfo(l).factor);
  $("wallProposalPanel").hidden=!imagePlan;
  $("proposalScale").textContent=calibrated?"Escala lista para detectar muros rellenos.":
    "Coloca dos cotas reales compatibles para calcular la escala.";
  updateReviewGuide();
  $("reviewLayer").value=activeLayer;
  const pieces=live(l).filter(item=>item.layer===activeLayer);
  const layerCount=pieces.length;
  const confirmed=pieces.filter(item=>item.status==="confirmed").length;
  $("reviewLayerCount").textContent=layerCount
    ? layerCount+(layerCount===1?" pieza":" piezas")+" · "+confirmed+(confirmed===1?" confirmada":" confirmadas")
    : "Capa vacía";
  $("layerLegend").hidden=!layerCount;
  $("layerPiecesLabel").hidden=!layerCount;
  const list=$("layerPieces");
  list.replaceChildren();
  option(list,"Elige una pieza para ubicarla","");
  pieces.forEach((item,i)=>option(list,(i+1)+". "+item.name+(item.status==="confirmed"?" · confirmada":""),item.id));
  list.value=pieces.some(item=>item.id===selected)?selected:"";
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
  activeLayer=$("reviewLayer").value;selected=null;reviewHits=[];navigate("review");
};
for(const name of Object.keys(catalog)) option($("catalog"),name,name);
function navigate(next) {
  const l=current();
  if(next==="model" || next==="tour") {
    const errors=checks(l);
    if(!l.approved || errors.plan.length || errors.model.length) {
      notify("Completa la validación y las alturas antes de abrir el modelo.");return;
    }
    scene=makeScene(l);
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
  tool=next;drawing=[];transient=null;
  $("traceMissing").hidden=true;
  if(next!=="brush"&&next!=="lasso"&&next!=="endpoints"){
    marked.clear();
    $("groupSelection").hidden=true;
    $("reviewSelection").hidden=!element();
  }
  document.querySelectorAll("[data-select-tool]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.selectTool===next));
  $("toolHint").textContent={
    select:"Toca una pieza del plano para revisar su capa.",
    brush:"Pasa el dedo o el mouse sobre las piezas para seleccionarlas.",
    lasso:"Rodea las piezas. Suelta para cerrar la selección.",
    endpoints:"Marca dos puntos a lo largo de un elemento, cerca de sus extremos.",
    pan:"Arrastra para mover el plano.",
    area:"Marca las esquinas y pulsa «Cerrar superficie».",line:"Marca el inicio y el fin.",
    measure:"Marca los dos extremos de una distancia conocida.",
    symbol:"Toca el punto de colocación del símbolo.",start:"Toca un punto libre dentro del contorno para iniciar."
  }[next];
  $("draw").textContent=tool==="area" ? "Cerrar superficie" : "Trazar elemento";
  $("traceInLayer").textContent=tool==="area"?"Cerrar superficie":"Trazar en "+activeLayer;
  $("pan").setAttribute("aria-pressed",tool==="pan");
  $("selectInLayer").setAttribute("aria-pressed",tool==="select");
  if(tool==="area")notify("");
  updateReviewGuide();paint();
}
function editTool(next) { if(view!=="review")navigate("review");setTool(next); }
function newElement(points,kind,name=activeLayer,layer=activeLayer,height=null) {
  const e={id:id(),name,layer,points,height,base:0,host:null,status:"proposed",kind};
  current().elements.push(e); selected=e.id; activeLayer=layer; invalidate();setTool("select");refresh();
}
$("selectInLayer").onclick=()=>setTool("select");
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
  if(!factor){
    if(l.measures.length<3)$("measure").click();
    else proposalFeedback("Las cotas difieren más del 3 %. Usa Borrar cotas y vuelve a medir.");
    return;
  }
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
        ["area","line"].includes(e.kind)&&Array.isArray(e.points)&&e.points.length>=(e.kind==="area"?3:2)&&e.points.every(point)) &&
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
    const isActive=e=>e.layer===activeLayer||e.id===selected||marked.has(e.id);
    const visible=reviewing
      ? [...elements.filter(e=>!isActive(e)&&e.status!=="excluded"),
         ...elements.filter(e=>isActive(e)&&e.status!=="excluded"),
         ...elements.filter(e=>isActive(e)&&e.status==="excluded")]
      : elements.filter(e=>e.status!=="excluded");
    for(const e of visible) {
      const focus=reviewing&&(e.id===selected||marked.has(e.id)), highlighted=reviewing&&isActive(e);
      const excluded=e.status==="excluded";
      pen.globalAlpha=excluded ? .6 : reviewing&&!highlighted ? (comparing ? .34 : .42) : 1;
      pen.strokeStyle=excluded ? "#68768a" : focus ? "#003075" : highlighted ? "#174bb8" : ink(e.layer);
      pen.fillStyle=pen.strokeStyle;
      pen.lineWidth=(focus?3.3:highlighted?2.4:1.1)/camera.scale;
      pen.setLineDash(reviewing&&excluded?[6/camera.scale,4/camera.scale]:[]);
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
      for(const [a,b,m] of (tool==="measure"||current().showCalibration!==false ? current().measures : [])) {
        pen.strokeStyle="#00746c";pen.fillStyle="#00746c";pen.lineWidth=2/camera.scale;
        trace([a,b],false);pen.stroke();pen.font=`${14/camera.scale}px system-ui`;pen.fillText(m+" m",(a.x+b.x)/2,(a.y+b.y)/2-6/camera.scale);
      }
      if(drawing.length) {
        pen.strokeStyle="#e37714";pen.fillStyle="#e37714";pen.lineWidth=2/camera.scale;
        trace(transient?[...drawing,transient]:drawing,tool==="lasso"&&drawing.length>2);pen.stroke();
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
function makeScene(l) {
  const factor=scaleInfo(l).factor, elements=live(l), solids=[], faces=[], floors=[];
  const metric=points=>points.map(p=>({x:p.x*factor,y:p.y*factor}));
  const lift=(points,z)=>points.map(p=>({...p,z}));
  function prism(points,bottom,top,fill,solid=true) {
    if(top<=bottom)return;
    const lower=lift(points,bottom), upper=lift(points,top);
    for(let i=0;i<points.length;i++){
      const k=(i+1)%points.length;
      faces.push({p:[lower[i],lower[k],upper[k],upper[i]],fill,side:true});
    }
    faces.push({p:upper,fill,side:false});
    if(solid && bottom<1.55 && top>.12)solids.push(points);
  }
  for(const e of elements.filter(e=>e.kind==="area")) {
    const points=metric(e.points);
    if(e.layer==="Contorno") {
      floors.push(points);faces.push({p:lift(points,0),fill:"#cbc3ae",side:false});continue;
    }
    if(["Infraestructura","Calles","Andenes","Jardines"].includes(e.layer)) {
      faces.push({p:lift(points,-.015),fill:ink(e.layer),side:false});continue;
    }
    if(opening(e))continue;
    if(structural(e)) {
      const holes=elements.filter(item=>opening(item)&&item.host===e.id);
      if(!holes.length){prism(points,0,l.height,"#9fbacb");continue;}
      const a=wallAxes(e);
      const ranges=holes.map(h=>({x:holeRange(h,e),h})).filter(r=>r.x);
      const splits=[...new Set([0,a.length,...ranges.flatMap(r=>r.x)])].sort((x,y)=>x-y);
      for(let i=1;i<splits.length;i++){
        const low=splits[i-1],high=splits[i],center=(low+high)/2;
        const slice=metric([[low,0],[high,0],[high,a.depth],[low,a.depth]].map(([u,v])=>({x:a.start.x+a.u.x*u+a.v.x*v,y:a.start.y+a.u.y*u+a.v.y*v})));
        const gaps=ranges.filter(r=>center>r.x[0]&&center<r.x[1]).map(r=>[r.h.base,r.h.base+r.h.height]).sort((x,y)=>x[0]-y[0]);
        let z=0;
        for(const [bottom,top] of gaps){prism(slice,z,bottom,"#9fbacb");z=Math.max(z,top);}
        prism(slice,z,l.height,"#9fbacb");
      }
      continue;
    }
    prism(points,e.base,e.base+e.height,ink(e.layer),e.layer!=="Accesorios");
  }
  return {faces,floors,solids,b:bounds(floors.flat())};
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
  return {xy:points.map(screen),depth:points.reduce((sum,p)=>sum+p.d,0)/points.length,fill:face.fill,side:face.side};
}
function renderScene(w,h) {
  const walk=view==="tour";
  if(walk&&!eye){planPaint();return;}
  if(!scene)return;
  const b=scene.b, cx=(b.x+b.right)/2, cy=(b.y+b.bottom)/2;
  const ratio=Math.min(w,h)*.69/Math.max(1,b.right-b.x,b.bottom-b.y);
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
    pen.lineWidth=.75;pen.strokeStyle="#31475742";pen.stroke();
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
function suggestTrace() {
  notify("Aquí solo se ve el dibujo de referencia. Marca las esquinas para incorporar la pieza.");
  $("traceMissing").textContent="Trazar en "+activeLayer;
  $("traceMissing").hidden=false;
}
$("traceMissing").onclick=()=>{$("traceInLayer").click();$("canvas").scrollIntoView({block:"nearest"});};

function finishGesture() {
  const points=drawing;
  drawing=[];transient=null;
  const brush=tool==="brush";
  if(!brush&&(points.length<3||area(points)<=8/(camera.scale*camera.scale))){
    refresh();notify("Rodea la pieza con el dedo y suelta para cerrar el lazo.");
    return;
  }
  const outline=brush?points:[...points,points[0]];
  const hits=selectionPool().filter(e=>
    (!brush&&e.points.some(p=>inside(p,points)))||
    hitsStroke(e,outline,(brush?8:2)/camera.scale)
  );
  for(const e of hits)marked.add(e.id);
  refresh();
  if(hits.length)notify("Selección acumulada: "+marked.size);
  else suggestTrace();
}
function finishEndpoints(a,b) {
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
  if(matches.length)notify("Selección acumulada: "+marked.size);
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
    const dx=p.x-drag.last.x,dy=p.y-drag.last.y;
    if(drag.moved&&view==="model")orbit+=dx*.008;
    else if(drag.moved&&view==="tour"&&eye)yaw+=dx*.008;
    else if(drag.moved&&tool==="pan"){camera.x+=dx;camera.y+=dy;}
    drag.last=p;paint();
  } else if(drawing.length){transient=world(p);paint();}
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
    drag=null;
  }
}
canvas.addEventListener("pointercancel",cancelCanvasPointer);
canvas.addEventListener("lostpointercapture",cancelCanvasPointer);
canvas.addEventListener("pointerup",event=>{
  releasePlanTouch(event);
  if(!drag||drag.pointer!==event.pointerId)return;
  const {moved,selectionGesture}=drag;drag=null;
  const p=world(coords(event));
  if(selectionGesture&&tool===selectionGesture&&view==="review"){drawing.push(p);finishGesture();return;}
  if(moved)return;
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
    if(!drawing.length){drawing=[p];paint();return;}
    if(distance(drawing[0],p)>=5/camera.scale)finishEndpoints(drawing[0],p);
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
  const candidates=current().elements.filter(e=>(e.status!=="excluded"||e.layer===activeLayer)&&
    (e.kind==="area" ? inside(p,e.points)||e.points.some((a,i)=>nearLine(p,a,e.points[(i+1)%e.points.length])<4/camera.scale)
      : nearLine(p,...e.points)<7/camera.scale));
  candidates.reverse();
  const choice=candidates.find(e=>e.layer===activeLayer&&e.status!=="excluded")||
    candidates.find(e=>e.status!=="excluded")||candidates[0];
  reviewHits=candidates.map(e=>e.id);
  selected=choice?.id||null;refresh();
  if(choice)notify("");
  else if(reference)suggestTrace();
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

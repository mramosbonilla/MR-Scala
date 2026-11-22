# MR Scala 0.1

Editor local de plantas arquitectónicas. La misma geometría revisada alimenta la planta SVG, el modelo por nivel y el recorrido. La app abre con una muestra ficticia de dos ambientes y una puerta transitable.

## Probar la muestra

Abre `index.html` en un navegador. Selecciona **Modelo 3D** y arrastra para girar. En **Recorrido**, toca un punto libre en la planta y usa las flechas o los botones.

## Trabajar con un plano

1. Crea un proyecto e importa una imagen completa de la planta o un DXF ASCII de un nivel. Para fotos de un croquis, usa una toma perpendicular. Para DWG exporta DXF ASCII o PNG. Para PDF exporta una imagen de la página completa.
2. Marca dos distancias conocidas en direcciones diferentes con **Medir referencia**. Una tercera sirve para verificar. La escala es uniforme y exige que las cotas coincidan dentro del 3 %. Si la imagen está deformada, corrige la captura antes de seguir.
3. Revisa las capas. Para imágenes se trazan superficies y líneas encima del original. Para DXF, los nombres de las capas ofrecen una primera clasificación. Las entidades sin clasificación van a **Pendiente**. El importador lee LINE y LWPOLYLINE rectas en ENTITIES y conserva el nombre de capa de origen. Bloques INSERT, arcos, textos y rellenos requieren una referencia visual y trazado. Mantén una copia del DXF original.
4. Traza una superficie de contorno para el suelo y superficies separadas para muros, columnas y vanos. Para puertas y ventanas, dibuja un rectángulo que cruce todo el espesor de un tramo rectangular y vincúlalo a su muro. La anchura se calcula con la escala. Registra altura, base de cada vano y altura libre.
5. Confirma la clasificación de cada pieza y marca la revisión de toda la planta. **Validar planta** habilita el SVG. El modelo y el recorrido también necesitan dimensiones verticales completas. Una edición reabre la revisión.
6. Puedes guardar un nivel repetido como copia editable o iniciar otro nivel del mismo bloque y reutilizar las piezas previamente confirmadas como propuestas. Adjunta cortes y fachadas por nivel como imágenes de referencia. La distancia piso a piso se registra para uso posterior.
7. Guarda y vuelve a abrir el proyecto con el JSON. Las imágenes se guardan dentro del proyecto. Todo el procesamiento sucede en el navegador.

## Alcance de esta versión

El 3D utiliza volúmenes simples y vanos abiertos. La biblioteca inserta símbolos y volúmenes de tamaño genérico. Cada nivel se recorre por separado. Los cortes y fachadas son referencias adjuntas. El apilado de niveles, vínculos entre plantas repetidas, generación de elevaciones y secciones, interpretación de fotos y soporte integral de formatos CAD son etapas posteriores.

## GitHub

La raíz contiene `index.html`, `style.css` y `scala.js`. Sube este código a un repositorio de tu cuenta. Si usas GitHub Pages, el sitio es estático y se sirve desde la raíz de `main`. Comprueba las opciones gratuitas de tu cuenta antes de activar la publicación. Mantén los proyectos JSON, las imágenes privadas y los archivos CAD fuera del repositorio.

El apartado de Bogotá se distribuye aparte, con su plano de referencia y sus datos pendientes.

## Selección en la planta

- **Toque** selecciona una pieza existente y permite escoger entre piezas superpuestas.
- **Pincel** selecciona las piezas que cruza un trazo.
- **Lazo** selecciona piezas dentro de la zona rodeada o que tocan su borde.
- **Dos puntos** busca la pieza que mejor coincide con el segmento entre dos puntos cercanos a sus extremos.

Para pincel, lazo y dos puntos, comprueba qué piezas quedaron resaltadas, elige la capa de destino y pulsa **Mover selección**. Cambiar de herramienta cancela el trazo. Usa **Trazar** si el elemento solamente existe en el plano de fondo.

## GitHub Pages e instalación

Publica el contenido de este repositorio desde la rama `main`, carpeta raíz. La app debe abrirse por HTTPS. En iPhone, usa Safari y la opción **Compartir → Agregar a inicio**. El primer acceso descarga la app para abrirla sin conexión más adelante.

Los planos se leen desde el selector de archivos del dispositivo. Guarda el proyecto JSON para conservar cambios y volver a abrirlos. El servicio sin conexión almacena únicamente los archivos estáticos de la app.

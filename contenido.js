/* =====================================================================
   LA MAISON DU KITZUNE — CONTENIDO  (es lo único que se edita para cargar material)

   Abrir este archivo con un editor de texto, cambiar lo que está entre comillas
   y guardar. No hace falta tocar index.html ni la carpeta assets/.

   RUTAS    Relativas a index.html y sin barra inicial: 'media/proyectos/01.jpg'.
            index.html, contenido.js, assets/ y media/ deben estar siempre juntos.
            Los enlaces, solo https://…
   MÁXIMOS  6 proyectos · 5 temas · 12 fotos (alcance v1). No hace falta llegar a ellos.
            Si se superan, lo que sobra NO se muestra y se avisa en la consola del
            navegador (y en pantalla con review:true). Ampliar = cotizar aparte.
   VACÍO    Una sección sin contenido no aparece en la web pública (review:false).
            Al añadir su primer elemento, aparece sola.
   REVISIÓN review:true  → modo de trabajo: marca en pantalla lo pendiente y añade
                           una pista de audio de prueba. No publicar así.
            review:false → versión pública (valor actual).
   AVISOS   Una entrada incompleta se omite y se avisa (nunca rompe la web).

   CÓMO AÑADIR (copia, descomenta y rellena; las comas separan entradas):
     projects → { title:'Obligatorio', category:'', year:'', summary:'Una línea', description:'Texto breve',
                  image:'media/proyectos/01.jpg', alt:'Qué se ve', link:'https://…', linkLabel:'Ver proyecto' }
                «link» es el enlace propio del proyecto (su web o su red), no el del artista.
     gallery  → { src:'media/galeria/01.jpg', alt:'Qué se ve', caption:'Pie de foto opcional' }
     tracks   → { title:'Obligatorio', subtitle:'Single · 2026', cover:'media/musica/01.jpg', src:'media/musica/01.mp3',
                  links:[{ label:'Spotify', url:'https://…' }] }
                Audio: MP3 (o WAV) entregado por el artista, dentro de media/musica/.
                Spotify y Apple Music son enlaces, no archivos de audio.
                Un tema necesita «src» (audio) o al menos un enlace en «links».
     profiles → { label:'Spotify', url:'https://…' }      perfiles del artista en plataformas
     socials  → { label:'Instagram', url:'https://…' }    redes del artista
     merch / floor → { label:'Texto de la pista', url:'https://…' }  objetos que abren un enlace
   ===================================================================== */
window.SITE = {
  review: false,

  // Proyectos (portátil). Pendiente: material del cliente.
  projects: [
    // { title:'', category:'', year:'', summary:'', description:'', image:'media/proyectos/01.jpg', alt:'', link:'https://', linkLabel:'Ver proyecto' },
  ],

  // Galería (portátil): fotos enviadas por Maico (máximo 12).
  gallery: [
    { src:'media/galeria/01-habitacion-dia.jpg', alt:'La habitación de día, con la cama, el escritorio y la lámpara de techo', caption:'La habitación, de día' },
    { src:'media/galeria/02-habitacion-dia-vertical.jpg', alt:'La habitación de día en vertical, con la ventana al fondo', caption:'Desde la puerta' },
    { src:'media/galeria/03-habitacion-lampara.jpg', alt:'La habitación con la lámpara de la cómoda encendida', caption:'Luz de la lámpara' },
    { src:'media/galeria/04-habitacion-penumbra.jpg', alt:'La habitación en penumbra, con la lámpara encendida', caption:'Penumbra' },
    { src:'media/galeria/05-habitacion-atardecer.jpg', alt:'La habitación al atardecer, con luz cálida y la lámpara del techo encendida', caption:'Atardecer' },
    { src:'media/galeria/06-habitacion-noche.jpg', alt:'La habitación de noche, casi a oscuras', caption:'De noche' },
    { src:'media/galeria/07-escritorio-portatil.jpg', alt:'El escritorio con el portátil abierto entre dos altavoces', caption:'El escritorio' },
    { src:'media/galeria/08-escritorio-luz-calida.jpg', alt:'El escritorio con el portátil y los altavoces bajo una luz cálida', caption:'Luz cálida' },
    { src:'media/galeria/09-escritorio-lampara.jpg', alt:'El escritorio con el portátil y la lámpara encendida arriba', caption:'Escritorio y lámpara' },
    { src:'media/galeria/10-escritorio-dia.jpg', alt:'El escritorio de día, con el portátil, los altavoces y el monitor', caption:'Escritorio, de día' },
    { src:'media/galeria/11-escritorio-frontal.jpg', alt:'Vista frontal del portátil sobre el escritorio blanco', caption:'Vista frontal' },
    { src:'media/galeria/12-escritorio-microfono.jpg', alt:'El escritorio con el portátil, un micrófono y la cama al lado', caption:'Micrófono y cama' }
  ],

  // Música (altavoz).
  music: {
    // Perfiles del artista Maic O., enviados por Maico.
    profiles: [
      { label:'Spotify', url:'https://open.spotify.com/artist/3V72UMVdKQ2hoSufJC1pLY' },
      { label:'Apple Music', url:'https://music.apple.com/es/artist/maic-o/6779416924' }
    ],
    // Temas con audio propio (máximo 5): MP3/WAV en media/musica/ + portada opcional.
    tracks: [
      { title:'For the fans, BIDJÍ', subtitle:'Demo', src:'media/musica/01-for-the-fans.mp3' },
      // { title:'', subtitle:'', cover:'media/musica/01.jpg', src:'media/musica/01.mp3', links:[{ label:'Spotify', url:'https://' }] },
    ]
  },

  // Silla (merch): fotos de los productos (media/merch/) y, opcional, «url» de la tienda.
  // Sin fotos ni url, el punto de la silla no aparece. Sin carrito ni pagos.
  merch: {
    label: 'Merch',
    url: '',      // enlace a la tienda, si existe
    note: '',     // línea opcional bajo el título
    items: [
      { src:'media/merch/01-european-fulish-pikin.jpg', alt:'Camiseta blanca con el texto «European fulish Pikin» y un círculo de estrellas amarillas', caption:'European fulish Pikin' },
      { src:'media/merch/02-european-fulish-pikin-fondo.jpg', alt:'Camiseta «European fulish Pikin» sobre un fondo amarillo, naranja y magenta', caption:'European fulish Pikin' },
      { src:'media/merch/03-retrato.jpg', alt:'Camiseta blanca con un retrato estampado de Maico con gorro rosa y sudadera gris', caption:'Camiseta retrato' }
    ]
  },

  // Suelo: cuenta de Instagram indicada por Maico.
  floor: { label:'The Okay Ground', url:'https://www.instagram.com/theokground/' },

  // Sobre mí (cama).
  about: {
    title: 'También soy este lugar.',
    text: [      // un párrafo por entrada; solo texto escrito o aprobado por el cliente. Pendiente.
      // 'Párrafo…',
    ],
    quote: '',   // frase destacada (opcional)
    tags: []     // etiquetas cortas (opcional): ['Música', 'Fotografía']
  },

  // Redes del artista (cama y contacto).
  socials: [
    { label:'Instagram', url:'https://www.instagram.com/okmaico/' }
  ],

  // Contacto (portátil).
  contact: {
    email: '',   // correo real, p. ej. nombre@dominio.com. Pendiente.
    note: ''     // línea opcional bajo el correo
  }
};

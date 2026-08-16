---
name: NocheLuz
description: Una forma luminosa y humana de reservar celebraciones locales.
colors:
  night: "#10213B"
  night-deep: "#081426"
  sand: "#F7F2EA"
  lime: "#D8E89B"
  apricot: "#FFB870"
  sky: "#C8E5F4"
  map-user: "#2E8BC0"
  ink: "#162238"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Arial, sans-serif"
    fontSize: "clamp(3rem, 6vw, 5.75rem)"
    fontWeight: "700"
    lineHeight: "0.92"
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: "500"
    lineHeight: "1.55"
rounded:
  soft: "16px"
  roomy: "28px"
  round: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    padding: "15px 22px"
  button-dark:
    backgroundColor: "{colors.night}"
    textColor: "{colors.white}"
    rounded: "{rounded.round}"
    padding: "15px 22px"
---

# Design System: NocheLuz

## Overview

**Creative North Star: "La noche ya está apartada"**

NocheLuz imagina el momento posterior a elegir un lugar: el patio se ha encendido, la fecha ya tiene forma y cada detalle se siente posible. La interfaz mezcla la calma operativa de una agenda de eventos con campos inmersivos de azul nocturno, luz cálida y bloques de información de gran escala.

Los flujos no se esconden tras pantallas administrativas. Fecha, extras, pago y contacto humano aparecen como estaciones de la misma reserva. El lenguaje es cálido, directo y local, sin hacer promesas de disponibilidad o precios que el sistema no pueda probar.

**Key Characteristics:**
- Noche índigo como campo principal y papel arena para los momentos de decisión.
- Tipografía grotesca expresiva, nunca ceremonial ni editorial.
- Formas grandes y curvas suaves, con controles compactos y firmes.
- Un umbral visible entre imaginar el evento y tenerlo reservado.

## Colors

La paleta usa un azul profundo de noche como territorio de la experiencia; verde-lima y chabacano son señales funcionales de acción y celebración.

### Primary
- **Noche de terraza:** superficie de inmersión, encabezados y operaciones de confianza.
- **Lima de confirmación:** acción primaria, estados listos y selección activa.

### Secondary
- **Chabacano de luz:** notas humanas, fechas y detalles que requieren atención amable.
- **Cielo de video:** superficies de comunicación y presencia en línea.

### Neutral
- **Arena de invitación:** grandes secciones de lectura y configuración.
- **Tinta de agenda:** texto de alta prioridad en superficies claras.
- **Blanco de foco:** texto y capas de alta prioridad sobre la noche.

**The Signal, Not Confetti Rule.** El verde-lima aparece para acciones que cambian el estado de una reserva; no decora texto ni fondos al azar.

## Typography

**Display Font:** Bricolage Grotesque (with Arial fallback)
**Body Font:** Manrope (with Arial fallback)

**Character:** Los títulos son amplios y cercanos, como una frase dicha antes de que empiece la fiesta. El cuerpo es neutro y denso para permitir comparar, configurar y decidir.

### Hierarchy
- **Display** (700, clamp(3rem, 6vw, 5.75rem), 0.92): promesa y decisiones principales.
- **Headline** (700, 2.2rem, 1): nombres de secciones y espacios.
- **Title** (700, 1.1rem, 1.15): módulos y decisiones compactas.
- **Body** (500, 1rem, 1.55): máximo de 68ch en lectura larga.
- **Label** (800, .72rem, .08em): etiquetas operativas de uso escaso.

**The Single Breath Rule.** El título principal se lee en una sola respiración; no se comprime para caber.

## Layout

El sitio alterna un escenario de altura completa con pasajes de reserva de alta densidad. Un contenedor ancho mantiene el ritmo, mientras que el umbral vertical del primer bloque muestra el cambio de idea a plan confirmado. En teléfonos, el umbral rota a una secuencia vertical y los controles importantes permanecen alcanzables sin zoom.

## Elevation & Depth

La profundidad surge de superponer superficies coloreadas y de imágenes a escala, no de tarjetas genéricas. Las únicas sombras son suaves, desplazadas y reservadas para el planificador flotante, el chat y controles que emergen sobre una escena.

**The Surface First Rule.** Una superficie usa borde o sombra, nunca ambos como decoración.

## Shapes

Los contenedores grandes tienen curvas generosas (28px), con chips y acciones en cápsulas completas. Las divisiones son delgadas y tonales; los botones poseen masa y contraste, no biseles de producto SaaS.

## Components

### Buttons
- **Shape:** cápsula compacta (999px) con icono MorphIcon y etiqueta clara.
- **Primary:** lima sobre arena o noche; se eleva levemente al pasar el cursor.
- **Hover / Focus:** cambio de superficie y anillo de foco de alto contraste, sin destellos decorativos.
- **Secondary / Ghost:** superficie translúcida o borde tonal para acciones de navegación.

### Chips
- **Style:** cápsulas pequeñas de color sólido y etiquetas claras.
- **State:** la selección se marca con tinta sobre lima; los filtros pasivos permanecen en arena o azul suave.

### Cards / Containers
- **Corner Style:** curvatura suave (16px) para unidades de contenido y amplia (28px) para estaciones principales.
- **Background:** campos de color, imagen o arena según el tipo de tarea.
- **Shadow Strategy:** sólo en capas flotantes o elementos que cambian de plano.

### Inputs / Fields
- **Style:** fondo blanco, borde transparente y etiqueta explícita.
- **Focus:** anillo lima sobre superficies oscuras y anillo índigo sobre claras.

### Navigation
- Navegación editorial compacta arriba, con una acción de reserva persistente; el menú móvil usa una transición MorphIcon entre menú y cierre.

### Operational Map
- **Scope:** el mapa muestra únicamente San Luis Río Colorado y limita la selección de ubicación a esa zona.
- **Markers:** cada espacio publicado usa un punto de alto contraste; el punto seleccionado se distingue en lima para conectar catálogo, ficha y ubicación.

## Do's and Don'ts

### Do:
- **Do** usar bloques de color completos para que cada etapa del viaje sea inequívoca.
- **Do** mostrar estado y precio como información demostrativa hasta que exista inventario real.
- **Do** animar MorphIcons cuando un control cambia de propósito.

### Don't:
- **Don't** convertir la página en una cuadrícula de tarjetas idénticas.
- **Don't** usar textura, grano o degradados como sustituto de imágenes y contenido.
- **Don't** ocultar pago, contacto o extras en pasos posteriores al momento de decisión.

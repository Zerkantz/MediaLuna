import Sparkles from "lucide/dist/esm/icons/sparkles.mjs";

const ubicacionPorDefecto = [32.4565, -114.7719];
const fotosPorDefecto = [
  "https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1400&q=85",
];

const esUrl = (valor) =>
  typeof valor === "string" && valor.startsWith("http");

const textoDisponible = (...valores) =>
  valores.find(
    (valor) =>
      typeof valor === "string" &&
      valor.trim() &&
      valor.trim().toLowerCase() !== "pendiente",
  )?.trim() ?? "";

const adaptarUbicacion = (datos) => {
  const ubicacion = datos.ubicacion ?? datos.location;

  if (Array.isArray(ubicacion) && ubicacion.length >= 2) {
    return [Number(ubicacion[0]), Number(ubicacion[1])];
  }

  if (ubicacion?.latitude !== undefined && ubicacion?.longitude !== undefined) {
    return [Number(ubicacion.latitude), Number(ubicacion.longitude)];
  }

  if (ubicacion?.latitud !== undefined && ubicacion?.longitud !== undefined) {
    return [Number(ubicacion.latitud), Number(ubicacion.longitud)];
  }

  return [
    Number(datos.latitud ?? ubicacionPorDefecto[0]),
    Number(datos.longitud ?? ubicacionPorDefecto[1]),
  ];
};

const adaptarFotos = (datos) => {
  const fotos = [
    datos.urlImagen,
    ...(Array.isArray(datos.fotos) ? datos.fotos : []),
    ...(Array.isArray(datos.imagenes) ? datos.imagenes : []),
    ...(Array.isArray(datos.photos) ? datos.photos : []),
  ].filter(esUrl);

  return fotos.length ? fotos : fotosPorDefecto;
};

export function adaptarSalon(documento, disponibilidades = []) {
  const datos = documento.data();
  const fechasDisponibles = disponibilidades
    .filter(
      (disponibilidad) =>
        disponibilidad.salonId === documento.id &&
        disponibilidad.estado === "disponible",
    )
    .map((disponibilidad) => disponibilidad.fecha)
    .filter(Boolean);

  return {
    id: documento.id,
    nombre: datos.nombre ?? datos.name ?? "Salón sin nombre",
    tipo: datos.tipo ?? datos.type ?? "Salón",
    capacidad: Number(datos.capacidad ?? datos.capacity ?? 0),
    direccion:
      textoDisponible(
        datos.direccion,
        datos.address,
        datos.ubicacion?.direccion,
        datos.ubicacion?.address,
        datos.location?.direccion,
        datos.location?.address,
      ) || "San Luis Río Colorado, Sonora",
    telefono: datos.telefono ?? datos.phone ?? "",
    precioBase: Number(datos.precioBase ?? datos.basePrice ?? 0),
    fotos: adaptarFotos(datos),
    ubicacion: adaptarUbicacion(datos),
    servicios: datos.serviciosIds ?? datos.servicios ?? datos.services ?? [],
    fechasDisponibles:
      fechasDisponibles.length > 0
        ? fechasDisponibles
        : datos.fechasDisponibles ?? datos.availableDates ?? ["Fecha por confirmar"],
    descripcion: datos.descripcion ?? datos.description ?? "",
    acento: datos.acento ?? datos.accent ?? "lime",
    duenoId: datos.duenoId ?? "",
    estado: datos.estado ?? "publicado",
    idPublicoCloudinary: datos.idPublicoCloudinary ?? "",
  };
}

export function adaptarServicio(documento) {
  const datos = documento.data();

  return {
    id: documento.id,
    nombre: datos.nombre ?? datos.label ?? "Servicio",
    descripcion: datos.descripcion ?? datos.detail ?? "",
    precio: Number(datos.precio ?? datos.price ?? 0),
    activo: datos.activo ?? true,
    urlImagen: datos.urlImagen ?? "",
    idPublicoCloudinary: datos.idPublicoCloudinary ?? "",
    icon: Sparkles,
  };
}

export function adaptarDisponibilidad(documento) {
  const datos = documento.data();

  return {
    id: documento.id,
    salonId: datos.salonId ?? "",
    fecha: datos.fecha ?? "",
    estado: datos.estado ?? "pendiente",
    precio: Number(datos.precio ?? 0),
  };
}

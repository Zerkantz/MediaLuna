// Configuración pública preparada para Cloudinary. Nunca agregar API Secret aquí.
export const CLOUDINARY_CONFIG = {
  cloudName: 'CLOUD_NAME_PLACEHOLDER',
  uploadPreset: 'media_luna_salones',
}

export const uploadSalonImage = async (file) => {
  if (!file) return null
  return {
    secure_url: URL.createObjectURL(file),
    public_id: 'pending-connection/salon-image',
    pending: true,
  }
}

export const cloudinaryUploadNote = 'Al conectar Cloudinary, guardar secure_url en urlImagen y public_id en idPublicoCloudinary.'

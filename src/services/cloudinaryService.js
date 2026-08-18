export const CLOUDINARY_CONFIG = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'media_luna_salones',
}

export const cloudinaryConfigured = Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset)

export const uploadSalonImage = async (file) => {
  if (!file) return null

  if (!cloudinaryConfigured) {
    return {
      secure_url: URL.createObjectURL(file),
      public_id: 'cloudinary-pendiente/media-luna-salon',
      pending: true,
    }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'No se pudo subir la imagen a Cloudinary.')
  }

  const result = await response.json()
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    pending: false,
  }
}

export const cloudinaryUploadNote = cloudinaryConfigured
  ? 'Cloudinary conectado con upload unsigned. Se guardan secure_url e public_id en Firestore.'
  : 'Pendiente de conexión: agrega VITE_CLOUDINARY_CLOUD_NAME para subir a Cloudinary. Nunca uses API Secret en frontend.'

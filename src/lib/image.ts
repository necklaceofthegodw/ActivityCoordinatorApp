const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.85

/**
 * Tries to compress the image to a JPEG blob scaled to MAX_DIMENSION.
 * If the format can't be processed by the canvas pipeline (e.g. HEIC on some devices),
 * returns the original File unchanged so the upload can still proceed.
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)

    let { width, height } = bitmap
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width)
        width = MAX_DIMENSION
      } else {
        width = Math.round((width * MAX_DIMENSION) / height)
        height = MAX_DIMENSION
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('toBlob returned null')),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  } catch {
    // Canvas can't process this format — return original file as fallback
    return file
  }
}

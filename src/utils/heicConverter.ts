/**
 * HEIC to JPG Converter Utility
 * Converts HEIC/HEIF images to JPG format for upload compatibility
 */

import heic2any from 'heic2any';

/**
 * Check if a file is a HEIC/HEIF image
 */
export function isHeicFile(file: File): boolean {
  const heicExtensions = ['.heic', '.heif'];
  const heicMimeTypes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
  
  const fileName = file.name.toLowerCase();
  const hasHeicExtension = heicExtensions.some(ext => fileName.endsWith(ext));
  const hasHeicMimeType = heicMimeTypes.includes(file.type.toLowerCase());
  
  return hasHeicExtension || hasHeicMimeType;
}

/**
 * Convert HEIC/HEIF file to JPG
 * @param file - The HEIC/HEIF file to convert
 * @returns A new File object in JPG format
 */
export async function convertHeicToJpg(file: File): Promise<File> {
  try {
    console.log(`Converting HEIC file: ${file.name} (${file.size} bytes)`);
    
    // Convert HEIC to JPG blob
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9, // High quality (0.0 to 1.0)
    });
    
    // heic2any can return Blob or Blob[] (for multi-image HEIC)
    // We'll take the first blob if it's an array
    const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    
    // Create new filename with .jpg extension
    const originalName = file.name.replace(/\.(heic|heif)$/i, '');
    const newFileName = `${originalName}.jpg`;
    
    // Create a new File from the converted blob
    const convertedFile = new File([resultBlob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    
    console.log(`✅ Conversion successful: ${newFileName} (${convertedFile.size} bytes)`);
    
    return convertedFile;
  } catch (error) {
    console.error('Failed to convert HEIC to JPG:', error);
    throw new Error(`Nepodařilo se převést HEIC soubor: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

/**
 * Handle file selection with automatic HEIC conversion
 * @param file - The selected file
 * @returns The original file or converted JPG file
 */
export async function handleFileWithHeicConversion(file: File): Promise<File> {
  if (isHeicFile(file)) {
    console.log('HEIC file detected, converting to JPG...');
    return await convertHeicToJpg(file);
  }
  
  return file;
}


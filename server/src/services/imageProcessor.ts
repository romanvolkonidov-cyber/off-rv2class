import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface ProcessedSlide {
  originalPath: string;
  compressedPath: string;
  index: number;
}

/**
 * Takes uploaded PNG files, saves originals, and creates
 * compressed 1280x720 JPEGs for AI processing and display.
 */
export async function processSlideImages(
  lessonId: string,
  files: Express.Multer.File[]
): Promise<ProcessedSlide[]> {
  const originalsDir = path.join(process.cwd(), 'uploads', 'originals', lessonId);
  const slidesDir = path.join(process.cwd(), 'uploads', 'slides', lessonId);

  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(slidesDir, { recursive: true });

  // Sort files by name to maintain slide order
  const sortedFiles = [...files].sort((a, b) =>
    a.originalname.localeCompare(b.originalname, undefined, { numeric: true })
  );

  const results: ProcessedSlide[] = [];

  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    const ext = path.extname(file.originalname);
    const baseName = `slide_${String(i).padStart(3, '0')}`;

    // Move original to permanent location
    const originalPath = path.join(originalsDir, `${baseName}${ext}`);
    await fs.rename(file.path, originalPath);

    // Create compressed JPEG
    const compressedPath = path.join(slidesDir, `${baseName}.jpg`);
    await sharp(originalPath)
      .resize(1280, 720, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({ quality: 80 })
      .toFile(compressedPath);

    results.push({
      originalPath: `/uploads/originals/${lessonId}/${baseName}${ext}`,
      compressedPath: `/uploads/slides/${lessonId}/${baseName}.jpg`,
      index: i,
    });
  }

  return results;
}

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

/**
 * Creates a single grid collage of all slides to save AI tokens.
 * Each slide is numbered for AI reference.
 */
export async function createCollage(
  lessonId: string,
  slidePaths: string[]
): Promise<string> {
  const slidesLimit = 25; // Limit to prevent massive images
  const subset = slidePaths.slice(0, slidesLimit);
  
  const cols = Math.ceil(Math.sqrt(subset.length));
  const rows = Math.ceil(subset.length / cols);
  
  const thumbW = 400;
  const thumbH = 225; // 16:9
  
  const collagePath = path.join(process.cwd(), 'uploads', 'slides', lessonId, 'collage.jpg');
  
  const thumbnails = await Promise.all(
    subset.map(async (p, i) => {
      const absPath = path.join(process.cwd(), p);
      return sharp(absPath)
        .resize(thumbW, thumbH)
        .composite([{
          input: Buffer.from(`
            <svg width="${thumbW}" height="${thumbH}">
              <rect x="0" y="0" width="40" height="40" fill="rgba(0,0,0,0.7)" />
              <text x="20" y="28" font-family="Arial" font-size="24" fill="white" text-anchor="middle">${i + 1}</text>
            </svg>`),
          top: 0,
          left: 0
        }])
        .toBuffer();
    })
  );

  await sharp({
    create: {
      width: cols * thumbW,
      height: rows * thumbH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite(thumbnails.map((buffer, i) => ({
    input: buffer,
    top: Math.floor(i / cols) * thumbH,
    left: (i % cols) * thumbW
  })))
  .jpeg({ quality: 70 })
  .toFile(collagePath);

  return `/uploads/slides/${lessonId}/collage.jpg`;
}


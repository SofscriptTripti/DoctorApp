import { PDFDocument, PDFPage } from 'react-native-pdf-lib';
import RNFS from 'react-native-fs';

export async function createPdfFromImages(
  imagePaths: string[],
  fileName: string
): Promise<string> {
  if (!imagePaths.length) {
    throw new Error('No images to generate PDF');
  }

  const pdfPath = `${RNFS.DocumentDirectoryPath}/${fileName}.pdf`;

  let pdf = PDFDocument.create(pdfPath);

  for (const imgPath of imagePaths) {
    const page = PDFPage.create()
      .setMediaBox(595, 842) // A4 size
      .drawImage(imgPath, 'jpg', {
        x: 0,
        y: 0,
        width: 595,
        height: 842,
      });

    pdf = pdf.addPages(page);
  }

  await pdf.write(); // ✅ Fabric-safe native call

  return pdfPath;
}

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { ProductResponse } from '@travel/validation';

// Cell values starting with any of these characters are interpreted as a
// formula by Excel/Sheets/LibreOffice when the file is opened. Product
// names and descriptions are user-controlled and land directly in these
// cells — this is CSV/Excel formula injection, a real and well-known
// class of bug, not a theoretical one.
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

function sanitizeCell(value: string): string {
  if (value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0])) {
    return `'${value}`;
  }
  return value;
}

@Injectable()
export class ExcelExportService {
  /**
   * Streams to a Buffer — nothing is ever written to disk. PDF export is
   * deliberately NOT implemented server-side; see Phase 4's plan notes —
   * it's rendered client-side with @react-pdf/renderer, reusing the same
   * React components, so the server never touches a file for that format
   * either.
   */
  async buildWorkbook(products: ProductResponse[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Travel Product Management System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Products');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Destination', key: 'destination', width: 18 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Price (LKR)', key: 'price', width: 14 },
      { header: 'Inventory', key: 'inventoryCount', width: 12 },
      { header: 'Valid From', key: 'validFrom', width: 14 },
      { header: 'Valid Until', key: 'validUntil', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Expired', key: 'isExpired', width: 10 },
      { header: 'Tags', key: 'tags', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const p of products) {
      sheet.addRow({
        name: sanitizeCell(p.name),
        destination: sanitizeCell(p.destination),
        category: p.category,
        description: sanitizeCell(p.description),
        price: p.price,
        inventoryCount: p.inventoryCount,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
        status: p.status,
        isExpired: p.isExpired ? 'Yes' : 'No',
        tags: sanitizeCell(p.tags.join(', ')),
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

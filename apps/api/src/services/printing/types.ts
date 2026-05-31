export interface CopyLabelData {
  copyId: string;
  barcode: string;
  copyNumber: number | null;
  condition: string | null;
  location: string | null;
  bookTitle: string;
  bookAuthor: string;
  isbn: string | null;
  deweyDecimal: string | null;
  publisher: string | null;
  publicationYear: number | null;
  schoolName: string;
  appUrl: string;
}

import multer from "multer";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "text/plain",
  "application/pdf",
]);

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_DOCUMENT_MIME_TYPES.has(
        file.mimetype,
      )
    ) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Only plain-text and PDF document uploads are supported.",
      ),
    );
  },
}).single("file");
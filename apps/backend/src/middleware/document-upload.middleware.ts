import multer from "multer";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/plain") {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Only plain-text document uploads are supported.",
      ),
    );
  },
}).single("file");
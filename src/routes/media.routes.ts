import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireRole, requireStaff } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as mc from '../controllers/media.controller';
import * as schemas from '../schemas/media.schema';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 52428800 } });

// Images
router.get('/menu/items/:menuItemId/images', authenticate, validate(schemas.mediaParamSchema, 'params'), mc.getImages);
router.post('/menu/items/:menuItemId/images', authenticate, requireStaff, validate(schemas.mediaParamSchema, 'params'), validate(schemas.imageUploadSchema, 'body'), upload.single('file'), mc.uploadImage);
router.delete('/media/images/:imageId', authenticate, requireRole('owner', 'branch_manager'), validate(schemas.imageDeleteParamSchema, 'params'), mc.deleteImage);

// Videos
router.post('/menu/items/:menuItemId/videos', authenticate, requireStaff, validate(schemas.mediaParamSchema, 'params'), validate(schemas.videoUploadSchema, 'body'), upload.single('file'), mc.uploadVideo);
router.delete('/media/videos/:videoId', authenticate, requireRole('owner', 'branch_manager'), validate(schemas.videoDeleteParamSchema, 'params'), mc.deleteVideo);

// 3D Models
router.post('/menu/items/:menuItemId/3d-models', authenticate, requireStaff, validate(schemas.mediaParamSchema, 'params'),
  upload.fields([
    { name: 'glb', maxCount: 1 },
    { name: 'usdz', maxCount: 1 },
    { name: 'poster', maxCount: 1 },
  ]),
  mc.upload3dModel,
);
router.delete('/media/3d-models/:modelId', authenticate, requireRole('owner', 'branch_manager'), validate(schemas.modelDeleteParamSchema, 'params'), mc.delete3dModel);

export default router;

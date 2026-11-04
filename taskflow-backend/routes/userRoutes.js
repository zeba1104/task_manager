const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const {
	createUser,
	updateUser,
	deleteUser,
	getAllUsers,
	importUsers,
	getUserProfile,
	uploadProfilePicture,
	getProfilePicture,
	resendCredentials,
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

const profilePicturesDirectory = path.join(__dirname, '..', 'uploads', 'profile-pictures');
const profileUpload = multer({
	storage: multer.diskStorage({
		destination: (req, file, callback) => {
			fs.mkdir(profilePicturesDirectory, { recursive: true }, (error) => callback(error, profilePicturesDirectory));
		},
		filename: (req, file, callback) => {
			const extension = file.mimetype === 'image/png' ? '.png'
				: file.mimetype === 'image/webp' ? '.webp' : '.jpg';
			callback(null, `${crypto.randomUUID()}${extension}`);
		},
	}),
	fileFilter: (req, file, callback) => {
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
			return callback(new Error('Use a JPG, PNG, or WebP image'));
		}
		return callback(null, true);
	},
	limits: { fileSize: 5 * 1024 * 1024 },
});

const receiveProfilePicture = (req, res, next) => {
	profileUpload.single('picture')(req, res, (error) => {
		if (!error) return next();
		const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
		return res.status(status).json({ message: status === 413 ? 'Profile pictures must be 5 MB or smaller' : error.message });
	});
};

router.get('/', getAllUsers);
router.post('/import', importUsers);
router.post('/:id/resend-credentials', resendCredentials);
router.get('/:id/profile', getUserProfile);
router.post('/:id/profile-picture', receiveProfilePicture, uploadProfilePicture);
router.get('/:id/profile-picture', getProfilePicture);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;

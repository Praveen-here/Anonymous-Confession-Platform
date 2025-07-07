require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const bcrypt = require("bcryptjs");
const { createServer } = require('http');
const { Server } = require('socket.io');
const { moderateText } = require('./utils/moderation'); // Utility function to moderate text

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer);

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://res.cloudinary.com',
    'https://anonymous-posting-site.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  }
});

// MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  initializeAdmin();
}).catch(err => console.error('MongoDB connection error:', err));

// Schemas
const postSchema = new mongoose.Schema({
  content: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
  comments: [{ content: String, createdAt: { type: Date, default: Date.now } }],
  likes: { type: Number, default: 0 }
});
const Post = mongoose.model('Post', postSchema);

const bannerSchema = new mongoose.Schema({
  imageUrl: String,
  updatedAt: { type: Date, default: Date.now }
});
const Banner = mongoose.model('Banner', bannerSchema);

const backgroundSchema = new mongoose.Schema({
  imageUrl: String,
  public_id: String,
  updatedAt: { type: Date, default: Date.now }
});
const Background = mongoose.model('Background', backgroundSchema);

const adminSchema = new mongoose.Schema({
  username: String,
  password: String
});
const Admin = mongoose.model('Admin', adminSchema);

const discussionHallSchema = new mongoose.Schema({
  topic: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  status: { type: String, enum: ['active', 'expired'], default: 'active', index: true }
});
discussionHallSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const DiscussionHall = mongoose.model('DiscussionHall', discussionHallSchema);

const chatMessageSchema = new mongoose.Schema({
  hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionHall' },
  userNumber: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// Admin setup
async function initializeAdmin() {
  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await new Admin({ username: 'admin', password: hash }).save();
    console.log('Default admin created');
  }
}

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ success: false });
  res.json({ success: true });
});

// Image Uploads (Post, Banner, Background)
app.post('/api/upload/post', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'posts' });
    res.json({ imageUrl: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: 'Image upload failed' });
  }
});

app.post('/api/upload', upload.single('banner'), async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ message: 'Unauthorized' });
  const dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataURI, { folder: 'banners' });
  const banner = new Banner({ imageUrl: result.secure_url });
  await banner.save();
  res.status(200).json({ success: true, imageUrl: banner.imageUrl });
});

app.post('/api/upload/background', upload.single('background'), async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ message: 'Unauthorized' });
  const dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataURI, { folder: 'backgrounds' });
  const ratio = result.width / result.height;
  if (Math.abs(ratio - (9/16)) > 0.01) {
    await cloudinary.uploader.destroy(result.public_id);
    return res.status(400).json({ message: 'Image must be 9:16 aspect ratio' });
  }
  const bg = new Background({ imageUrl: result.secure_url, public_id: result.public_id });
  await bg.save();
  res.json({ imageUrl: bg.imageUrl });
});

// Posts
app.post('/api/posts', async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ message: 'Post requires text or image' });
    if (content && !(await moderateText(content))) return res.status(400).json({ message: 'Inappropriate content' });
    const newPost = new Post({ content, imageUrl });
    await newPost.save();
    res.status(201).json({ message: 'Post created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating post' });
  }
});

app.get('/api/posts', async (_, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.post('/api/posts/:postId/like', async (req, res) => {
  const { liked } = req.body;
  const increment = liked ? 1 : -1;
  const post = await Post.findByIdAndUpdate(req.params.postId, { $inc: { likes: increment } }, { new: true });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json({ likes: post.likes });
});

app.post('/api/posts/:postId/comments', async (req, res) => {
  const { content } = req.body;
  if (!(await moderateText(content))) return res.status(400).json({ message: 'Inappropriate comment' });
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  post.comments.push({ content });
  await post.save();
  res.status(201).json({ message: 'Comment added' });
});

app.get('/api/posts/:postId/comments', async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post.comments);
});

// Discussion Halls & Chat
app.get('/api/discussion-halls/active', async (_, res) => {
  const halls = await DiscussionHall.find({ status: 'active', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  res.json(halls);
});

app.post('/api/discussion-halls', async (req, res) => {
  const { username, password, topic } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ message: 'Unauthorized' });
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const newHall = new DiscussionHall({ topic, createdBy: admin._id, expiresAt });
  await newHall.save();
  res.status(201).json(newHall);
});

app.get('/api/discussion-halls/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Invalid ID' });
  const hall = await DiscussionHall.findOne({ _id: req.params.id, status: 'active', expiresAt: { $gt: new Date() } });
  if (!hall) return res.status(404).json({ message: 'Hall not found' });
  res.json(hall);
});

app.delete('/api/discussion-halls/:id', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ message: 'Unauthorized' });
  await DiscussionHall.findByIdAndDelete(req.params.id);
  await ChatMessage.deleteMany({ hallId: req.params.id });
  res.json({ success: true });
});

app.get('/api/chat-messages/:hallId', async (req, res) => {
  const messages = await ChatMessage.find({ hallId: req.params.hallId }).sort({ createdAt: 1 });
  res.json(messages);
});

// WebSocket
io.on('connection', (socket) => {
  socket.on('join-hall', (hallId) => socket.join(hallId));
  socket.on('chat-message', async ({ hallId, userNumber, content }) => {
    if (!(await moderateText(content))) return socket.emit('chat-error', 'Inappropriate message');
    const msg = new ChatMessage({ hallId, userNumber, content });
    await msg.save();
    io.to(hallId).emit('new-message', msg);
  });
});

// Cleanup expired halls
setInterval(async () => {
  await DiscussionHall.updateMany({ status: 'active', expiresAt: { $lt: new Date() } }, { status: 'expired' });
}, 3600000);

// Start server
httpServer.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
